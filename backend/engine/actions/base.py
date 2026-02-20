"""基础节点 - 开始和结束节点。"""
from typing import Dict, Any
from ..actions import register_action


@register_action(
    name="start",
    label="开始",
    description="工作流的起始点",
    category="base",
    parameters={
        "type": "object",
        "properties": {},
        "required": []
    },
    outputs=["flow"]
)
async def start_action(context: Any, config: Dict[str, Any]) -> Dict[str, Any]:
    """执行开始节点。

    Args:
        context: 执行上下文
        config: 节点配置

    Returns:
        执行结果
    """
    context.log("info", "工作流开始执行")
    return {}


@register_action(
    name="end",
    label="结束",
    description="工作流的结束点",
    category="base",
    parameters={
        "type": "object",
        "properties": {},
        "required": []
    },
    inputs=["flow"]
)
async def end_action(context: Any, config: Dict[str, Any]) -> Dict[str, Any]:
    """执行结束节点。

    Args:
        context: 执行上下文
        config: 节点配置

    Returns:
        执行结果
    """
    context.log("info", "工作流执行完成")
    return {}
