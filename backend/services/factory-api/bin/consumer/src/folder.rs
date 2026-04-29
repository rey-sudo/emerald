use crate::model::Folder;
use event_consumer::{application::consumer::MultiHandler, async_trait, model::EventEnveloped};
use sqlx::{Postgres, QueryBuilder, Transaction, postgres::PgQueryResult};
use std::error::Error;
use tracing::{info, warn};

/// This struct encapsulates the domain logic for the "folder" entity_type.
pub struct FolderHandler;

///This implementation allows FolderHandler to be used by the MultiHandler.
#[async_trait]
impl MultiHandler for FolderHandler {
    /// Determines if this handler should process a given entity_type.
    fn can_handle(&self, entity_type: &str) -> bool {
        entity_type == "folder"
    }

    /// Returns a human-readable name for the handler.
    fn name(&self) -> &str {
        return "FolderHandler";
    }

    /// Executes the core business logic for a specific event.
    async fn handle<'a>(
        &self,
        tx: &mut Transaction<'a, Postgres>,
        event: &EventEnveloped,
    ) -> std::result::Result<(), Box<dyn Error + Send + Sync>> {
        match event.event_type.as_str() {
            "folder.created" => {
                let folder: Folder = serde_json::from_value(event.data.clone())?;

                let insert_result: PgQueryResult = QueryBuilder::<Postgres>::new(
                    "INSERT INTO folders (
                        id, user_id, status, name, storage_path, color, created_at, readed_at, updated_at, deleted_at, v
                    )
                    VALUES (",
                )
                .push_bind(folder.id)
                .push(", ")
                .push_bind(folder.user_id)
                .push(", ")
                .push_bind(folder.status)
                .push(", ")
                .push_bind(folder.name)
                .push(", ")
                .push_bind(folder.storage_path)
                .push(", ")
                .push_bind(folder.color)
                .push(", ")
                .push_bind(folder.created_at)
                .push(", ")
                .push_bind(folder.readed_at)
                .push(", ")
                .push_bind(folder.updated_at)
                .push(", ")
                .push_bind(folder.deleted_at)
                .push(", ")
                .push_bind(folder.v)
                .push(")")
                .build()
                .execute(&mut **tx)
                .await?;

                if insert_result.rows_affected() == 0 {
                    let error_msg: String = format!(
                        "Error consuming event {}-{}-{}",
                        &event.event_type, folder.id, folder.v
                    );

                    warn!("{}", error_msg);
                    return Err(error_msg.into());
                }

                Ok(())
            }
            "folder.updated" => {
                let folder: Folder = serde_json::from_value(event.data.clone())?;

                let expected_v: i64 = folder.v - 1;

                let update_result: PgQueryResult = QueryBuilder::<Postgres>::new(
                    "UPDATE folders SET \
                        user_id = ",
                )
                .push_bind(folder.user_id)
                .push(", status = ")
                .push_bind(folder.status)
                .push(", name = ")
                .push_bind(folder.name)
                .push(", storage_path = ")
                .push_bind(folder.storage_path)
                .push(", color = ")
                .push_bind(folder.color)
                .push(", created_at = ")
                .push_bind(folder.created_at)                
                .push(", readed_at = ")
                .push_bind(folder.readed_at)
                .push(", updated_at = ")
                .push_bind(folder.updated_at)
                .push(", deleted_at = ")
                .push_bind(folder.deleted_at)
                .push(", v = ")
                .push_bind(folder.v)
                .push(" WHERE id = ")
                .push_bind(folder.id)
                .push(" AND v = ")
                .push_bind(expected_v)
                .build()
                .execute(&mut **tx)
                .await?;

                if update_result.rows_affected() == 0 {
                    let error_msg: String = format!(
                        "Error consuming event {}-{}-{}",
                        &event.event_type, folder.id, folder.v
                    );

                    warn!("{}", error_msg);
                    return Err(error_msg.into());
                }

                Ok(())
            }
            "folder.deleted" => {
                let folder: Folder = serde_json::from_value(event.data.clone())?;

                let expected_v: i64 = folder.v - 1;

                let delete_result: PgQueryResult = QueryBuilder::<Postgres>::new(
                    "UPDATE folders SET \
                        user_id = ",
                )
                .push_bind(folder.user_id)
                .push(", status = ")
                .push_bind(folder.status)
                .push(", name = ")
                .push_bind(folder.name)
                .push(", storage_path = ")
                .push_bind(folder.storage_path)
                .push(", color = ")
                .push_bind(folder.color)
                .push(", created_at = ")
                .push_bind(folder.created_at)                
                .push(", readed_at = ")
                .push_bind(folder.readed_at)
                .push(", updated_at = ")
                .push_bind(folder.updated_at)
                .push(", deleted_at = ")
                .push_bind(folder.deleted_at)
                .push(", v = ")
                .push_bind(folder.v)
                .push(" WHERE id = ")
                .push_bind(folder.id)
                .push(" AND v = ")
                .push_bind(expected_v)
                .build()
                .execute(&mut **tx)
                .await?;

                if delete_result.rows_affected() == 0 {
                    let error_msg: String = format!(
                        "Error consuming event {}-{}-{}",
                        &event.event_type, folder.id, folder.v
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
