CREATE TABLE
    IF NOT EXISTS documents (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL,
        folder_id UUID NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        internal_name VARCHAR(255) NOT NULL,
        content_type VARCHAR(100) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
        storage_path TEXT NOT NULL,
        status VARCHAR(30) DEFAULT 'pending' NOT NULL,
        checksum VARCHAR(255) DEFAULT NULL,
        context TEXT DEFAULT NULL,
        keywords TEXT DEFAULT NULL,
        metadata JSONB DEFAULT NULL,
        created_at BIGINT DEFAULT NULL,
        readed_at BIGINT DEFAULT NULL,
        updated_at BIGINT DEFAULT NULL,
        deleted_at BIGINT DEFAULT NULL,
        v BIGINT NOT NULL
    );

CREATE INDEX idx_documents_folder_id ON documents (folder_id)
WHERE
    deleted_at IS NULL;

CREATE INDEX idx_documents_active_records ON documents (user_id, folder_id)
WHERE
    deleted_at IS NULL;

CREATE INDEX idx_documents_pending ON documents (user_id)
WHERE
    status = 'pending';