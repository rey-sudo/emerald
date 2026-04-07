use event_consumer::{
    Result,
    application::{EventEnveloped, consumer::MultiHandler},
    async_trait, info,
    sqlx::{self, Postgres, Transaction},
    warn,
};
use uuid::Uuid;
use sqlx::postgres::{PgQueryResult};

/// This struct encapsulates the domain logic for the "document" entity_type.
pub struct DocumentHandler;

/// Represents the 'document' table in the database.
#[derive(serde::Deserialize, sqlx::FromRow)]
pub struct Document {
    pub id: Uuid,
    pub user_id: Uuid,
    pub folder_id: Uuid,
    pub original_name: String,
    pub internal_name: String,
    pub content_type: String,
    pub mime_type: String,
    pub size_bytes: i64,
    pub storage_path: String,
    pub status: String,
    pub checksum: Option<String>,
    pub context: Option<String>,
    pub keywords: Option<String>,

    pub metadata: Option<serde_json::Value>,

    pub created_at: Option<i64>,
    pub readed_at: Option<i64>,
    pub updated_at: Option<i64>,
    pub deleted_at: Option<i64>,
    pub v: i64,
}

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
    /// * `tx` - A mutable reference to an active SQLx transaction.
    /// * `event` - The enveloped event containing metadata and the actual payload.
    async fn handle<'a>(
        &self,
        tx: &mut Transaction<'a, Postgres>,
        event: &EventEnveloped,
    ) -> Result<()> {
        match event.event_type.as_str() {
            "document.created" => {
                let document: Document = serde_json::from_value(event.data.clone())?;

                sqlx::query!(r#"
                INSERT INTO documents (
                    id, user_id, folder_id, original_name, internal_name, 
                    content_type, mime_type, size_bytes, storage_path, 
                    status, checksum, context, keywords, metadata, 
                    created_at, readed_at, updated_at, deleted_at, v
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
                "#,
                    document.id,
                    document.user_id,
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
                    document.created_at,
                    document.readed_at,
                    document.updated_at,
                    document.deleted_at,
                    document.v
                )
                .execute(&mut **tx)
                .await?;

                Ok(())
            }
            "document.updated" => {
                let document: Document = serde_json::from_value(event.data.clone())?;
                
                let result: PgQueryResult = sqlx::query!(r#"
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
                WHERE id = $1 AND v = ($17::bigint - 1)
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
                    document.v         
                )
                .execute(&mut **tx)
                .await?;

                // Optimistic Concurrency Control
                if result.rows_affected() == 0 {
                    return Err(anyhow::anyhow!("Conflict: Document was modified by another process or not found"));
                }

                Ok(())
            }
            "document.deleted" => Ok(()),
            _ => {
                // If we don't care about this specific action, we ACK and move on
                warn!("No specific logic for event_type: {}", event.event_type);
                Ok(())
            }
        }
    }
}
