#!/usr/bin/env bash

set -e

echo "Running DEV env"

env_file=".env"

if [ -f "$env_file" ]; then
  echo "Loading env file: $env_file"
  export $(grep -v '^#' "$env_file" | xargs)
else
  echo "Error: $env_file not found."
fi

if [ -d ".venv" ]; then
  echo "Starting venv"
  source .venv/bin/activate
fi

if [[ "$1" == "-c" ]]; then
  docker compose up --build -d
else
  docker compose down
fi

docker compose up --build -d

echo "🌐 Server: http://$APP_HOST:$APP_PORT"
exec uvicorn main:app \
  --host "$APP_HOST" \
  --port "$APP_PORT" \
  --reload 




