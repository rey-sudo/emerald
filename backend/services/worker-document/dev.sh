#!/usr/bin/env bash

set -e

echo "Running DEV env"

WORKDIR=$(pwd)

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

cd "infrastructure/consumer"

deno run -A ./server/main.ts &
cargo run &

cd $WORKDIR

python -u main.py &

wait