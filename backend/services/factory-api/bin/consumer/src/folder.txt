use event_consumer::{
    Uuid, application::{EventEnveloped, consumer::MultiHandler}, async_trait
};
use sqlx::{FromRow, Postgres, Transaction, postgres::PgQueryResult};
use tracing::{info, warn};

/// This struct encapsulates the domain logic for the "folder" entity_type.
pub struct FolderHandler;

/// Represents the 'folders' table in the database.
#[derive(serde::Deserialize, FromRow, Debug)]
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
    ) -> std::result::Result<(), Box<dyn std::error::Error>> {
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
            "folder.updated" => {

                let folder: Folder = serde_json::from_value(event.data.clone())?; 

                let expected_v: i64 = folder.v - 1;

                let result: PgQueryResult = sqlx::query!(
                    r#"
                    UPDATE folders 
                    SET 
                        user_id = $2,
                        status = $3,
                        name = $4,
                        storage_path = $5,
                        color = $6,
                        readed_at = $7,
                        updated_at = $8,
                        deleted_at = $9,
                        v = $10
                    WHERE id = $1 AND v = $11
                    "#,
                    folder.id,         // $1
                    folder.user_id,    // $2
                    folder.status,     // $3
                    folder.name,       // $4
                    folder.storage_path,// $5
                    folder.color,      // $6
                    folder.readed_at,  // $7
                    folder.updated_at, // $8
                    folder.deleted_at, // $9
                    folder.v,          // $10
                    expected_v         // $11
                )
                .execute(&mut **tx)
                .await?;

                if result.rows_affected() == 0 {
                    let error_msg: String = format!(
                        "Update failed for Folder {}: sequence conflict (expected v={} in DB). Retrying event v={}...", 
                        folder.id, expected_v, folder.v
                    );

                    warn!("{}", error_msg);

                    return Err(error_msg.into());
                }

                Ok(())
            }
            "folder.deleted" => {
                let folder: Folder = serde_json::from_value(event.data.clone())?;

                let expected_v: i64 = folder.v - 1;

                let result: PgQueryResult = sqlx::query!(
                    r#"
                    UPDATE folders 
                    SET 
                        user_id = $2,
                        status = $3,
                        name = $4,
                        storage_path = $5,
                        color = $6,
                        readed_at = $7,
                        updated_at = $8,
                        deleted_at = $9,
                        v = $10
                    WHERE id = $1 AND v = $11
                    "#,
                    folder.id,         // $1
                    folder.user_id,    // $2
                    folder.status,     // $3
                    folder.name,       // $4
                    folder.storage_path,// $5
                    folder.color,      // $6
                    folder.readed_at,  // $7
                    folder.updated_at, // $8
                    folder.deleted_at, // $9
                    folder.v,          // $10
                    expected_v         // $11
                )
                .execute(&mut **tx)
                .await?;
                
                if result.rows_affected() == 0 {    
                    let error_msg: String = format!(
                        "Version conflict for Folder {}: expected v={}, but not found in DB. Retrying...", 
                        folder.id, expected_v
                    );

                    warn!("{}", error_msg);
                    
                    return Err(error_msg.into());
                }

                Ok(())
            }
            _ => {
                warn!("No specific logic for event_type: {}", event.event_type);
                Ok(())
            }
        }
    }
}