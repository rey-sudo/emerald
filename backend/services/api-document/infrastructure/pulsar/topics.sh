#!/bin/bash

docker exec -it broker bash bin/pulsar-admin topics create-partitioned-topic \
  persistent://public/default/api-documents.folders \
  --partitions 8

docker exec -it broker bash bin/pulsar-admin topics create-partitioned-topic \
  persistent://public/default/api-documents.documents \
  --partitions 8