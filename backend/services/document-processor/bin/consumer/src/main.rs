use event_consumer::{
    application::{self, EventEnveloped, consumer::MultiHandler},
    async_trait,
    infrastructure::bootstrap::{self, AppState},
    sqlx::{Postgres, Transaction},
};
use tracing::{error, info, warn};

/// A specific handler implementation for document-related events.
/// This struct encapsulates the domain logic for the "document" entity type.
struct DocumentHandler;

#[async_trait]
impl MultiHandler for DocumentHandler {
    /// Determines if this handler should process a given entity_type.
    /// Used by the dispatcher to route events only to interested parties.    
    fn can_handle(&self, entity_type: &str) -> bool {
        entity_type == "document"
    }
    /// Returns a human-readable name for the handler.
    /// Primarily used for structured logging and debugging purposes.
    fn name(&self) -> &str {
        "DocumentHandler"
    }
    /// Executes the core business logic for a specific event.
    /// * `tx` - A mutable reference to an active SQLx transaction.
    /// * `event` - The enveloped event containing metadata and the actual payload.
    async fn handle<'a>(
        &self,
        tx: &mut Transaction<'a, Postgres>,
        event: &EventEnveloped,
    ) -> std::result::Result<(), Box<dyn std::error::Error>> {
        let port: u16 = std::env::var("CONSUMER_SERVER_PORT")
            .unwrap_or_else(|_| "7080".to_string())
            .parse()
            .expect("Port error");

        match event.event_type.as_str() {
            "document.created" => {
                let payload: serde_json::Value = serde_json::json!({
                    "event_type": event.event_type,
                    "data": event.data
                });

                info!("hola");

                Ok(())
            }
            "document.updated" => {
                info!("Handling document update for ID: {}", event.event_id);
                // self.on_updated(tx, event).await
                Ok(())
            }
            "document.deleted" => {
                info!("Handling document deletion for ID: {}", event.event_id);
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

/// This struct follows the Router/Dispatcher pattern, allowing a single
/// consumer to manage multiple entity types efficiently.
struct HandlerRouter {
    document: DocumentHandler,
}

#[async_trait]
impl MultiHandler for HandlerRouter {
    /// Returns true if at least one sub-handler is interested in the entity type.
    fn can_handle(&self, entity_type: &str) -> bool {
        self.document.can_handle(entity_type) // OR others handlers
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
    ) -> std::result::Result<(), Box<dyn std::error::Error>> {
        match event.entity_type.as_str() {
            "document" => self.document.handle(tx, event).await,
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
async fn main() -> std::result::Result<(), Box<dyn std::error::Error>> {
    // 1. Bootstrapping: Initialize configuration, database connection pools,
    // and shared resources wrapped in an Arc for thread-safe access.
    let state: std::sync::Arc<AppState> = bootstrap::run().await?;

    // 2. Business Logic Handler: Instance of the specific handler for this service.
    let multi_handler: HandlerRouter = HandlerRouter {
        document: DocumentHandler,
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
                "Application loop crashed"
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
