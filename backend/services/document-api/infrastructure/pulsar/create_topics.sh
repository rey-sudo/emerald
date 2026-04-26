#!/bin/bash

docker exec -it broker bin/pulsar-admin topics delete-partitioned-topic \
  persistent://public/default/document-api.folder

docker exec -it broker bin/pulsar-admin topics delete-partitioned-topic \
  persistent://public/default/document-api.document



docker exec -it broker bash bin/pulsar-admin topics create-partitioned-topic \
  persistent://public/default/document-api.folder \
  --partitions 1

docker exec -it broker bash bin/pulsar-admin topics create-partitioned-topic \
  persistent://public/default/document-api.document \
  --partitions 1