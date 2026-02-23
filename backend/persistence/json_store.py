"""基于 JSON 文件的执行记录存储实现。"""

import json
import os
import aiofiles
from typing import Optional

from .base import ExecutionRepository


class JSONExecutionRepository(ExecutionRepository):
    """JSON 文件实现的执行记录仓储。

    数据目录：data/db/executions/
    每个工作流只保留最新一条记录，文件名为 {workflow_id}.json。
    """

    def __init__(self, base_dir: str = "data/db/executions"):
        self.base_dir = base_dir
        os.makedirs(base_dir, exist_ok=True)

    def _get_path(self, workflow_id: str) -> str:
        return os.path.join(self.base_dir, f"{workflow_id}.json")

    async def save_execution(self, execution: dict) -> None:
        """保存执行记录（原子写入，按 workflow_id 覆盖）。"""
        workflow_id = execution["workflow_id"]
        path = self._get_path(workflow_id)
        tmp_path = path + ".tmp"
        async with aiofiles.open(tmp_path, "w", encoding="utf-8") as f:
            await f.write(json.dumps(execution, ensure_ascii=False, indent=2))
        os.replace(tmp_path, path)

    async def get_latest_execution(self, workflow_id: str) -> Optional[dict]:
        """获取工作流最近一次执行记录。"""
        path = self._get_path(workflow_id)
        if not os.path.exists(path):
            return None
        async with aiofiles.open(path, "r", encoding="utf-8") as f:
            content = await f.read()
        return json.loads(content)

    async def delete_execution(self, workflow_id: str) -> bool:
        """删除工作流的执行记录。"""
        path = self._get_path(workflow_id)
        if os.path.exists(path):
            os.remove(path)
            return True
        return False
