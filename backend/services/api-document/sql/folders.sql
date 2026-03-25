CREATE TABLE
    IF NOT EXISTS folders (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL,
        status VARCHAR(20),
        name VARCHAR(100) NOT NULL,
        storage_path TEXT NOT NULL,
        
        created_at TIMESTAMP DEFAULT NULL,
        readed_at TIMESTAMP DEFAULT NULL,
        updated_at TIMESTAMP DEFAULT NULL,
        deleted_at TIMESTAMP DEFAULT NULL,
        v BIGINT NOT NULL
    );

CREATE INDEX idx_folders_user_id ON folders (user_id);