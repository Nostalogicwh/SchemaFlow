# SchemaFlow Dockerfile
# 多阶段构建：前端构建 + 后端运行

# ========== 阶段1: 前端构建 ==========
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# 复制前端依赖文件
COPY frontend/package*.json ./
RUN npm ci

# 复制前端源码并构建
COPY frontend/ ./
RUN npm run build

# ========== 阶段2: 后端运行 ==========
FROM python:3.12-slim AS backend

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# 创建虚拟环境
RUN python -m venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"

# 复制后端依赖
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 复制后端源码
COPY backend/ ./

# 创建数据目录
RUN mkdir -p data/workflows data/screenshots data/logs data/browser_states

# 复制前端构建产物
COPY --from=frontend-builder /app/frontend/dist /app/static

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
