SELECT 'CREATE DATABASE api_editor'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'api_editor')\gexec

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


