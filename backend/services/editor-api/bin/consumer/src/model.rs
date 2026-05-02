use uuid::Uuid;

/// Represents the 'document' table in the database.
#[derive(serde::Deserialize, sqlx::FromRow, Debug)]
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

/// Represents the 'folders' table in the database.
#[derive(serde::Deserialize, sqlx::FromRow, Debug)]
pub struct Folder {
    pub id: Uuid,
    pub user_id: Uuid,
    pub status: String,
    pub name: String,
    pub storage_path: String,
    pub color: String,
    pub created_at: Option<i64>,
    pub readed_at: Option<i64>,
    pub updated_at: Option<i64>,
    pub deleted_at: Option<i64>,
    pub v: i64,
}
