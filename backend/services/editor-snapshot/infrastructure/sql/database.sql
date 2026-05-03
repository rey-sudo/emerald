SELECT 'CREATE DATABASE editor_snapshot'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'editor_snapshot')\gexec

\c editor_snapshot

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";