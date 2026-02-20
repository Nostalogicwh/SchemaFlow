"""工作流执行器 - 负责工作流的解析和执行。"""
import asyncio
import re
import uuid
from typing import Dict, Any, Optional, List
from datetime import datetime
from pathlib import Path

from .context import ExecutionContext, ExecutionStatus
from .actions import registry


def topological_sort(nodes: List[Dict], edges: List[Dict]) -> List[str]:
    """根据 DAG 计算节点执行顺序（拓扑排序）。

    Args:
        nodes: 节点列表
        edges: 连接列表

    Returns:
        排序后的节点 ID 列表
    """
    # 构建邻接表和入度表
    node_ids = {node["id"] for node in nodes}
    adj = {node_id: [] for node_id in node_ids}
    in_degree = {node_id: 0 for node_id in node_ids}

    # 构建图
    for edge in edges:
        source = edge.get("source")
        target = edge.get("target")
        if source in node_ids and target in node_ids:
            adj[source].append(target)
            in_degree[target] += 1

    # Kahn 算法
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
        """初始化执行器。

        Args:
            action_registry: 动作注册表
            data_dir: 数据目录
        """
        self.registry = action_registry or registry
        self.data_dir = data_dir or Path("./data")
        self.active_executions: Dict[str, ExecutionContext] = {}
        self._lock = asyncio.Lock()

    async def execute(
        self,
        workflow: Dict[str, Any],
        websocket=None,
        browser=None
    ) -> ExecutionContext:
        """执行工作流。

        Args:
            workflow: 工作流配置
            websocket: WebSocket 连接（可选）
            browser: 浏览器实例（可选）

        Returns:
            执行上下文
        """
        execution_id = str(uuid.uuid4())
        context = ExecutionContext(
            execution_id=execution_id,
            workflow_id=workflow["id"],
            browser=browser,
            websocket=websocket,
            data_dir=self.data_dir
        )

        async with self._lock:
            self.active_executions[execution_id] = context

        try:
            await self._run_workflow(context, workflow)
        except Exception as e:
            context.status = ExecutionStatus.FAILED
            context.error = str(e)
            context.log("error", f"执行失败: {str(e)}")

            # 发送错误消息
            if context.websocket:
                try:
                    await context.websocket.send_json({
                        "type": "error",
                        "node_id": context.current_node_id,
                        "message": str(e)
                    })
                except Exception:
                    pass
        finally:
            await self._cleanup(context)

        return context

    async def _run_workflow(self, context: ExecutionContext, workflow: Dict[str, Any]):
        """实际执行逻辑。

        Args:
            context: 执行上下文
            workflow: 工作流配置
        """
        context.status = ExecutionStatus.RUNNING
        context.start_time = datetime.now()

        # 初始化浏览器
        if context.browser is None and context.page is None:
            from playwright.async_api import async_playwright
            self.playwright = await async_playwright().start()
            context.browser = await self.playwright.chromium.launch(
                headless=False  # 有头模式，用户可见
            )
            context.page = await context.browser.new_page()

        # 计算执行顺序
        execution_order = topological_sort(workflow.get("nodes", []), workflow.get("edges", []))

        # 构建节点查找表
        nodes_map = {node["id"]: node for node in workflow.get("nodes", [])}

        # 发送开始消息
        if context.websocket:
            await context.websocket.send_json({
                "type": "execution_started",
                "execution_id": context.execution_id,
                "workflow_id": context.workflow_id,
                "node_order": execution_order
            })

        # 按顺序执行节点
        for node_id in execution_order:
            # 检查是否被取消
            if context.status == ExecutionStatus.CANCELLED:
                break

            node = nodes_map.get(node_id)
            if not node:
                continue

            node_type = node.get("type")
            config = node.get("config", {})

            context.current_node_id = node_id

            # 发送节点开始消息
            if context.websocket:
                await context.websocket.send_json({
                    "type": "node_start",
                    "node_id": node_id,
                    "node_type": node_type
                })

            # 获取执行函数
            try:
                execute_func = self.registry.get_execute_func(node_type)
            except ValueError:
                raise ValueError(f"未知的节点类型: {node_type}")

            # 变量替换
            resolved_config = self._resolve_variables(config, context.variables)

            # 执行
            try:
                result = await execute_func(context, resolved_config)

                # 发送节点完成消息
                if context.websocket:
                    await context.websocket.send_json({
                        "type": "node_complete",
                        "node_id": node_id,
                        "success": True,
                        "result": result
                    })

                # 每个节点后发送截图
                await context.send_screenshot()

            except Exception as e:
                # 发送节点失败消息
                if context.websocket:
                    await context.websocket.send_json({
                        "type": "node_complete",
                        "node_id": node_id,
                        "success": False,
                        "error": str(e)
                    })
                context.log("error", f"节点 {node_id} 执行失败: {str(e)}")
                raise

        context.status = ExecutionStatus.COMPLETED
        context.end_time = datetime.now()

        # 发送完成消息
        if context.websocket:
            await context.websocket.send_json({
                "type": "execution_complete",
                "execution_id": context.execution_id,
                "success": context.status == ExecutionStatus.COMPLETED,
                "duration": (context.end_time - context.start_time).total_seconds() if context.end_time else 0,
                "logs": context.logs
            })

    def _resolve_variables(self, config: Any, variables: Dict[str, Any]) -> Any:
        """解析变量引用 {{variable_name}}。

        Args:
            config: 原始配置
            variables: 变量上下文

        Returns:
            解析后的配置
        """
        def resolve_value(value):
            if isinstance(value, str):
                # 替换 {{var}} 语法
                pattern = r'\{\{(\w+)\}\}'
                matches = list(re.finditer(pattern, value))

                if matches:
                    result = value
                    for match in reversed(matches):
                        var_name = match.group(1)
                        var_value = str(variables.get(var_name, match.group(0)))
                        result = result[:match.start()] + var_value + result[match.end():]
                    return result
                return value
            elif isinstance(value, dict):
                return {k: resolve_value(v) for k, v in value.items()}
            elif isinstance(value, list):
                return [resolve_value(v) for v in value]
            return value

        return resolve_value(config)

    async def _cleanup(self, context: ExecutionContext):
        """清理资源。

        Args:
            context: 执行上下文
        """
        context.end_time = datetime.now()

        # 关闭浏览器（如果是由执行器创建的）
        if hasattr(self, 'playwright'):
            try:
                await self.playwright.stop()
            except Exception:
                pass

        # 从活跃执行中移除
        async with self._lock:
            if context.execution_id in self.active_executions:
                del self.active_executions[context.execution_id]

    async def stop(self, execution_id: str):
        """停止执行。

        Args:
            execution_id: 执行 ID
        """
        async with self._lock:
            context = self.active_executions.get(execution_id)
            if context:
                context.status = ExecutionStatus.CANCELLED
                if context.websocket:
                    try:
                        await context.websocket.send_json({
                            "type": "execution_cancelled",
                            "execution_id": execution_id
                        })
                    except Exception:
                        pass

    async def respond_user_input(self, execution_id: str, response: str):
        """响应用户输入。

        Args:
            execution_id: 执行 ID
            response: 用户响应
        """
        context = self.active_executions.get(execution_id)
        if context:
            context.respond_user_input(response)

    def get_context(self, execution_id: str) -> Optional[ExecutionContext]:
        """获取执行上下文。

        Args:
            execution_id: 执行 ID

        Returns:
            执行上下文
        """
        return self.active_executions.get(execution_id)
