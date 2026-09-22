#!/usr/bin/env sh
set -eu
echo "启动 HA AI 本地基础环境（MySQL 8 + Redis）"
docker compose -f deploy/docker/docker-compose.dev.yml up -d
echo "基础环境已启动。前端和后端请在各自 worktree 中分别启动。"
