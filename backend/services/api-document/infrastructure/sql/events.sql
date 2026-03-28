CREATE TABLE events (
    specversion    BIGINT       NOT NULL,
    type           VARCHAR(255) NOT NULL,     
    source         VARCHAR(255) NOT NULL,      
    id             UUID         PRIMARY KEY,      
    time           BIGINT       DEFAULT NULL,
    entity_type    VARCHAR(255) NOT NULL,             
    entity_id      VARCHAR(255) NOT NULL,                           
    data           JSONB        NOT NULL,

    metadata       JSONB        NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_events_created_at     ON events (created_at);
CREATE INDEX idx_events_entity         ON events (entity_type, entity_id);
CREATE INDEX idx_events_type           ON events (type, created_at);

