#!/usr/bin/env sh
set -eu
echo "M01 联调验证入口"
echo "1. 后端构建与测试"
echo "2. 前端 Build / Type Check / Test"
echo "3. GET /v1/models"
echo "4. POST /v1/chat/completions (stream=false)"
echo "5. x-request-id 与 Request/Attempt 追踪"
echo "6. 真实Provider验证仅在提供有效DEV凭证后执行"
echo "本脚本当前为统一验证入口，具体命令由真实工程导入后补齐。"
