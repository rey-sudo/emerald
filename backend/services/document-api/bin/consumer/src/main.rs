pub mod document;
pub mod model;
use event_consumer::{
    application::{self, consumer::MultiHandler},
    async_trait,
    infrastructure::bootstrap::{self, AppState},
    model::EventEnveloped,
    sqlx::{Postgres, Transaction},
};
use std::error::Error;
use tracing::{error, info, warn};
use crate::document::DocumentHandler;

struct Router {
    document: DocumentHandler,
}

#[async_trait]
impl MultiHandler for Router {
    /// Returns true if at least one sub-handler is interested in the entity type.
    fn can_handle(&self, entity_type: &str) -> bool {
        self.document.can_handle(entity_type)
    }
    /// Returns the identifier for this router.
    /// Useful for identifying the dispatcher in high-level application logs.
    fn name(&self) -> &str {
        "Router"
    }

    /// Matches the event's entity type against the available handlers and
    /// ensures the database transaction (`tx`) is passed down correctly.
    async fn handle<'a>(
        &self,
        tx: &mut Transaction<'a, Postgres>,
        event: &EventEnveloped,
    ) -> Result<(), Box<dyn Error + Send + Sync>> {
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

// MAIN ---------------------------------------------------------------------------------------
#[tokio::main]
async fn main() -> Result<(), Box<dyn Error + Send + Sync>> {
    // 1. Bootstrap: Init config, DB pools, and shared resources in Arc for thread-safety.
    let state: std::sync::Arc<AppState> = bootstrap::run().await?;

    // 2. Business Logic Handlers: Instance of the specific handlers for this service.
    let multi_handler: Router = Router {
        document: DocumentHandler,
    };

    // 3. Concurrent Flow Control: 'tokio::select!' monitors multiple futures simultaneously.
    tokio::select! {
        res = application::run(state, multi_handler) => {
            match res {
                Ok(_) => warn!("Application loop finished gracefully but unexpectedly"),
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

        _ = tokio::signal::ctrl_c() => {
            info!("Ctrl+C signal received, initiating graceful shutdown");
        },
    }

    info!("Service stopped");

    Ok(())
}
