SELECT 'CREATE DATABASE document_processor'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'document_processor')\gexec

\c document_processor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";