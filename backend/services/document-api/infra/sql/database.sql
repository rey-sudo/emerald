SELECT 'CREATE DATABASE document_api'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'document_api')\gexec

\c document_api

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";