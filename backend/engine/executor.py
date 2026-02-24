"""工作流执行器 - 负责工作流的解析和执行。"""

import asyncio
import base64
import logging
import uuid
from typing import Dict, Any, Optional, List
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

from fastapi import WebSocketDisconnect
from websockets.exceptions import ConnectionClosed

from playwright.async_api import Error as PlaywrightError

from .context import ExecutionContext, ExecutionStatus
from .constants import WSMessageType
from .actions import registry
from .actions.utils import resolve_variables
from .browser_manager import BrowserManager
from .execution_recorder import ExecutionRecorder
from .ai import detect_intervention


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
        headless: bool = True,
        storage_state: Optional[Dict[str, Any]] = None,
    ) -> ExecutionContext:
        if execution_id is None:
            execution_id = str(uuid.uuid4())
        logger.info(
            f"[{execution_id}] 开始执行工作流: workflow_id={workflow.get('id')}, headless={headless}"
        )
        context = ExecutionContext(
            execution_id=execution_id,
            workflow_id=workflow["id"],
            browser=browser,
            websocket=websocket,
            data_dir=self.data_dir,
        )
        context._storage_state = storage_state
        if storage_state:
            cookies_count = len(storage_state.get("cookies", []))
            origins_count = len(storage_state.get("origins", []))
            logger.info(
                f"[{execution_id}] 收到前端凭证: cookies={cookies_count}, origins={origins_count}"
            )
        else:
            logger.info(f"[{execution_id}] 无历史凭证")

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
                    await context.websocket.send_json(
                        {
                            "type": WSMessageType.ERROR.value,
                            "node_id": context.current_node_id,
                            "message": str(e),
                        }
                    )
                except ConnectionClosed:
                    await context.log("debug", "WebSocket连接已关闭，无法发送错误消息")
                except WebSocketDisconnect:
                    await context.log("debug", "WebSocket已断开，无法发送错误消息")
        finally:
            await self._cleanup(context)

        return context

    async def _run_workflow(
        self, context: ExecutionContext, workflow: Dict[str, Any], headless: bool = True
    ):
        logger.info(f"[{context.execution_id}] 工作流开始运行")
        context.status = ExecutionStatus.RUNNING
        context.start_time = datetime.now()

        browser_mgr = BrowserManager()
        context._browser_mgr = browser_mgr
        storage_state = getattr(context, "_storage_state", None)
        await browser_mgr.connect(
            context, headless=headless, storage_state=storage_state
        )
        logger.info(
            f"[{context.execution_id}] 浏览器连接完成 (CDP模式: {getattr(context, '_is_cdp', False)})"
        )

        execution_order = topological_sort(
            workflow.get("nodes", []), workflow.get("edges", [])
        )

        nodes_map = {node["id"]: node for node in workflow.get("nodes", [])}
        logger.info(f"[{context.execution_id}] 执行顺序: {execution_order}")

        if context.websocket:
            await context.websocket.send_json(
                {
                    "type": WSMessageType.EXECUTION_STARTED.value,
                    "execution_id": context.execution_id,
                    "workflow_id": context.workflow_id,
                    "node_order": execution_order,
                }
            )

        recorder = ExecutionRecorder()

        for node_id in execution_order:
            if context.status == ExecutionStatus.CANCELLED:
                logger.info(f"[{context.execution_id}] 工作流被取消，停止执行后续节点")
                await context.log("info", "工作流被取消")
                break

            node = nodes_map.get(node_id)
            if not node:
                continue

            node_type = node.get("type")
            config = node.get("config", {})
            node_label = node.get("label", node_type)

            context.current_node_id = node_id
            logger.info(
                f"[{context.execution_id}] 节点开始: {node_id} (type={node_type}, label={node_label})"
            )

            record = recorder.start_node(node_id, node_type, node_label)
            context.node_records[node_id] = record

            if context.websocket:
                await context.websocket.send_json(
                    {
                        "type": WSMessageType.NODE_START.value,
                        "node_id": node_id,
                        "node_type": node_type,
                    }
                )

            try:
                execute_func = self.registry.get_execute_func(node_type)
            except ValueError:
                raise ValueError(f"未知的节点类型: {node_type}")

            resolved_config = resolve_variables(config, context.variables)

            # 执行节点前再次检查取消状态
            await context.check_cancelled()

            # AI干预检测
            await self._check_ai_intervention(context, node, resolved_config)

            try:
                result = await execute_func(context, resolved_config)
                logger.info(f"[{context.execution_id}] 节点成功: {node_id}")

                await context.check_cancelled()

                recorder.complete_node(record, result, context.logs)

                if context.websocket:
                    await context.websocket.send_json(
                        {
                            "type": WSMessageType.NODE_COMPLETE.value,
                            "node_id": node_id,
                            "success": True,
                            "result": result,
                            "record": record.to_dict(),
                        }
                    )

                # 检查是否有 AI 定位返回的新选择器，发送回填消息
                if (
                    result
                    and isinstance(result, dict)
                    and result.get("effective_selector")
                ):
                    effective_selector = result["effective_selector"]
                    original_selector = config.get("selector")
                    if effective_selector != original_selector:
                        logger.info(
                            f"[{context.execution_id}] 选择器回填: {node_id} -> {effective_selector}"
                        )
                        if context.websocket:
                            try:
                                await context.websocket.send_json(
                                    {
                                        "type": "selector_update",
                                        "node_id": node_id,
                                        "selector": effective_selector,
                                    }
                                )
                            except Exception as e:
                                logger.warning(
                                    f"[{context.execution_id}] 发送选择器更新消息失败: {e}"
                                )

                await context.send_screenshot()

            except PlaywrightError as e:
                if getattr(
                    e, "name", None
                ) == "TargetClosedError" or "Target closed" in str(e):
                    logger.info(
                        f"[{context.execution_id}] 节点 {node_id} 因页面关闭而终止"
                    )
                    recorder.fail_node(record, "执行被用户取消", context.logs)
                    context.status = ExecutionStatus.CANCELLED
                    if context.websocket:
                        try:
                            await context.websocket.send_json(
                                {
                                    "type": WSMessageType.NODE_COMPLETE.value,
                                    "node_id": node_id,
                                    "success": False,
                                    "error": "执行被用户取消",
                                    "record": record.to_dict(),
                                }
                            )
                        except (ConnectionClosed, WebSocketDisconnect):
                            pass
                    return
                raise

            except asyncio.CancelledError:
                logger.info(f"[{context.execution_id}] 节点 {node_id} 被取消")
                recorder.fail_node(record, "执行被取消", context.logs)
                raise

            except Exception as e:
                recorder.fail_node(record, str(e), context.logs)
                logger.error(
                    f"[{context.execution_id}] 节点失败: {node_id}, 错误: {e}",
                    exc_info=True,
                )

                if context.websocket:
                    await context.websocket.send_json(
                        {
                            "type": WSMessageType.NODE_COMPLETE.value,
                            "node_id": node_id,
                            "success": False,
                            "error": str(e),
                            "record": record.to_dict(),
                        }
                    )
                await context.log("error", f"节点 {node_id} 执行失败: {str(e)}")
                raise

        if context.status == ExecutionStatus.CANCELLED:
            logger.info(f"[{context.execution_id}] 工作流已取消，跳过完成消息")
            return

        context.status = ExecutionStatus.COMPLETED
        context.end_time = datetime.now()
        duration = (context.end_time - context.start_time).total_seconds()
        logger.info(f"[{context.execution_id}] 工作流完成, 耗时: {duration:.2f}秒")

        if context.websocket:
            await context.websocket.send_json(
                {
                    "type": WSMessageType.EXECUTION_COMPLETE.value,
                    "execution_id": context.execution_id,
                    "success": context.status == ExecutionStatus.COMPLETED,
                    "duration": (context.end_time - context.start_time).total_seconds()
                    if context.end_time
                    else 0,
                    "logs": context.logs,
                }
            )

        recorder.sync_to_context(context)

        # 提取并下发最新凭证
        browser_mgr = getattr(context, "_browser_mgr", None)
        if browser_mgr and hasattr(context, "_context"):
            try:
                custom_context = getattr(context, "_context", None)
                if custom_context:
                    latest_state = await custom_context.storage_state()
                    cookies_count = len(latest_state.get("cookies", []))
                    origins_count = len(latest_state.get("origins", []))
                    logger.info(
                        f"[{context.execution_id}] 提取凭证完成: "
                        f"cookies={cookies_count}, origins={origins_count}"
                    )
                    if context.websocket:
                        await context.websocket.send_json(
                            {"type": "storage_state_update", "data": latest_state}
                        )
                        logger.info(f"[{context.execution_id}] 已下发最新凭证到前端")
            except Exception as e:
                logger.warning(f"[{context.execution_id}] 提取凭证失败: {e}")

        await recorder.save(context, workflow)

    async def _cleanup(self, context: ExecutionContext):
        context.end_time = datetime.now()

        browser_mgr = getattr(context, "_browser_mgr", None)
        if browser_mgr:
            await browser_mgr.cleanup(context)

        async with self._get_lock():
            if context.execution_id in self.active_executions:
                del self.active_executions[context.execution_id]

    async def stop(self, execution_id: str):
        """停止指定执行的工作流。

        设置取消标志并强制中断 Playwright 操作。

        Args:
            execution_id: 要停止的执行ID
        """
        logger.info(f"[{execution_id}] 收到停止请求")
        async with self._get_lock():
            context = self.active_executions.get(execution_id)
            if context:
                previous_status = context.status
                context.status = ExecutionStatus.CANCELLED
                logger.info(
                    f"[{execution_id}] 状态已从 {previous_status.value} 设置为 CANCELLED"
                )

                if context.websocket:
                    try:
                        await context.websocket.send_json(
                            {
                                "type": WSMessageType.EXECUTION_CANCELLED.value,
                                "execution_id": execution_id,
                            }
                        )
                        logger.info(f"[{execution_id}] 已发送 EXECUTION_CANCELLED 消息")
                    except (ConnectionClosed, WebSocketDisconnect) as e:
                        logger.debug(f"[{execution_id}] WebSocket 已断开: {e}")
                    except Exception as e:
                        logger.warning(f"[{execution_id}] 发送取消消息失败: {e}")

                try:
                    if context.page:
                        await context.page.close()
                        logger.info(f"[{execution_id}] 已强制关闭页面")
                    custom_context = getattr(context, "_context", None)
                    if custom_context:
                        await custom_context.close()
                        logger.info(f"[{execution_id}] 已强制关闭浏览器上下文")
                except Exception as e:
                    logger.debug(
                        f"[{execution_id}] 强制关闭浏览器资源时出错（可忽略）: {e}"
                    )

                logger.info(f"[{execution_id}] 取消完成，Playwright 操作已强制中断")
            else:
                logger.warning(f"[{execution_id}] 未找到活跃的执行上下文")

    async def respond_user_input(self, execution_id: str, response: str):
        context = self.active_executions.get(execution_id)
        if context:
            context.respond_user_input(response)

    def get_context(self, execution_id: str) -> Optional[ExecutionContext]:
        return self.active_executions.get(execution_id)

    async def _check_ai_intervention(
        self, context: ExecutionContext, node: Dict[str, Any], config: Dict[str, Any]
    ):
        """检查是否需要AI干预检测。

        如果节点配置了enable_ai_intervention为true，则使用AI检测当前页面状态，
        检测到需要干预时暂停执行并请求用户处理。

        Args:
            context: 执行上下文
            node: 节点定义
            config: 节点配置（已解析变量）
        """
        # 检查是否启用了AI干预检测
        enable_ai_intervention = config.get("enable_ai_intervention", False)
        if not enable_ai_intervention:
            return

        # 检查是否有页面上下文
        if not context.page:
            await context.log("debug", "页面未初始化，跳过AI干预检测")
            return

        node_id = node.get("id", "unknown")
        node_type = node.get("type", "unknown")

        await context.log("info", f"节点 {node_id} 启用AI干预检测")

        try:
            # 截取当前页面截图
            screenshot_bytes = await context.page.screenshot(type="jpeg", quality=60)
            screenshot_base64 = base64.b64encode(screenshot_bytes).decode()

            # 调用AI进行检测
            detection_result = await detect_intervention(screenshot_base64)

            needs_intervention = detection_result.get("needs_intervention", False)
            intervention_type = detection_result.get("intervention_type", "未知")
            confidence = detection_result.get("confidence", 0)
            reason = detection_result.get("reason", "")

            await context.log(
                "info",
                f"AI干预检测结果: needs_intervention={needs_intervention}, "
                f"type={intervention_type}, confidence={confidence:.2f}",
            )

            if needs_intervention:
                # 需要人工干预，暂停执行并请求用户处理
                prompt_message = f"检测到需要人工干预的页面元素：{intervention_type}\n\n原因：{reason}\n\n请完成相应操作后点击继续。"

                await context.log("warning", f"AI检测到需要干预: {intervention_type}")

                # 发送干预请求到前端
                if context.websocket:
                    await context.websocket.send_json(
                        {
                            "type": WSMessageType.AI_INTERVENTION_REQUIRED.value,
                            "node_id": node_id,
                            "node_type": node_type,
                            "intervention_type": intervention_type,
                            "reason": reason,
                            "confidence": confidence,
                            "screenshot": screenshot_base64,
                        }
                    )

                # 请求用户输入（暂停执行直到用户响应）
                response = await context.request_user_input(prompt_message, timeout=600)

                if response == "cancel":
                    raise RuntimeError("用户取消了AI干预处理")

                await context.log("info", "用户已完成干预处理，继续执行")

        except Exception as e:
            # 检测失败时记录日志但不阻断执行（除非明确需要干预）
            if "用户取消" in str(e):
                raise
            await context.log("warning", f"AI干预检测失败: {e}")
            # 安全优先：检测失败时可以选择是否暂停，这里选择继续执行
            # 如果需要严格安全，可以抛出异常暂停执行
