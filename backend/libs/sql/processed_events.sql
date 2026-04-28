CREATE TABLE IF NOT EXISTS processed_events (
    event_id UUID PRIMARY KEY,
    created_at BIGINT NOT NULL
);

CREATE INDEX idx_processed_events_created_at ON processed_events (created_at);