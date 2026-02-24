"""持久化层抽象基类。

合并了原有的 StorageBase（工作流存储）和 ExecutionRepository（执行记录存储）。
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional


class StorageBase(ABC):
    """工作流存储抽象基类。

    提供工作流和执行日志的 CRUD 操作接口。
    当前由 JSONFileStorage 实现，后续可替换为数据库实现。
    """

    @abstractmethod
    async def save_workflow(self, workflow: Dict[str, Any]) -> str:
        """保存工作流并返回 workflow_id。"""
        pass

    @abstractmethod
    async def get_workflow(self, workflow_id: str) -> Optional[Dict[str, Any]]:
        """根据 ID 获取工作流。"""
        pass

    @abstractmethod
    async def list_workflows(
        self, skip: int = 0, limit: int = 100
    ) -> List[Dict[str, Any]]:
        """分页列出工作流。"""
        pass

    @abstractmethod
    async def delete_workflow(self, workflow_id: str) -> bool:
        """根据 ID 删除工作流。"""
        pass

    @abstractmethod
    async def save_execution_log(self, log: Dict[str, Any]) -> str:
        """保存执行日志并返回 execution_id。"""
        pass

    @abstractmethod
    async def get_execution_log(self, execution_id: str) -> Optional[Dict[str, Any]]:
        """根据 ID 获取执行日志。"""
        pass

    @abstractmethod
    async def list_execution_logs(
        self, workflow_id: str, skip: int = 0, limit: int = 100
    ) -> List[Dict[str, Any]]:
        """分页列出工作流的执行日志。"""
        pass


class ExecutionRepository(ABC):
    """执行记录仓储抽象基类。

    当前由 JSONExecutionRepository 实现（JSON 文件存储），
    后续可替换为数据库实现，只需继承此类并实现抽象方法。
    """

    @abstractmethod
    async def save_execution(self, execution: dict) -> None:
        """保存执行记录（按 workflow_id 覆盖，只保留最新一条）。"""
        ...

    @abstractmethod
    async def get_latest_execution(self, workflow_id: str) -> Optional[dict]:
        """获取工作流最近一次执行记录。"""
        ...

    @abstractmethod
    async def delete_execution(self, workflow_id: str) -> bool:
        """删除工作流的执行记录。"""
        ...
