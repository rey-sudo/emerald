#!/usr/bin/env bash

set -e

echo "Running DEV env"

WORKDIR=$(pwd)

env_file=".env"

#=====================================================================

if [ -f "$env_file" ]; then
  echo "Loading env file: $env_file"
  export $(grep -v '^#' "$env_file" | xargs)
else
  echo "Error: $env_file not found."
fi

#=====================================================================

if [[ "$1" == "-c" ]]; then
  docker compose up --build -d
else
  docker compose down
fi

#=====================================================================

cleanup() {
    echo "Stopping dev..."

    trap - SIGINT SIGTERM
    
    kill $(jobs -p) 2>/dev/null || true

    sleep 1
    pkill -P $$

    pkill -f "src/infrastructure/publisher/target/debug" || true
    pkill -9 -f target/debug/publisher || true

    exit 0
}

trap cleanup SIGINT

echo "Running dev"

cd "src/infrastructure/publisher"

cargo run &

cd $WORKDIR

echo "🌐 Server: http://$HOST:$PORT"

npm run dev

wait






