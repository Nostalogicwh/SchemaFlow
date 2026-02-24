"""常量和枚举定义。"""

from enum import Enum


class NodeStatus(str, Enum):
    """节点执行状态。"""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class WSMessageType(str, Enum):
    """WebSocket 消息类型。"""

    EXECUTION_STARTED = "execution_started"
    NODE_START = "node_start"
    NODE_COMPLETE = "node_complete"
    SCREENSHOT = "screenshot"
    LOG = "log"
    ERROR = "error"
    EXECUTION_COMPLETE = "execution_complete"
    EXECUTION_CANCELLED = "execution_cancelled"
    USER_INPUT_REQUIRED = "user_input_required"
    AI_INTERVENTION_REQUIRED = "ai_intervention_required"  # AI检测到需要干预


DEFAULT_ELEMENT_TIMEOUT_MS = 30000
DEFAULT_WAIT_TIMEOUT_S = 30
DEFAULT_USER_INPUT_TIMEOUT_S = 300
DEFAULT_LLM_TIMEOUT_S = 120

SCREENSHOT_QUALITY = 60
