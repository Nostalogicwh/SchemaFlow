"""工作流执行器 - 负责工作流的解析和执行。"""
import asyncio
import uuid
from typing import Dict, Any, Optional, List
from datetime import datetime
from pathlib import Path

from .context import ExecutionContext, ExecutionStatus
from .constants import WSMessageType
from .actions import registry
from .actions.utils import resolve_variables
from .browser_manager import BrowserManager
from .execution_recorder import ExecutionRecorder


def topological_sort(nodes: List[Dict], edges: List[Dict]) -> List[str]:
    """根据 DAG 计算节点执行顺序（拓扑排序）。

    Args:
        nodes: 节点列表
        edges: 连接列表

    Returns:
        排序后的节点 ID 列表
    """
    node_ids = {node["id"] for node in nodes}
    adj = {node_id: [] for node_id in node_ids}
    in_degree = {node_id: 0 for node_id in node_ids}

    for edge in edges:
        source = edge.get("source")
        target = edge.get("target")
        if source in node_ids and target in node_ids:
            adj[source].append(target)
            in_degree[target] += 1

    queue = [node_id for node_id, degree in in_degree.items() if degree == 0]
    result = []

    while queue:
        node_id = queue.pop(0)
        result.append(node_id)

        for neighbor in adj[node_id]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    return result


class WorkflowExecutor:
    """工作流执行器。

    负责读取工作流配置，按顺序执行节点，管理执行生命周期。
    """

    def __init__(self, action_registry=None, data_dir: Path = None):
        self.registry = action_registry or registry
        self.data_dir = data_dir or Path("./data")
        self.active_executions: Dict[str, ExecutionContext] = {}
        self._lock: Optional[asyncio.Lock] = None

    def _get_lock(self) -> asyncio.Lock:
        if self._lock is None:
            self._lock = asyncio.Lock()
        return self._lock

    async def execute(
        self,
        workflow: Dict[str, Any],
        websocket=None,
        browser=None,
        execution_id: str = None,
        headless: bool = True
    ) -> ExecutionContext:
        if execution_id is None:
            execution_id = str(uuid.uuid4())
        context = ExecutionContext(
            execution_id=execution_id,
            workflow_id=workflow["id"],
            browser=browser,
            websocket=websocket,
            data_dir=self.data_dir
        )

        async with self._get_lock():
            self.active_executions[execution_id] = context

        try:
            await self._run_workflow(context, workflow, headless=headless)
        except Exception as e:
            context.status = ExecutionStatus.FAILED
            context.error = str(e)
            await context.log("error", f"执行失败: {str(e)}")

            if context.websocket:
                try:
                    await context.websocket.send_json({
                        "type": WSMessageType.ERROR.value,
                        "node_id": context.current_node_id,
                        "message": str(e)
                    })
                except Exception:
                    pass
        finally:
            await self._cleanup(context)

        return context

    async def _run_workflow(
        self,
        context: ExecutionContext,
        workflow: Dict[str, Any],
        headless: bool = True
    ):
        context.status = ExecutionStatus.RUNNING
        context.start_time = datetime.now()

        browser_mgr = BrowserManager()
        context._browser_mgr = browser_mgr
        await browser_mgr.connect(context, headless)

        execution_order = topological_sort(
            workflow.get("nodes", []),
            workflow.get("edges", [])
        )

        nodes_map = {node["id"]: node for node in workflow.get("nodes", [])}

        if context.websocket:
            await context.websocket.send_json({
                "type": WSMessageType.EXECUTION_STARTED.value,
                "execution_id": context.execution_id,
                "workflow_id": context.workflow_id,
                "node_order": execution_order
            })

        recorder = ExecutionRecorder()

        for node_id in execution_order:
            if context.status == ExecutionStatus.CANCELLED:
                break

            node = nodes_map.get(node_id)
            if not node:
                continue

            node_type = node.get("type")
            config = node.get("config", {})
            node_label = node.get("label", node_type)

            context.current_node_id = node_id

            record = recorder.start_node(node_id, node_type, node_label)
            context.node_records[node_id] = record

            if context.websocket:
                await context.websocket.send_json({
                    "type": WSMessageType.NODE_START.value,
                    "node_id": node_id,
                    "node_type": node_type
                })

            try:
                execute_func = self.registry.get_execute_func(node_type)
            except ValueError:
                raise ValueError(f"未知的节点类型: {node_type}")

            resolved_config = resolve_variables(config, context.variables)

            try:
                result = await execute_func(context, resolved_config)

                recorder.complete_node(record, result, context.logs)

                if context.websocket:
                    await context.websocket.send_json({
                        "type": WSMessageType.NODE_COMPLETE.value,
                        "node_id": node_id,
                        "success": True,
                        "result": result,
                        "record": record.to_dict()
                    })

                await context.send_screenshot()

            except Exception as e:
                recorder.fail_node(record, str(e), context.logs)

                if context.websocket:
                    await context.websocket.send_json({
                        "type": WSMessageType.NODE_COMPLETE.value,
                        "node_id": node_id,
                        "success": False,
                        "error": str(e),
                        "record": record.to_dict()
                    })
                await context.log("error", f"节点 {node_id} 执行失败: {str(e)}")
                raise

        context.status = ExecutionStatus.COMPLETED
        context.end_time = datetime.now()

        if context.websocket:
            await context.websocket.send_json({
                "type": WSMessageType.EXECUTION_COMPLETE.value,
                "execution_id": context.execution_id,
                "success": context.status == ExecutionStatus.COMPLETED,
                "duration": (context.end_time - context.start_time).total_seconds() if context.end_time else 0,
                "logs": context.logs
            })

        recorder.sync_to_context(context)
        await recorder.save(context, workflow)

    async def _cleanup(self, context: ExecutionContext):
        context.end_time = datetime.now()

        browser_mgr = getattr(context, '_browser_mgr', None)
        if browser_mgr:
            await browser_mgr.cleanup(context)

        async with self._get_lock():
            if context.execution_id in self.active_executions:
                del self.active_executions[context.execution_id]

    async def stop(self, execution_id: str):
        async with self._get_lock():
            context = self.active_executions.get(execution_id)
            if context:
                context.status = ExecutionStatus.CANCELLED
                if context.websocket:
                    try:
                        await context.websocket.send_json({
                            "type": WSMessageType.EXECUTION_CANCELLED.value,
                            "execution_id": execution_id
                        })
                    except Exception:
                        pass

    async def respond_user_input(self, execution_id: str, response: str):
        context = self.active_executions.get(execution_id)
        if context:
            context.respond_user_input(response)

    def get_context(self, execution_id: str) -> Optional[ExecutionContext]:
        return self.active_executions.get(execution_id)
