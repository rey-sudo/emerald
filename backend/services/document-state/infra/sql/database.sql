SELECT 'CREATE DATABASE document_state'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'document_state')\gexec

\c document_state

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";