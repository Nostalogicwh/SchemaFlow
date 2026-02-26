#!/bin/bash
#
# SchemaFlow 停止脚本
# 停止前后端服务
#

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# PID文件目录
PID_DIR="$PROJECT_ROOT/.pids"

# 停止服务
stop_service() {
    local name="$1"
    local pid_file="$PID_DIR/${name}.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            info "停止 ${name} 服务 (PID: $pid)..."
            kill "$pid" 2> /dev/null || true
            
            # 等待进程结束
            local count=0
            while ps -p "$pid" > /dev/null 2>&1 && [ $count -lt 10 ]; do
                sleep 1
                count=$((count + 1))
            done
            
            # 强制结束
            if ps -p "$pid" > /dev/null 2>&1; then
                warn "强制停止 ${name} 服务..."
                kill -9 "$pid" 2> /dev/null || true
            fi
            
            info "${name} 服务已停止"
        else
            warn "${name} 服务未在运行"
        fi
        rm -f "$pid_file"
    else
        warn "未找到 ${name} 服务的 PID 文件"
    fi
}

# 主函数
main() {
    info "SchemaFlow 停止程序"
    echo ""
    
    # 检查参数
    STOP_BACKEND=true
    STOP_FRONTEND=true
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --backend-only)
                STOP_FRONTEND=false
                shift
                ;;
            --frontend-only)
                STOP_BACKEND=false
                shift
                ;;
            --help|-h)
                echo "用法: $0 [选项]"
                echo ""
                echo "选项:"
                echo "  --backend-only    仅停止后端服务"
                echo "  --frontend-only   仅停止前端服务"
                echo "  --help, -h        显示帮助信息"
                exit 0
                ;;
            *)
                error "未知选项: $1"
                exit 1
                ;;
        esac
    done
    
    # 停止服务
    if [ "$STOP_BACKEND" = true ]; then
        stop_service "backend"
    fi
    
    if [ "$STOP_FRONTEND" = true ]; then
        stop_service "frontend"
    fi
    
    echo ""
    info "所有服务已停止"
}

main "$@"
