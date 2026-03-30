#!/bin/bash

export $(grep -v '^#' ./infrastructure/publisher/.env | xargs)

cargo install event_publisher && RUST_LOG=info event_publisher