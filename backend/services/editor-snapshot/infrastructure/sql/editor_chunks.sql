CREATE TABLE IF NOT EXISTS editor_chunks (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL,
    status VARCHAR(100) NOT NULL,
    data TEXT NOT NULL,
    source VARCHAR(100) NOT NULL,
    created_at BIGINT NOT NULL,
    processed_at BIGINT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_chunks_affinity_status 
ON editor_chunk (document_id, status) 
WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_chunks_created_at 
ON editor_chunk (created_at);