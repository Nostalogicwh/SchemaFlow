"""执行上下文 - 管理单个工作流执行周期的状态。"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional, Dict, Any, List
import base64

from fastapi import WebSocketDisconnect
from websockets.exceptions import ConnectionClosed
from openai import AuthenticationError, APIError, OpenAIError, AsyncOpenAI

from .constants import NodeStatus, WSMessageType

logger = logging.getLogger(__name__)


# LLM客户端单例
_llm_client_instance = None


def create_llm_client():
    """创建 OpenAI 异步客户端实例（单例模式）。"""
    global _llm_client_instance

    if _llm_client_instance is not None:
        return _llm_client_instance

    try:
        from openai import AsyncOpenAI
        from config import get_settings

        llm_cfg = get_settings().get("llm", {})
        api_key = llm_cfg.get("api_key")
        base_url = llm_cfg.get("base_url")

        if not api_key:
            return None

        _llm_client_instance = AsyncOpenAI(api_key=api_key, base_url=base_url)
        return _llm_client_instance
    except ImportError:
        return None
    except (AuthenticationError, APIError, OpenAIError):
        return None


class ExecutionStatus(str, Enum):
    """执行状态枚举。"""

    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"  # 等待用户输入
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class NodeExecutionRecord:
    """单个节点的执行记录。"""

    node_id: str
    node_type: str
    node_label: str
    status: str = NodeStatus.PENDING.value  # NodeStatus 枚举值
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    duration_ms: Optional[int] = None
    result: Optional[dict] = None
    error: Optional[str] = None
    screenshot_base64: Optional[str] = None
    logs: List[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        """转为可序列化的字典。"""
        return {
            "node_id": self.node_id,
            "node_type": self.node_type,
            "node_label": self.node_label,
            "status": self.status,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "duration_ms": self.duration_ms,
            "result": self.result,
            "error": self.error,
            "screenshot_base64": self.screenshot_base64,
            "logs": self.logs,
        }


class ExecutionContext:
    """执行上下文。

    管理单个工作流执行周期的所有状态：
    - 浏览器实例
    - 变量上下文
    - 剪贴板内容
    - WebSocket 连接
    - 执行日志
    - 截图记录
    """

    def __init__(
        self,
        execution_id: str,
        workflow_id: str,
        browser=None,
        websocket=None,
        data_dir: Path = None,
    ):
        """初始化执行上下文。

        Args:
            execution_id: 执行 ID
            workflow_id: 工作流 ID
            browser: 浏览器实例
            websocket: WebSocket 连接
            data_dir: 数据目录
        """
        self.execution_id = execution_id
        self.workflow_id = workflow_id

        # 状态
        self.status = ExecutionStatus.PENDING
        self.start_time: Optional[datetime] = None
        self.end_time: Optional[datetime] = None
        self.current_node_id: Optional[str] = None
        self.error: Optional[str] = None

        # 资源
        self.browser = browser
        self.page = None
        self.websocket = websocket
        self.data_dir = data_dir or Path("./data")

        # 数据
        self.variables: Dict[str, Any] = {}
        self.clipboard: Optional[str] = None

        # 记录
        self.logs: List[Dict[str, Any]] = []
        self.screenshots: List[Dict[str, Any]] = []
        self.recorded_actions: List[Dict[str, Any]] = []
        self.node_records: Dict[str, NodeExecutionRecord] = {}

        # 用户输入控制（延迟创建 Event 以确保在有事件循环的上下文中）
        self._user_input_event: Optional[asyncio.Event] = None
        self._user_input_response: Optional[str] = None

        # 浏览器模式标记（由 browser_manager 设置）
        self._headless: bool = True

        # LLM 客户端
        self.llm_client = create_llm_client()
        llm_cfg = None
        try:
            from config import get_settings

            llm_cfg = get_settings().get("llm", {})
        except (ImportError, KeyError):
            pass
        self.llm_model = (
            llm_cfg.get("model", "deepseek-chat") if llm_cfg else "deepseek-chat"
        )

    async def send_screenshot(self):
        """发送截图到前端。"""
        if self.page and self.websocket:
            try:
                screenshot = await self.page.screenshot(type="jpeg", quality=60)
                base64_data = base64.b64encode(screenshot).decode()
                await self.websocket.send_json(
                    {
                        "type": WSMessageType.SCREENSHOT.value,
                        "node_id": self.current_node_id,
                        "data": base64_data,
                        "timestamp": datetime.now().isoformat(),
                    }
                )
            except (ConnectionClosed, WebSocketDisconnect) as e:
                await self.log("debug", f"WebSocket断开，无法发送截图: {e}")
            except TimeoutError as e:
                await self.log("error", f"截图超时: {e}")
            except Exception as e:
                await self.log("error", f"发送截图失败: {e}")

    async def request_user_input(self, prompt: str, timeout: int = 300):
        """请求用户输入（后台模式专用）。

        在后台模式下，通过WebSocket发送消息请求用户干预，
        设置等待标志并暂停执行，直到用户响应或超时。

        Args:
            prompt: 提示信息
            timeout: 超时时间（秒）

        Returns:
            用户响应（'continue' 或 'cancel'）

        Raises:
            TimeoutError: 用户输入超时
            RuntimeError: 用户取消操作
        """
        if self.websocket:
            previous_status = self.status
            self.status = ExecutionStatus.PAUSED

            self._user_input_response = None
            self._user_input_event = asyncio.Event()
            logger.info(f"[{self.execution_id}] 创建新的 _user_input_event")

            await self.websocket.send_json(
                {
                    "type": WSMessageType.USER_INPUT_REQUIRED.value,
                    "node_id": self.current_node_id,
                    "prompt": prompt,
                    "timeout": timeout,
                }
            )

            await self.log("info", f"等待用户输入: {prompt}")
            logger.info(
                f"[{self.execution_id}] 已发送 USER_INPUT_REQUIRED，开始等待响应..."
            )

            try:
                await asyncio.wait_for(self._user_input_event.wait(), timeout=timeout)
                logger.info(
                    f"[{self.execution_id}] _user_input_event 已触发，response={self._user_input_response}"
                )

                self.status = previous_status

                if self._user_input_response == "cancel":
                    await self.log("info", "用户取消了操作")
                    raise RuntimeError("用户取消了操作")

                await self.log("info", "用户继续执行")
                return self._user_input_response

            except asyncio.TimeoutError:
                self.status = previous_status
                await self.log("warning", "用户输入超时")
                raise TimeoutError("用户输入超时")

        return None

    def respond_user_input(self, response: str):
        """响应用户输入。

        设置用户响应并触发事件，让等待中的 request_user_input 继续执行。

        Args:
            response: 用户响应内容（'continue' 或 'cancel'）
        """
        logger.info(
            f"[{self.execution_id}] respond_user_input 被调用: response={response}"
        )
        self._user_input_response = response

        if self._user_input_event is not None:
            self._user_input_event.set()
            logger.info(f"[{self.execution_id}] 已触发 _user_input_event")
        else:
            logger.warning(f"[{self.execution_id}] _user_input_event 为 None，无法触发")

    async def log(self, level: str, message: str):
        """记录日志并通过 WebSocket 推送。

        Args:
            level: 日志级别 (info, warning, error)
            message: 日志消息
        """
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "level": level,
            "message": message,
            "node_id": self.current_node_id,
        }
        self.logs.append(log_entry)

        # 本地日志记录
        log_msg = f"[{self.execution_id}] {message}"
        if level == "error":
            logger.error(log_msg)
        elif level == "warning":
            logger.warning(log_msg)
        else:
            logger.info(log_msg)

        if self.websocket:
            try:
                await self.websocket.send_json(
                    {"type": WSMessageType.LOG.value, **log_entry}
                )
            except (ConnectionClosed, WebSocketDisconnect):
                pass

    def record_action(self, action_type: str, details: Dict[str, Any]):
        """录制动作（用于 AI 节点转为确定性节点）。

        Args:
            action_type: 动作类型
            details: 动作详情
        """
        self.recorded_actions.append(
            {
                "type": action_type,
                "details": details,
                "node_id": self.current_node_id,
                "timestamp": datetime.now().isoformat(),
            }
        )

    def is_cancelled(self) -> bool:
        """检查执行是否已被取消。

        Returns:
            如果执行已被取消返回 True，否则返回 False
        """
        return self.status == ExecutionStatus.CANCELLED

    async def check_cancelled(self):
        """检查是否已取消，如果是则抛出取消异常。

        Raises:
            asyncio.CancelledError: 当执行被取消时
        """
        if self.is_cancelled():
            await self.log("info", "检测到取消请求，正在终止当前操作")
            raise asyncio.CancelledError("执行已被用户取消")
