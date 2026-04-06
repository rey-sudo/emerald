SELECT 'CREATE DATABASE api_factory'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'api_factory')\gexec

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


