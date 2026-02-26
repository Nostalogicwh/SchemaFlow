#!/bin/bash
#
# SchemaFlow 一键安装脚本
# 支持 macOS 和 Linux
#

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 打印信息
info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查命令是否存在
check_command() {
    if ! command -v "$1" &> /dev/null; then
        return 1
    fi
    return 0
}

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

info "SchemaFlow 安装程序"
info "项目目录: $PROJECT_ROOT"
echo ""

# 检查系统
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
else
    error "不支持的操作系统: $OSTYPE"
    exit 1
fi

info "检测到操作系统: $OS"

# 检查 Python
echo ""
info "检查 Python 环境..."
if check_command python3; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    info "Python 版本: $PYTHON_VERSION"
else
    error "未找到 Python3，请先安装 Python 3.10+"
    exit 1
fi

# 检查 Node.js
echo ""
info "检查 Node.js 环境..."
if check_command node; then
    NODE_VERSION=$(node --version | cut -d'v' -f2)
    info "Node.js 版本: $NODE_VERSION"
else
    error "未找到 Node.js，请先安装 Node.js 18+"
    exit 1
fi

# 检查 npm
if ! check_command npm; then
    error "未找到 npm，请确保 Node.js 安装完整"
    exit 1
fi

# 安装后端依赖
echo ""
info "安装后端依赖..."
cd "$PROJECT_ROOT/backend"

if [ ! -d ".venv" ]; then
    info "创建 Python 虚拟环境..."
    python3 -m venv .venv
fi

info "激活虚拟环境并安装依赖..."
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# 创建数据目录
info "创建数据目录..."
mkdir -p data/workflows
mkdir -p data/screenshots
mkdir -p data/logs
mkdir -p data/browser_states

# 检查 .env 文件
if [ ! -f ".env" ]; then
    warn ".env 文件不存在，从 .env.example 创建..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        info "已创建 .env 文件，请根据您的环境修改配置"
    else
        warn ".env.example 不存在，跳过"
    fi
fi

# 安装前端依赖
echo ""
info "安装前端依赖..."
cd "$PROJECT_ROOT/frontend"
npm install

# 构建前端
echo ""
info "构建前端应用..."
npm run build

echo ""
info "=================================="
info "SchemaFlow 安装完成！"
info "=================================="
echo ""
info "使用方法:"
echo "  1. 启动服务: ./scripts/start.sh"
echo "  2. 停止服务: ./scripts/stop.sh"
echo ""
info "配置文件:"
echo "  - 后端配置: backend/.env"
echo "  - 数据目录: backend/data/"
echo ""
