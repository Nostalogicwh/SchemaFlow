#!/bin/bash
# 激活 venv 并启动后端服务
cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
    echo "未找到虚拟环境，请先执行 bash setup.sh"
    exit 1
fi

source .venv/bin/activate
python main.py
