"""FastAPI 依赖注入提供者。"""

from functools import lru_cache

from engine.executor import WorkflowExecutor
from persistence.file_storage import JSONFileStorage
from persistence.base import ExecutionRepository
from persistence.json_store import JSONExecutionRepository
from api.websocket import ConnectionManager


@lru_cache()
def get_executor() -> WorkflowExecutor:
    """获取工作流执行器实例。

    Returns:
        WorkflowExecutor 单例实例
    """
    return WorkflowExecutor()


@lru_cache()
def get_storage() -> JSONFileStorage:
    """获取存储实例。

    Returns:
        JSONFileStorage 单例实例
    """
    return JSONFileStorage()


@lru_cache()
def get_ws_manager() -> ConnectionManager:
    """获取 WebSocket 连接管理器实例。

    Returns:
        ConnectionManager 单例实例
    """
    return ConnectionManager()


@lru_cache()
def get_execution_repo() -> ExecutionRepository:
    """获取执行记录仓储实例。

    Returns:
        ExecutionRepository 单例实例
    """
    return JSONExecutionRepository()
