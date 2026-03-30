#!/bin/bash

docker exec -it broker bash bin/pulsar-admin topics create-partitioned-topic \
  persistent://public/default/api-document.folder \
  --partitions 8

docker exec -it broker bash bin/pulsar-admin topics create-partitioned-topic \
  persistent://public/default/api-document.document \
  --partitions 8