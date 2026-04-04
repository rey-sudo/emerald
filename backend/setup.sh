#!/bin/bash

echo "Running dev env..."

chmod +x ./z/dev/postgres/run.sh
chmod +x ./z/dev/pulsar/run.sh
chmod +x ./z/dev/seaweed/run.sh
chmod +x ./z/dev/redis/run.sh

./z/dev/postgres/run.sh
./z/dev/pulsar/run.sh
./z/dev/seaweed/run.sh
./z/dev/redis/run.sh
