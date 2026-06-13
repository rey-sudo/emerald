#!/bin/bash

docker exec -it broker bin/pulsar-admin topics delete \
  persistent://public/default/document.processed


docker exec -it broker bash bin/pulsar-admin topics create-partitioned-topic \
  persistent://public/default/document.processed \
  --partitions 1

