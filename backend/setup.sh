#!/bin/bash
# 初始化后端开发环境：创建 venv、安装依赖、安装 Playwright 浏览器
cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
    echo "创建虚拟环境..."
    python3 -m venv .venv
fi

source .venv/bin/activate
echo "安装 Python 依赖..."
pip install -r requirements.txt
echo "安装 Playwright Chromium..."
playwright install chromium
echo "环境初始化完成"
