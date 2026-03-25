CREATE TABLE
    IF NOT EXISTS documents (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL,
        folder_id UUID NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        internal_name VARCHAR(255) NOT NULL,
        content_type VARCHAR(100) NOT NULL,
        file_size BIGINT NOT NULL CHECK (file_size >= 0),
        checksum BYTEA NOT NULL,
        metadata JSONB DEFAULT NULL,
        
        created_at BIGINT DEFAULT NULL,
        readed_at BIGINT DEFAULT NULL,
        updated_at BIGINT DEFAULT NULL,
        deleted_at BIGINT DEFAULT NULL,
        v BIGINT NOT NULL
    );

CREATE INDEX idx_documents_user_id ON documents (user_id);
CREATE INDEX idx_documents_folder_id ON documents (folder_id);
CREATE INDEX idx_documents_user_folder ON documents (user_id, folder_id);