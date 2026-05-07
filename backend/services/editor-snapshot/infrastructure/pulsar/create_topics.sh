#!/bin/bash

docker exec -it broker bin/pulsar-admin topics delete \
  persistent://public/default/snapshot.created


docker exec -it broker bash bin/pulsar-admin topics create-partitioned-topic \
  persistent://public/default/snapshot.created \
  --partitions 1

