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
    /// Any database operations performed within this method are part of a
    /// larger atomic unit managed by the engine.
    ///
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

pub async fn process_event_with_handler<L: MultiHandler>(
    state: &Arc<AppState>,
    event: &EventEnveloped,
    group: &str,
    logic: &L, // El handler específico del microservicio
) -> Result<bool> {
    // 1. Iniciamos la transacción (Igual que tu código)
    let mut tx = state
        .pool
        .begin()
        .await
        .context("Failed to begin transaction")?;

    let now = chrono::Utc::now().timestamp();

    // 2. Control de duplicados (Idempotencia)
    let result = sqlx::query(
        "INSERT INTO processed (id, consumer_group, event_id, processed_at, status) 
         VALUES ($1, $2, $3, $4, $5) 
         ON CONFLICT (consumer_group, event_id) DO NOTHING",
    )
    .bind(uuid::Uuid::now_v7())
    .bind(group)
    .bind(event.event_id)
    .bind(now)
    .bind("SUCCESS")
    .execute(&mut *tx)
    .await?;

    if result.rows_affected() == 0 {
        return Ok(false); // Ya procesado
    }

    // 3. EJECUCIÓN DINÁMICA: Llamamos al handler del microservicio
    // Pasamos la transacción (&mut *tx) para que sea ATÓMICO
    if let Err(e) = logic.handle(&mut tx, event).await {
        error!(
            "Business logic failed for event {}: {:?}",
            event.event_id, e
        );
        // Al retornar error, no hay commit -> Rollback automático
        return Err(e);
    }

    // 4. Commit final: Se guarda el registro en 'processed' Y lo que hizo el handler
    tx.commit().await.context("Failed to commit transaction")?;

    Ok(true)
}
