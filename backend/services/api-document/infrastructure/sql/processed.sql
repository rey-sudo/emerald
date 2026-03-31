CREATE TABLE processed (
    id UUID PRIMARY KEY,
    consumer_group VARCHAR(255) NOT NULL,
    event_id UUID NOT NULL,
    processed_at BIGINT NOT NULL,
    status VARCHAR(50) NOT NULL,

    CONSTRAINT unique_event_per_consumer UNIQUE (consumer_group, event_id)
);


CREATE INDEX idx_processed_time ON processed (processed_at);

CREATE INDEX idx_processed_group_status ON processed (consumer_group, status);