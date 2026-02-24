"""持久化层模块。

合并了原有的 repository（执行记录）和 storage（工作流存储）模块。
提供统一的存储抽象和实现。
"""

from .base import StorageBase, ExecutionRepository
from .file_storage import JSONFileStorage
from .json_store import JSONExecutionRepository

__all__ = [
    "StorageBase",
    "ExecutionRepository",
    "JSONFileStorage",
    "JSONExecutionRepository",
    "get_execution_repo",
]


def get_execution_repo() -> ExecutionRepository:
    """获取执行记录仓储实例（向后兼容）。

    注意：推荐使用 dependencies.get_execution_repo() 进行依赖注入。
    """
    from dependencies import get_execution_repo as _get_repo

    return _get_repo()
