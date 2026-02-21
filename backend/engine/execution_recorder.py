"""执行记录器 - 负责执行记录的构建和持久化。"""
from datetime import datetime
from typing import Dict, Any, Optional

from .context import ExecutionContext, NodeExecutionRecord
from .constants import NodeStatus


class ExecutionRecorder:
    """执行记录的构建和持久化。

    负责：
    - 创建节点执行记录
    - 更新节点状态（完成/失败）
    - 持久化执行记录到 repository
    """

    def __init__(self):
        self.node_records: Dict[str, NodeExecutionRecord] = {}

    def start_node(
        self,
        node_id: str,
        node_type: str,
        node_label: str
    ) -> NodeExecutionRecord:
        """创建并返回节点执行记录。

        Args:
            node_id: 节点 ID
            node_type: 节点类型
            node_label: 节点标签

        Returns:
            新创建的节点执行记录
        """
        record = NodeExecutionRecord(
            node_id=node_id,
            node_type=node_type,
            node_label=node_label,
            status=NodeStatus.RUNNING.value,
            started_at=datetime.now().isoformat(),
        )
        self.node_records[node_id] = record
        return record

    def complete_node(
        self,
        record: NodeExecutionRecord,
        result: Any,
        context_logs: list
    ) -> None:
        """标记节点完成。

        Args:
            record: 节点执行记录
            result: 执行结果
            context_logs: 上下文日志
        """
        record.status = NodeStatus.COMPLETED.value
        record.finished_at = datetime.now().isoformat()
        record.duration_ms = int(
            (datetime.fromisoformat(record.finished_at) -
             datetime.fromisoformat(record.started_at)).total_seconds() * 1000
        )
        record.result = result if isinstance(result, dict) else {"value": result}
        record.logs = [log for log in context_logs if log.get("node_id") == record.node_id]

    def fail_node(
        self,
        record: NodeExecutionRecord,
        error: str,
        context_logs: list
    ) -> None:
        """标记节点失败。

        Args:
            record: 节点执行记录
            error: 错误信息
            context_logs: 上下文日志
        """
        record.status = NodeStatus.FAILED.value
        record.finished_at = datetime.now().isoformat()
        record.duration_ms = int(
            (datetime.fromisoformat(record.finished_at) -
             datetime.fromisoformat(record.started_at)).total_seconds() * 1000
        )
        record.error = error
        record.logs = [log for log in context_logs if log.get("node_id") == record.node_id]

    async def save(self, context: ExecutionContext, workflow: Dict[str, Any]) -> None:
        """持久化执行记录到 repository。

        Args:
            context: 执行上下文
            workflow: 工作流配置
        """
        try:
            from repository import get_execution_repo
            repo = get_execution_repo()
            execution_log = {
                "execution_id": context.execution_id,
                "workflow_id": context.workflow_id,
                "status": context.status.value,
                "started_at": context.start_time.isoformat() if context.start_time else None,
                "finished_at": context.end_time.isoformat() if context.end_time else None,
                "duration_ms": int((context.end_time - context.start_time).total_seconds() * 1000)
                    if context.start_time and context.end_time else None,
                "total_nodes": len(workflow.get("nodes", [])),
                "completed_nodes": sum(
                    1 for r in self.node_records.values()
                    if r.status == NodeStatus.COMPLETED.value
                ),
                "failed_nodes": sum(
                    1 for r in self.node_records.values()
                    if r.status == NodeStatus.FAILED.value
                ),
                "node_records": [r.to_dict() for r in self.node_records.values()],
            }
            await repo.save_execution(execution_log)
        except Exception as e:
            await context.log("error", f"保存执行记录失败: {e}")

    def sync_to_context(self, context: ExecutionContext) -> None:
        """将记录同步到上下文（保持向后兼容）。

        Args:
            context: 执行上下文
        """
        context.node_records = self.node_records.copy()
