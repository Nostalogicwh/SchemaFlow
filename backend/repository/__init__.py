"""执行记录仓储模块。"""
from .base import ExecutionRepository
from .json_repository import JSONExecutionRepository

__all__ = ["ExecutionRepository", "JSONExecutionRepository", "get_execution_repo"]


def get_execution_repo() -> ExecutionRepository:
    """获取执行记录仓储实例（向后兼容）。

    注意：推荐使用 dependencies.get_execution_repo() 进行依赖注入。
    """
    from dependencies import get_execution_repo as _get_repo
    return _get_repo()
