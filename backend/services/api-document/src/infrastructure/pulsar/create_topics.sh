#!/bin/bash

docker exec -it broker bin/pulsar-admin topics delete-partitioned-topic \
  persistent://public/default/api-document.folder

docker exec -it broker bin/pulsar-admin topics delete-partitioned-topic \
  persistent://public/default/api-document.document



docker exec -it broker bash bin/pulsar-admin topics create-partitioned-topic \
  persistent://public/default/api-document.folder \
  --partitions 1

docker exec -it broker bash bin/pulsar-admin topics create-partitioned-topic \
  persistent://public/default/api-document.document \
  --partitions 1