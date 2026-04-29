use crate::model::Document;
use event_consumer::{application::consumer::MultiHandler, async_trait, model::EventEnveloped};
use sqlx::{Postgres, QueryBuilder, Transaction, postgres::PgQueryResult};
use std::error::Error;
use tracing::{info, warn};

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
            "document.created" => {
                let document: Document = serde_json::from_value(event.data.clone())?;

                info!("{:?}", document);

                let insert_result: PgQueryResult = QueryBuilder::<Postgres>::new(
                    "INSERT INTO documents (
                        id, user_id, folder_id, original_name, internal_name, content_type, mime_type, size_bytes, storage_path, 
                        status, checksum, context, keywords, metadata, created_at, readed_at, updated_at, deleted_at, v
                    )
                    VALUES (",
                )
                .push_bind(document.id)
                .push(", ")
                .push_bind(document.user_id)
                .push(", ")
                .push_bind(document.folder_id)
                .push(", ")
                .push_bind(document.original_name)
                .push(", ")
                .push_bind(document.internal_name)
                .push(", ")
                .push_bind(document.content_type)
                .push(", ")
                .push_bind(document.mime_type)
                .push(", ")
                .push_bind(document.size_bytes)
                .push(", ")
                .push_bind(document.storage_path)
                .push(", ")
                .push_bind(document.status)
                .push(", ")
                .push_bind(document.checksum)
                .push(", ")
                .push_bind(document.context)
                .push(", ")
                .push_bind(document.keywords)
                .push(", ")
                .push_bind(document.metadata)
                .push(", ")
                .push_bind(document.created_at)
                .push(", ")
                .push_bind(document.readed_at)
                .push(", ")
                .push_bind(document.updated_at)
                .push(", ")
                .push_bind(document.deleted_at)
                .push(", ")
                .push_bind(document.v)
                .push(")")
                .build()
                .execute(&mut **tx)
                .await?;

                if insert_result.rows_affected() == 0 {
                    let error_msg: String = format!(
                        "Error consuming event {}-{}-{}",
                        &event.event_type, document.id, document.v
                    );

                    warn!("{}", error_msg);
                    return Err(error_msg.into());
                }

                Ok(())
            }
            "document.updated" => {
                let document: Document = serde_json::from_value(event.data.clone())?;

                info!("{:?}", document);
                /*
                let expected_v: i64 = document.v - 1;

                                let result: PgQueryResult = sqlx::query(
                                    r#"
                    UPDATE documents
                    SET 
                        folder_id = $2,
                        original_name = $3,
                        internal_name = $4,
                        content_type = $5,
                        mime_type = $6,
                        size_bytes = $7,
                        storage_path = $8,
                        status = $9,
                        checksum = $10,
                        context = $11,
                        keywords = $12,
                        metadata = $13,
                        readed_at = $14,
                        updated_at = $15,
                        deleted_at = $16,
                        v = $17
                    WHERE id = $1 AND v = $18
                    "#,
                                    document.id,
                                    document.folder_id,
                                    document.original_name,
                                    document.internal_name,
                                    document.content_type,
                                    document.mime_type,
                                    document.size_bytes,
                                    document.storage_path,
                                    document.status,
                                    document.checksum,
                                    document.context,
                                    document.keywords,
                                    document.metadata,
                                    document.readed_at,
                                    document.updated_at,
                                    document.deleted_at,
                                    document.v,
                                    expected_v
                                )
                                .execute(&mut **tx)
                                .await?;

                                // Optimistic Concurrency Control
                                if result.rows_affected() == 0 {
                                    let error_msg: String = format!(
                                        "Update failed for Document {}: sequence conflict (expected v={} in DB). Retrying event v={}...",
                                        document.id, expected_v, document.v
                                    );

                                    warn!("{}", error_msg);

                                    return Err(error_msg.into());
                                }
                */
                Ok(())
            }

            "document.deleted" => {
                let document: Document = serde_json::from_value(event.data.clone())?;

                info!("{:?}", document);
                /*
                let expected_v: i64 = document.v - 1;

                                let result: PgQueryResult = sqlx::query(
                                    r#"
                    UPDATE documents
                    SET 
                        folder_id = $2,
                        original_name = $3,
                        internal_name = $4,
                        content_type = $5,
                        mime_type = $6,
                        size_bytes = $7,
                        storage_path = $8,
                        status = $9,
                        checksum = $10,
                        context = $11,
                        keywords = $12,
                        metadata = $13,
                        readed_at = $14,
                        updated_at = $15,
                        deleted_at = $16,
                        v = $17
                    WHERE id = $1 AND v = $18
                    "#,
                                    document.id,
                                    document.folder_id,
                                    document.original_name,
                                    document.internal_name,
                                    document.content_type,
                                    document.mime_type,
                                    document.size_bytes,
                                    document.storage_path,
                                    document.status,
                                    document.checksum,
                                    document.context,
                                    document.keywords,
                                    document.metadata,
                                    document.readed_at,
                                    document.updated_at,
                                    document.deleted_at,
                                    document.v,
                                    expected_v
                                )
                                .execute(&mut **tx)
                                .await?;

                                // Optimistic Concurrency Control
                                if result.rows_affected() == 0 {
                                    let error_msg: String = format!(
                                        "Delete failed for Document {}: sequence conflict (expected v={} in DB). Retrying event v={}...",
                                        document.id, expected_v, document.v
                                    );

                                    warn!("{}", error_msg);

                                    return Err(error_msg.into());
                                }
                */
                Ok(())
            }

            _ => {
                warn!("No specific logic for event_type: {}", event.event_type);
                Ok(())
            }
        }
    }
}
