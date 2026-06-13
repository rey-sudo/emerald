SELECT 'CREATE DATABASE document_transform'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'document_transform')\gexec

\c document_transform

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";