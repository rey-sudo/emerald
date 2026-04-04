#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

cd "$DIR"

COMMAND="docker compose"

echo "Running Redis BullMQ with $COMMAND from $DIR..."

$COMMAND up -d

echo "Redis BullMQ launched"
