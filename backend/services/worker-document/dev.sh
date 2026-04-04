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

export DENO_INSTALL="$HOME/.deno"
export PATH="$DENO_INSTALL/bin:$PATH"


cleanup() {
    echo "Stopping dev..."
    kill $(jobs -p)
    exit
}

trap cleanup SIGINT

echo "Running dev"
python -u main.py &
deno run -A ./infrastructure/consumer/server/main.ts &

wait