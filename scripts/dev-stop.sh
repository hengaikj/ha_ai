#!/usr/bin/env sh
set -eu
echo "停止 HA AI 本地基础环境"
docker compose -f deploy/docker/docker-compose.dev.yml down
