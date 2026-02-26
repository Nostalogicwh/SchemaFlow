#!/bin/bash
#
# SchemaFlow 启动脚本
# 启动前后端服务
#

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

detail() {
    echo -e "${BLUE}[DETAIL]${NC} $1"
}

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# PID文件目录
PID_DIR="$PROJECT_ROOT/.pids"
mkdir -p "$PID_DIR"

# 检查服务是否已在运行
check_running() {
    local pid_file="$1"
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0
        fi
    fi
    return 1
}

# 启动后端
start_backend() {
    info "启动后端服务..."
    
    if check_running "$PID_DIR/backend.pid"; then
        warn "后端服务已在运行 (PID: $(cat "$PID_DIR/backend.pid"))"
        return 0
    fi
    
    cd "$PROJECT_ROOT/backend"
    
    # 检查虚拟环境
    if [ ! -d ".venv" ]; then
        error "虚拟环境不存在，请先运行 ./scripts/install.sh"
        exit 1
    fi
    
    # 激活虚拟环境并启动
    source .venv/bin/activate
    
    # 启动后端服务
    nohup python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload > "$PROJECT_ROOT/backend/server.log" 2>&1 &
    echo $! > "$PID_DIR/backend.pid"
    
    # 等待服务启动
    sleep 2
    
    if check_running "$PID_DIR/backend.pid"; then
        info "后端服务已启动 (PID: $(cat "$PID_DIR/backend.pid"))"
        detail "日志文件: backend/server.log"
        detail "API地址: http://localhost:8000"
    else
        error "后端服务启动失败，请检查日志"
        exit 1
    fi
}

# 启动前端
start_frontend() {
    info "启动前端服务..."
    
    if check_running "$PID_DIR/frontend.pid"; then
        warn "前端服务已在运行 (PID: $(cat "$PID_DIR/frontend.pid"))"
        return 0
    fi
    
    cd "$PROJECT_ROOT/frontend"
    
    # 检查node_modules
    if [ ! -d "node_modules" ]; then
        error "前端依赖未安装，请先运行 ./scripts/install.sh"
        exit 1
    fi
    
    # 启动前端服务
    nohup npm run dev > "$PROJECT_ROOT/frontend/server.log" 2>&1 &
echo $! > "$PID_DIR/frontend.pid"
    
    # 等待服务启动
    sleep 3
    
    if check_running "$PID_DIR/frontend.pid"; then
        info "前端服务已启动 (PID: $(cat "$PID_DIR/frontend.pid"))"
        detail "日志文件: frontend/server.log"
        detail "访问地址: http://localhost:5173"
    else
        error "前端服务启动失败，请检查日志"
        exit 1
    fi
}

# 主函数
main() {
    info "SchemaFlow 启动程序"
    info "项目目录: $PROJECT_ROOT"
    echo ""
    
    # 检查参数
    START_BACKEND=true
    START_FRONTEND=true
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --backend-only)
                START_FRONTEND=false
                shift
                ;;
            --frontend-only)
                START_BACKEND=false
                shift
                ;;
            --help|-h)
                echo "用法: $0 [选项]"
                echo ""
                echo "选项:"
                echo "  --backend-only    仅启动后端服务"
                echo "  --frontend-only   仅启动前端服务"
                echo "  --help, -h        显示帮助信息"
                exit 0
                ;;
            *)
                error "未知选项: $1"
                exit 1
                ;;
        esac
    done
    
    # 启动服务
    if [ "$START_BACKEND" = true ]; then
        start_backend
        echo ""
    fi
    
    if [ "$START_FRONTEND" = true ]; then
        start_frontend
        echo ""
    fi
    
    info "=================================="
    info "所有服务已启动！"
    info "=================================="
    echo ""
    detail "访问 http://localhost:5173 使用 SchemaFlow"
    detail "停止服务: ./scripts/stop.sh"
    echo ""
}

main "$@"
