#!/bin/bash

docker exec -it broker bin/pulsar-admin topics delete \
  persistent://public/default/chunk.created



docker exec -it broker bash bin/pulsar-admin topics create-partitioned-topic \
  persistent://public/default/chunk.created \
  --partitions 1

