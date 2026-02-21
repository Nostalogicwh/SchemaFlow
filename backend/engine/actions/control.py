"""控制节点 - 等待、用户输入等。"""
from typing import Dict, Any
from ..actions import register_action


@register_action(
    name="wait",
    label="等待",
    description="等待指定时间",
    category="control",
    parameters={
        "type": "object",
        "properties": {
            "seconds": {
                "type": "number",
                "description": "等待的秒数",
                "default": 1
            }
        },
        "required": []
    },
    inputs=["flow"],
    outputs=["flow"]
)
async def wait_action(context: Any, config: Dict[str, Any]) -> Dict[str, Any]:
    """等待指定时间。

    Args:
        context: 执行上下文
        config: 节点配置，包含 seconds

    Returns:
        执行结果
    """
    import asyncio

    seconds = config.get("seconds", 1)
    await context.log("info", f"等待 {seconds} 秒")
    await asyncio.sleep(seconds)
    return {}


@register_action(
    name="wait_for_element",
    label="等待元素",
    description="等待元素出现",
    category="control",
    parameters={
        "type": "object",
        "properties": {
            "selector": {
                "type": "string",
                "description": "CSS 选择器"
            },
            "timeout": {
                "type": "number",
                "description": "超时时间（秒）",
                "default": 30
            }
        },
        "required": ["selector"]
    },
    inputs=["flow"],
    outputs=["flow"]
)
async def wait_for_element_action(context: Any, config: Dict[str, Any]) -> Dict[str, Any]:
    """等待元素出现。

    Args:
        context: 执行上下文
        config: 节点配置，包含 selector 和 timeout

    Returns:
        执行结果
    """
    selector = config.get("selector")
    timeout = config.get("timeout", 30)

    await context.log("info", f"等待元素: {selector} (超时: {timeout}s)")
    await context.page.wait_for_selector(selector, timeout=timeout * 1000)
    return {}


@register_action(
    name="user_input",
    label="用户干预",
    description="暂停执行，等待用户手动操作后继续",
    category="control",
    parameters={
        "type": "object",
        "properties": {
            "prompt": {
                "type": "string",
                "description": "提示信息"
            },
            "timeout": {
                "type": "number",
                "description": "超时时间（秒）",
                "default": 300
            }
        },
        "required": ["prompt"]
    },
    inputs=["flow"],
    outputs=["flow"]
)
async def user_input_action(context: Any, config: Dict[str, Any]) -> Dict[str, Any]:
    """用户干预节点。

    Args:
        context: 执行上下文
        config: 节点配置

    Returns:
        执行结果
    """
    prompt = config.get("prompt", "请完成操作后继续")
    timeout = config.get("timeout", 300)

    await context.log("info", f"等待用户输入: {prompt}")

    # 通过 WebSocket 请求用户输入
    if context.websocket:
        await context.request_user_input(prompt, timeout)
    else:
        # 无 WebSocket 模式，直接等待
        import asyncio
        await context.log("info", "无 WebSocket 连接，等待 5 秒后继续")
        await asyncio.sleep(5)

    return {}
