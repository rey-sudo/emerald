#!/bin/bash

export $(grep -v '^#' ./infrastructure/publisher/.env.dev | xargs)

if ! command -v event_publisher &> /dev/null; then
    echo "📦 Installing event_publisher from crates.io..."
    cargo install event_publisher 
fi

RUST_LOG=info event_publisher