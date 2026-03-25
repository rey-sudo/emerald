#!/usr/bin/env bash

SERVICES=("api-document")

DB_URL="postgres://postgres:password@localhost:5432"

for SERVICE in "${SERVICES[@]}"; do
    echo "----------------------------------------------"
    echo "Applying DATABASE.SQL for service: $SERVICE..."
    echo "----------------------------------------------"

    SQL_PATH="services/$SERVICE/infrastructure/sql"
    
    if [ -d "$SQL_PATH" ]; then
        for file in "$SQL_PATH"/database.sql; do
            psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$file"
        done
    else
        echo "Warning: Directory $SQL_PATH not found. Skipping..."
    fi
done


for SERVICE in "${SERVICES[@]}"; do
    echo "--------------------------------------------"
    echo "Applying SQL tables for service: $SERVICE..."
    echo "--------------------------------------------"

    SQL_PATH="services/$SERVICE/infrastructure/sql"
    
    if [ -d "$SQL_PATH" ]; then
        for file in "$SQL_PATH"/*.sql; do
            psql "$DB_URL/${SERVICE//-/_}" -v ON_ERROR_STOP=1 -f "$file"
        done
    else
        echo "Warning: Directory $SQL_PATH not found. Skipping..."
    fi
done


echo "All SQL migrations finished."