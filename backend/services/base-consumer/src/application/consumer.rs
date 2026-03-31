use crate::{application::EventEnveloped, infrastructure::bootstrap::AppState};
use anyhow::{Context, Result};
use async_trait::async_trait;
use sqlx::{Postgres, Transaction};
use std::sync::Arc;
use tracing::error;

/// This contract trait must be implemented by any component that wishes to process
/// incoming events. It is designed to be thread-safe (`Send + Sync`) and
/// supports asynchronous execution via the `#[async_trait]` macro.
#[async_trait]
pub trait MultiHandler: Send + Sync {
    /// Predicate used by the consumer engine to determine if this handler
    /// is capable of processing a specific entity_type.
    fn can_handle(&self, entity_type: &str) -> bool;

    /// Main entry point for business logic execution.
    /// This method receives a mutable reference to an active SQL transaction.
    /// # Error Handling
    /// Returning an `Err` will trigger a transaction rollback and signal
    /// the engine to NACK (Negative Acknowledge) the message for a retry.
    async fn handle<'a>(
        &self,
        tx: &mut Transaction<'a, Postgres>,
        event: &EventEnveloped,
    ) -> Result<()>;

    /// Provides a human-readable identifier for the handler.
    /// Useful for telemetry, structured logging, and identifying which
    /// specific logic failed during a crash or error state.
    fn name(&self) -> &str;
}

/// Core transactional engine for event processing.
///
/// This function guarantees "Exactly-Once" processing semantics (within the DB scope)
/// by wrapping both the idempotency check and the business logic in a single transaction.
pub async fn process_event_with_handler<L: MultiHandler>(
    state: &Arc<AppState>,
    event: &EventEnveloped,
    group: &str,
    handlers: &L, // El handler específico del microservicio
) -> Result<bool> {
    // 1. Transaction Initialization: Start an atomic unit of work.
    // All subsequent database operations will either succeed together or fail together.
    let mut tx: Transaction<'_, Postgres> = state
        .pool
        .begin()
        .await
        .context("Failed to begin transaction")?;

    let now_ms: i64 = chrono::Utc::now().timestamp();

    // 2. Idempotency Control (Inbox Pattern):
    // We attempt to record the event in the 'processed' table.
    // The 'ON CONFLICT DO NOTHING' clause ensures that if the event was already
    // handled by this consumer group, the insert will fail silently without an error.
    let result: sqlx::postgres::PgQueryResult = sqlx::query(
        "INSERT INTO processed (id, consumer_group, event_id, processed_at, status) 
         VALUES ($1, $2, $3, $4, $5) 
         ON CONFLICT (consumer_group, event_id) DO NOTHING",
    )
    .bind(uuid::Uuid::now_v7())
    .bind(group)
    .bind(event.event_id)
    .bind(now_ms)
    .bind("SUCCESS")
    .execute(&mut *tx)
    .await?;

    // If no rows were affected, the event is a duplicate.
    // We exit early without executing business logic to prevent side effects.
    if result.rows_affected() == 0 {
        return Ok(false); // Ya procesado
    }

    // 3. Dynamic Execution: Delegate to the microservice-specific handler.
    // We pass the mutable transaction reference (&mut *tx) to ensure the handler's
    // operations are part of this same atomic transaction.
    if let Err(e) = handlers.handle(&mut tx, event).await {
        error!(
            "Business logic failed for event {}: {:?}",
            event.event_id, e
        );
        // Returning an error here drops 'tx', triggering an automatic rollback by SQLx.
        return Err(e);
    }

    // 4. Final Atomic Commit:
    // Persists both the 'processed' record and the handler's changes simultaneously.
    tx.commit().await.context("Failed to commit transaction")?;

    Ok(true)
}
