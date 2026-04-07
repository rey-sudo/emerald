use consumer::{document::DocumentHandler, folder::FolderHandler};
use event_consumer::{
    Result,
    application::{self, EventEnveloped, consumer::MultiHandler},
    async_trait, error, info,
    infrastructure::bootstrap::{self, AppState},
    sqlx::{Postgres, Transaction},
    warn,
};

/// This struct follows the Router/Dispatcher pattern.
struct HandlerRouter {
    folder: FolderHandler,
    document: DocumentHandler,
}

#[async_trait]
impl MultiHandler for HandlerRouter {
    /// Returns true if at least one sub-handler is interested in the entity type.
    fn can_handle(&self, entity_type: &str) -> bool {
        self.folder.can_handle(entity_type) || self.document.can_handle(entity_type)
    }
    
    /// Returns the identifier for this router.
    fn name(&self) -> &str {
        return "MultiHandler";
    }

    /// Matches the event's entity type against the available handlers.
    async fn handle<'a>(
        &self,
        tx: &mut Transaction<'a, Postgres>,
        event: &EventEnveloped,
    ) -> Result<()> {
        match event.entity_type.as_str() {
            "folder" => self.folder.handle(tx, event).await,
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
async fn main() -> Result<()> {
    // 1. Bootstrapping: Initialize configuration, database connection pools.
    let state: std::sync::Arc<AppState> = bootstrap::run().await?;

    // 2. Business Logic Handler: Instance of the specific handler for this service.
    let multi_handler: HandlerRouter = HandlerRouter {
        folder: FolderHandler,
        document: DocumentHandler,
    };

    // 3. Concurrent Flow Control: 'tokio::select!' monitors multiple futures simultaneously.
    tokio::select! {
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

        _ = tokio::signal::ctrl_c() => {
            info!("Initiating graceful shutdown");
        },
    }
    // 4. Leaving the service
    info!("Service stopped");

    Ok(())
}
