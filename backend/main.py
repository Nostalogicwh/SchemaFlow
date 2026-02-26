"""SchemaFlow 后端主入口。"""

import logging
import sys
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.exceptions import RequestValidationError

# 配置日志系统
from config import setup_logging

setup_logging(level="INFO")

logger = logging.getLogger(__name__)

sys.path.insert(0, str(Path(__file__).parent))

from api import workflows, actions, execution, ai_generate
from api.exceptions import APIException

# 创建 FastAPI 应用
app = FastAPI(
    title="SchemaFlow",
    description="Web 自动化平台 - 结合 AI 智能编排和可视化工作流编辑",
    version="0.1.0",
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


@app.exception_handler(APIException)
async def api_exception_handler(request: Request, exc: APIException):
    logger.warning(f"API异常: {exc.code} - {exc.message}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error": {"code": exc.code, "message": exc.message}},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for error in exc.errors():
        errors.append(
            {
                "field": ".".join(str(loc) for loc in error["loc"]),
                "message": error["msg"],
            }
        )
    logger.warning(f"验证错误: {errors}")
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "请求参数验证失败",
                "details": errors,
            },
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.exception(f"未处理的异常: {type(exc).__name__}: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {"code": "INTERNAL_ERROR", "message": "服务器内部错误"},
        },
    )


@app.get("/")
async def root():
    """根路径。"""
    return {"name": "SchemaFlow", "version": "0.1.0", "description": "Web 自动化平台"}


@app.get("/health")
async def health():
    """健康检查。"""
    return {"status": "ok"}


@app.get("/api/screenshots/{workflow_id}/{filename}")
async def get_screenshot(workflow_id: str, filename: str):
    """获取截图文件。"""
    # 使用相对于后端根目录的 data 目录
    data_dir = Path(__file__).parent / "data"
    screenshot_path = data_dir / "screenshots" / workflow_id / filename

    if not screenshot_path.exists():
        return JSONResponse(
            status_code=404,
            content={
                "success": False,
                "error": {"code": "NOT_FOUND", "message": "截图文件不存在"},
            },
        )

    return FileResponse(screenshot_path, media_type="image/jpeg")


if __name__ == "__main__":
    import uvicorn
    from config import get_settings

    server_cfg = get_settings()["server"]

    # 配置 uvicorn 日志
    log_config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S",
            }
        },
        "handlers": {
            "default": {
                "formatter": "default",
                "class": "logging.StreamHandler",
                "stream": "ext://sys.stdout",
            }
        },
        "loggers": {
            "uvicorn": {"handlers": ["default"], "level": "INFO"},
            "uvicorn.access": {"handlers": ["default"], "level": "INFO"},
        },
    }

    uvicorn.run(
        "main:app",
        host=server_cfg["host"],
        port=server_cfg["port"],
        reload=True,
        log_config=log_config,
    )
