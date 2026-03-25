#!/usr/bin/env bash

set -e

echo "Running DEV env"

if [ -f ".env.dev" ]; then
  echo "Loading .env.dev"
  export $(grep -v '^#' .env.dev | xargs)
fi

if [ -d ".venv" ]; then
  echo "Starting venv"
  source .venv/bin/activate
fi

echo "🌐 Server: http://$APP_HOST:$APP_PORT"

exec uvicorn main:app \
  --host "$APP_HOST" \
  --port "$APP_PORT" \
  --reload 




