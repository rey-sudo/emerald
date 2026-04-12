CREATE TABLE
    IF NOT EXISTS drafts (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL,
        document_id UUID NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        content_binary BYTEA NOT NULL,

        created_at BIGINT DEFAULT NULL,
        readed_at BIGINT DEFAULT NULL,
        updated_at BIGINT DEFAULT NULL,
        deleted_at BIGINT DEFAULT NULL,
        v BIGINT NOT NULL
    );

CREATE INDEX idx_drafts_user_id    ON drafts(user_id);
CREATE INDEX idx_drafts_deleted_at ON drafts(deleted_at);
CREATE INDEX idx_drafts_created_at ON drafts(created_at DESC);
CREATE VIEW active_drafts AS
    SELECT * FROM drafts WHERE deleted_at IS NULL;