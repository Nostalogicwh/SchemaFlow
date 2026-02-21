"""基于本地 JSON 文件的存储实现。"""
import aiofiles
import json
import os
import tempfile
import uuid
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime

from .base import StorageBase


class JSONFileStorage(StorageBase):
    """基于本地 JSON 文件的存储实现。"""

    def __init__(self, base_dir: str = "./data"):
        """初始化文件存储。

        Args:
            base_dir: 基础目录路径
        """
        self.base_dir = Path(base_dir)
        self.workflows_dir = self.base_dir / "workflows"
        self.logs_dir = self.base_dir / "logs"

        # 确保目录存在
        self.workflows_dir.mkdir(parents=True, exist_ok=True)
        self.logs_dir.mkdir(parents=True, exist_ok=True)

        # 索引文件
        self.index_file = self.workflows_dir / "index.json"
        self._ensure_index()

    def _ensure_index(self):
        """确保索引文件存在（同步初始化）。"""
        if not self.index_file.exists():
            with open(self.index_file, 'w', encoding='utf-8') as f:
                json.dump({}, f, indent=2, ensure_ascii=False)

    async def _read_index(self) -> Dict[str, Dict]:
        """异步读取索引文件。"""
        if not self.index_file.exists():
            return {}
        try:
            async with aiofiles.open(self.index_file, 'r', encoding='utf-8') as f:
                content = await f.read()
                return json.loads(content)
        except json.JSONDecodeError:
            return {}

    async def _write_index(self, index: Dict[str, Dict]):
        """原子写入索引文件。"""
        tmp_fd, tmp_path = tempfile.mkstemp(dir=str(self.index_file.parent), suffix='.tmp')
        try:
            async with aiofiles.open(tmp_path, 'w', encoding='utf-8') as f:
                await f.write(json.dumps(index, indent=2, ensure_ascii=False))
            os.replace(tmp_path, str(self.index_file))
        except (OSError, IOError) as e:
            os.unlink(tmp_path)
            raise
        finally:
            os.close(tmp_fd)

    def _workflow_path(self, workflow_id: str) -> Path:
        """获取工作流文件路径。"""
        return self.workflows_dir / f"{workflow_id}.json"

    def _log_path(self, execution_id: str) -> Path:
        """获取日志文件路径。"""
        return self.logs_dir / f"{execution_id}.json"

    async def save_workflow(self, workflow: Dict[str, Any]) -> str:
        """保存工作流。

        Args:
            workflow: 工作流数据

        Returns:
            workflow_id: 工作流 ID
        """
        # 确保有 ID
        if "id" not in workflow:
            workflow["id"] = f"wf_{uuid.uuid4().hex[:8]}"

        workflow_id = workflow["id"]

        # 添加时间戳
        now = datetime.now().isoformat()
        if "created_at" not in workflow:
            workflow["created_at"] = now
        workflow["updated_at"] = now

        # 写入文件
        workflow_path = self._workflow_path(workflow_id)
        async with aiofiles.open(workflow_path, 'w', encoding='utf-8') as f:
            await f.write(json.dumps(workflow, indent=2, ensure_ascii=False))

        # 更新索引
        index = await self._read_index()
        index[workflow_id] = {
            "id": workflow_id,
            "name": workflow.get("name", ""),
            "description": workflow.get("description", ""),
            "created_at": workflow.get("created_at"),
            "updated_at": now
        }
        await self._write_index(index)

        return workflow_id

    async def get_workflow(self, workflow_id: str) -> Optional[Dict[str, Any]]:
        """获取工作流。

        Args:
            workflow_id: 工作流 ID

        Returns:
            工作流数据，不存在则返回 None
        """
        workflow_path = self._workflow_path(workflow_id)
        if not workflow_path.exists():
            return None

        async with aiofiles.open(workflow_path, 'r', encoding='utf-8') as f:
            content = await f.read()
            return json.loads(content)

    async def list_workflows(self, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        """列出工作流。

        Args:
            skip: 跳过的数量
            limit: 返回的数量限制

        Returns:
            工作流列表
        """
        index = await self._read_index()
        workflows = list(index.values())

        # 按更新时间倒序
        workflows.sort(key=lambda x: x.get("updated_at", ""), reverse=True)

        # 分页
        return workflows[skip:skip + limit]

    async def delete_workflow(self, workflow_id: str) -> bool:
        """删除工作流。

        Args:
            workflow_id: 工作流 ID

        Returns:
            是否删除成功
        """
        workflow_path = self._workflow_path(workflow_id)
        if workflow_path.exists():
            workflow_path.unlink()

        # 更新索引
        index = await self._read_index()
        if workflow_id in index:
            del index[workflow_id]
            await self._write_index(index)
            return True
        return False

    async def save_execution_log(self, log: Dict[str, Any]) -> str:
        """保存执行日志。

        Args:
            log: 执行日志数据

        Returns:
            execution_id: 执行 ID
        """
        execution_id = log.get("execution_id", f"exec_{uuid.uuid4().hex[:8]}")
        log["execution_id"] = execution_id

        log_path = self._log_path(execution_id)
        async with aiofiles.open(log_path, 'w', encoding='utf-8') as f:
            await f.write(json.dumps(log, indent=2, ensure_ascii=False))

        return execution_id

    async def get_execution_log(self, execution_id: str) -> Optional[Dict[str, Any]]:
        """获取执行日志。

        Args:
            execution_id: 执行 ID

        Returns:
            执行日志数据，不存在则返回 None
        """
        log_path = self._log_path(execution_id)
        if not log_path.exists():
            return None

        async with aiofiles.open(log_path, 'r', encoding='utf-8') as f:
            content = await f.read()
            return json.loads(content)

    async def list_execution_logs(
        self,
        workflow_id: str,
        skip: int = 0,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """列出工作流的执行日志。

        Args:
            workflow_id: 工作流 ID
            skip: 跳过的数量
            limit: 返回的数量限制

        Returns:
            执行日志列表
        """
        logs = []

        # 遍历日志目录
        for log_file in self.logs_dir.glob("*.json"):
            async with aiofiles.open(log_file, 'r', encoding='utf-8') as f:
                content = await f.read()
                log = json.loads(content)
                if log.get("workflow_id") == workflow_id:
                    logs.append(log)

        # 按时间倒序
        logs.sort(key=lambda x: x.get("start_time", ""), reverse=True)

        return logs[skip:skip + limit]
