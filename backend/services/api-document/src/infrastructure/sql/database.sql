SELECT 'CREATE DATABASE api_document'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'api_document')\gexec

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


