use anyhow::Result;
use async_trait::async_trait;
use event_consumer::{
    application::{self, EventEnveloped, consumer::MultiHandler},
    infrastructure::bootstrap::{self, AppState},
};
use sqlx::{Postgres, Transaction};
use tracing::{error, info, warn};

/// EXAMPLE. A specific handler implementation for folder-related events.
/// This struct encapsulates the domain logic for the "folder" entity type.
struct FolderHandler;

#[async_trait]
impl MultiHandler for FolderHandler {
    /// Determines if this handler should process a given entity_type.
    /// Used by the dispatcher to route events only to interested parties.    
    fn can_handle(&self, entity_type: &str) -> bool {
        entity_type == "folder"
    }
    /// Returns a human-readable name for the handler.
    /// Primarily used for structured logging and debugging purposes.
    fn name(&self) -> &str {
        "FolderHandler"
    }
    /// Executes the core business logic for a specific event.
    /// * `tx` - A mutable reference to an active SQLx transaction.
    /// * `event` - The enveloped event containing metadata and the actual payload.
    async fn handle<'a>(
        &self,
        tx: &mut Transaction<'a, Postgres>,
        event: &EventEnveloped,
    ) -> Result<()> {
        match event.event_type.as_str() {
            "folder.created" => {
                info!("Handling folder creation for ID: {}", event.event_id);
                // self.on_created(tx, event).await
                Ok(())
            }
            "folder.updated" => {
                info!("Handling folder update for ID: {}", event.event_id);
                // self.on_updated(tx, event).await
                Ok(())
            }
            "folder.deleted" => {
                info!("Handling folder deletion for ID: {}", event.event_id);
                // self.on_deleted(tx, event).await
                Ok(())
            }
            _ => {
                // If we don't care about this specific action, we ACK and move on
                warn!("No specific logic for event_type: {}", event.event_type);
                Ok(())
            }
        }
    }
}

/// EXAMPLE. This struct follows the Router/Dispatcher pattern, allowing a single
/// consumer to manage multiple entity types efficiently.
struct HandlerRouter {
    folder: FolderHandler,
}

#[async_trait]
impl MultiHandler for HandlerRouter {
    /// Returns true if at least one sub-handler is interested in the entity type.
    fn can_handle(&self, entity_type: &str) -> bool {
        self.folder.can_handle(entity_type) // OR others handlers
    }
    /// Returns the identifier for this router.
    /// Useful for identifying the dispatcher in high-level application logs.
    fn name(&self) -> &str {
        "MultiHandler"
    }

    /// Matches the event's entity type against the available handlers and
    /// ensures the database transaction (`tx`) is passed down correctly.
    async fn handle<'a>(
        &self,
        tx: &mut Transaction<'a, Postgres>,
        event: &EventEnveloped,
    ) -> Result<()> {
        match event.entity_type.as_str() {
            "folder" => self.folder.handle(tx, event).await,
            _ => {
                warn!(
                    "MultiHandler received type it cannot route: {}",
                    event.entity_type
                );
                Ok(())
            }
        }
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    // 1. Bootstrapping: Initialize configuration, database connection pools,
    // and shared resources wrapped in an Arc for thread-safe access.
    let state: std::sync::Arc<AppState> = bootstrap::run().await?;

    // 2. Business Logic Handler: Instance of the specific handler for this service.
    let multi_handler: HandlerRouter = HandlerRouter {
        folder: FolderHandler,
    };

    // 3. Concurrent Flow Control: 'tokio::select!' monitors multiple futures simultaneously.
    tokio::select! {

    // BRANCH A
    res = application::run(state.clone(), multi_handler) => {
        match res {
            Ok(_) => {
                warn!("Application loop finished gracefully but unexpectedly");
            },
            Err(e) => {
                error!(
                error = %e,
                cause = ?e.source(),
                "Application loop CRASHED"
                );

                return Err(e);
            }
        }
    },
    // BRANCH B
    _ = tokio::signal::ctrl_c() => {
         info!("Ctrl+C signal received, initiating graceful shutdown");
    },
    }

    info!("Service stopped");

    Ok(())
}
