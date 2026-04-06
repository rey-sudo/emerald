CREATE TABLE
    IF NOT EXISTS folders (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL,
        status VARCHAR(20),
        name VARCHAR(100) NOT NULL,
        storage_path TEXT NOT NULL,
        color VARCHAR(10) NOT NULL,
        
        created_at BIGINT DEFAULT NULL,
        readed_at BIGINT DEFAULT NULL,
        updated_at BIGINT DEFAULT NULL,
        deleted_at BIGINT DEFAULT NULL,
        v BIGINT NOT NULL
    );

CREATE INDEX idx_folders_user_id ON folders (user_id);