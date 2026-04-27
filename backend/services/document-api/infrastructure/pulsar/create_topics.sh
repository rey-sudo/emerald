#!/bin/bash

docker exec -it broker bin/pulsar-admin topics delete \
  persistent://public/default/folder.created

docker exec -it broker bin/pulsar-admin topics delete \
  persistent://public/default/document.created



docker exec -it broker bash bin/pulsar-admin topics create-partitioned-topic \
  persistent://public/default/folder.created \
  --partitions 1

docker exec -it broker bash bin/pulsar-admin topics create-partitioned-topic \
  persistent://public/default/document.created \
  --partitions 1