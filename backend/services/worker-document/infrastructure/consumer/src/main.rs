use event_consumer::{
    Result,
    application::{self, EventEnveloped, consumer::MultiHandler},
    async_trait, error, info,
    infrastructure::bootstrap::{self, AppState},
    sqlx::{Postgres, Transaction},
    warn,
};

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
    ) -> Result<()> {
        match event.event_type.as_str() {
            "document.created" => {
                info!("{:?}", event.data["id"]);
                info!("{:?}", event.data["mime_type"]);
                info!("{:?}", event.data["user_id"]);
                info!("{:?}", event.data["internal_name"]);
                info!("{:?}", event.data["storage_path"]);
                info!("{:?}", event.data["folder_id"]);

                let client: reqwest::Client = reqwest::Client::new();

                let payload: serde_json::Value = serde_json::json!({
                    "event_type": "document.created",
                        "data": {
                        "id": event.data["id"],
                        "mime_type": event.data["mime_type"],
                        "user_id": event.data["user_id"],
                        "internal_name": event.data["internal_name"],
                        "storage_path": event.data["storage_path"],
                        "folder_id": event.data["folder_id"],
                    }
                });

                let response = client
                    .post("http://localhost:3005/create-job")
                    .json(&payload)
                    .send()
                    .await?;

                if response.status().is_success() {
                    let res_json: serde_json::Value = response.json().await?;
                    // to_string_pretty lo hace legible con saltos de línea y sangrías
                    info!(
                        "JSON recibido:\n{}",
                        serde_json::to_string_pretty(&res_json).unwrap()
                    );
                } else {
                    warn!("Status de error: {}", response.status());
                    let error_body = response.text().await?;
                    error!("Cuerpo del error: {}", error_body);
                }

                //UPDATE version event
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
    ) -> Result<()> {
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
async fn main() -> Result<()> {
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
