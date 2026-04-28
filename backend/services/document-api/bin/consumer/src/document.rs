use crate::model::{Document, DocumentProcessed};
use event_consumer::{async_trait, consumer::MultiHandler, model::EventEnveloped};
use sqlx::{Postgres, QueryBuilder, Transaction, postgres::PgQueryResult};
use std::error::Error;
use tracing::{info, warn};
use uuid::Uuid;

/// This struct encapsulates the domain logic for the "document" entity_type.
pub struct DocumentHandler;

///This implementation allows DocumentHandler to be used by the MultiHandler.
#[async_trait]
impl MultiHandler for DocumentHandler {
    /// Determines if this handler should process a given entity_type.
    fn can_handle(&self, entity_type: &str) -> bool {
        entity_type == "document"
    }

    /// Returns a human-readable name for the handler.
    fn name(&self) -> &str {
        return "DocumentHandler";
    }

    /// Executes the core business logic for a specific event.
    async fn handle<'a>(
        &self,
        tx: &mut Transaction<'a, Postgres>,
        event: &EventEnveloped,
    ) -> std::result::Result<(), Box<dyn Error + Send + Sync>> {
        match event.event_type.as_str() {
            "document.processed" => {
                let document: DocumentProcessed = serde_json::from_value(event.data.clone())?;

                info!("{:?}", document);

                let timestamp_ms: i64 = chrono::Utc::now().timestamp_millis();

                let expected_v: i64 = document.v;

                let update_result: PgQueryResult =
                    QueryBuilder::<Postgres>::new("UPDATE documents SET status = 'PROCESSED'")
                        .push(", updated_at = ")
                        .push_bind(&timestamp_ms)
                        .push(", v  = v + 1")
                        .push(" WHERE id = ")
                        .push_bind(&document.id)
                        .push(" AND v = ")
                        .push_bind(&expected_v)
                        .build()
                        .execute(&mut **tx)
                        .await?;

                // Optimistic Concurrency Control
                if update_result.rows_affected() == 0 {
                    let error_msg: String = format!(
                        "Update failed for Document {}: sequence conflict (expected v={} in DB). Retrying event v={}...",
                        document.id, expected_v, document.v
                    );

                    warn!("{}", error_msg);
                    return Err(error_msg.into());
                }

                let read_result: Document =
                    QueryBuilder::<Postgres>::new("SELECT * FROM documents WHERE id = ")
                        .push_bind(&document.id)
                        .build_query_as::<Document>()
                        .fetch_one(&mut **tx)
                        .await?;

                info!("RESULT 2 {:?}", read_result);

                let data_json: serde_json::Value = serde_json::to_value(read_result)?;
                let meta_json: serde_json::Value = serde_json::json!({});

                QueryBuilder::<Postgres>::new(
                    "INSERT INTO events (specversion, event_type, source, id, time, entity_type, entity_id, data, metadata) VALUES ("
                )
                .push_bind(0)               
                .push(", ").push_bind("document.updated")   
                .push(", ").push_bind("document-api-consumer")   
                .push(", ").push_bind(Uuid::now_v7())              
                .push(", ").push_bind(timestamp_ms)              
                .push(", ").push_bind("document")          
                .push(", ").push_bind(document.id)        
                .push(", ").push_bind(data_json)           
                .push(", ").push_bind(meta_json)         
                .push(")")
                .build()
                .execute(&mut **tx)
                .await?;

                Ok(())
            }

            _ => {
                warn!("No specific logic for event_type: {}", event.event_type);
                Ok(())
            }
        }
    }
}
