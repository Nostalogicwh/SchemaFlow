"""执行记录仓储抽象基类，预留数据库切换能力。"""
from abc import ABC, abstractmethod
from typing import Optional


class ExecutionRepository(ABC):
    """执行记录仓储抽象。

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
