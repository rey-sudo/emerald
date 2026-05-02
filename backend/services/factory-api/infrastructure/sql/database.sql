SELECT 'CREATE DATABASE editor_api'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'editor_api')\gexec

\c editor_api

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


