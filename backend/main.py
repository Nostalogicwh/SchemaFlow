"""SchemaFlow 后端主入口。"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import sys

# 添加当前目录到路径
sys.path.insert(0, str(Path(__file__).parent))

# 导入 API 路由
from api import workflows, actions, execution, ai_generate

# 导入动作节点以触发注册
from engine.actions import base, browser, data, control

# 创建 FastAPI 应用
app = FastAPI(
    title="SchemaFlow",
    description="Web 自动化平台 - 结合 AI 智能编排和可视化工作流编辑",
    version="0.1.0"
)

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应限制具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(workflows.router)
app.include_router(actions.router)
app.include_router(execution.router)
app.include_router(ai_generate.router)


@app.get("/")
async def root():
    """根路径。"""
    return {
        "name": "SchemaFlow",
        "version": "0.1.0",
        "description": "Web 自动化平台"
    }


@app.get("/health")
async def health():
    """健康检查。"""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    from config import get_settings

    server_cfg = get_settings()["server"]
    uvicorn.run(
        "main:app",
        host=server_cfg["host"],
        port=server_cfg["port"],
        reload=True
    )
