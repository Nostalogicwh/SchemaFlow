"""执行记录仓储模块。"""
from typing import Optional
from .base import ExecutionRepository
from .json_repository import JSONExecutionRepository

# 全局仓储实例（工厂函数，后续切换数据库只需修改此处）
_repo_instance: Optional[ExecutionRepository] = None


def get_execution_repo() -> ExecutionRepository:
    """获取执行记录仓储实例。"""
    global _repo_instance
    if _repo_instance is None:
        _repo_instance = JSONExecutionRepository()
    return _repo_instance
