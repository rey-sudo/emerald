use event_consumer::{
    Result,
    application::{EventEnveloped, consumer::MultiHandler},
    async_trait, info,
    sqlx::{self, Postgres, Transaction, types::Uuid},
    warn
};

/// This struct encapsulates the domain logic for the "folder" entity_type.
pub struct FolderHandler;

/// Represents the 'folders' table in the database.
#[derive(serde::Deserialize, sqlx::FromRow)]
pub struct Folder {
    id: Uuid,
    user_id: Uuid,
    status: String,
    name: String,
    storage_path: String,
    color: String,
    created_at: Option<i64>,
    readed_at: Option<i64>,
    updated_at: Option<i64>,
    deleted_at: Option<i64>,
    v: i64,
}

///This implementation allows FolderHandler to be used by the MultiHandler.
#[async_trait]
impl MultiHandler for FolderHandler {

    /// Determines if this handler should process a given entity_type. 
    fn can_handle(&self, entity_type: &str) -> bool {
        entity_type == "folder"
    }

    /// Returns a human-readable name for the handler.
    fn name(&self) -> &str {
        return "FolderHandler"
    }

    /// Executes the core business logic for a specific event.
    async fn handle<'a>(
        &self,
        tx: &mut Transaction<'a, Postgres>,
        event: &EventEnveloped,
    ) -> Result<()> {
        match event.event_type.as_str() {
            "folder.created" => {
                let folder: Folder = serde_json::from_value(event.data.clone())?;

                sqlx::query!(
                    r#"
                    INSERT INTO folders (id, user_id, status, name, storage_path, color, created_at, readed_at, updated_at, deleted_at, v)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    "#,
                    folder.id, folder.user_id, folder.status, folder.name, folder.storage_path, folder.color, 
                    folder.created_at, folder.readed_at, folder.updated_at, folder.deleted_at, folder.v
                )
                .execute(&mut **tx)
                .await?;

                Ok(())
            }
            "folder.updated" => Ok(()),
            "folder.deleted" => Ok(()),
            _ => {
                // If we don't care about this specific action, we ACK and move on
                warn!("No specific logic for event_type: {}", event.event_type);
                Ok(())
            }
        }
    }
}