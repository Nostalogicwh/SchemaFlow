"""浏览器操作节点。"""
import base64
from typing import Dict, Any
from ..actions import register_action
from .utils import locate_element


@register_action(
    name="open_tab",
    label="打开标签页",
    description="打开新标签页并跳转到指定 URL",
    category="browser",
    parameters={
        "type": "object",
        "properties": {
            "url": {
                "type": "string",
                "description": "要打开的 URL"
            }
        },
        "required": ["url"]
    },
    inputs=["flow"],
    outputs=["flow"]
)
async def open_tab_action(context: Any, config: Dict[str, Any]) -> Dict[str, Any]:
    """打开新标签页。

    Args:
        context: 执行上下文
        config: 节点配置，包含 url

    Returns:
        执行结果
    """
    url = config.get("url")
    if not url:
        raise ValueError("open_tab 节点需要 url 参数")

    await context.log("info", f"打开标签页: {url}")

    if context.page is None:
        context.page = await context.browser.new_page()

    await context.page.goto(url, wait_until="domcontentloaded")
    return {"url": url}


@register_action(
    name="navigate",
    label="页面跳转",
    description="在当前标签页跳转到指定 URL",
    category="browser",
    parameters={
        "type": "object",
        "properties": {
            "url": {
                "type": "string",
                "description": "要跳转的 URL"
            }
        },
        "required": ["url"]
    },
    inputs=["flow"],
    outputs=["flow"]
)
async def navigate_action(context: Any, config: Dict[str, Any]) -> Dict[str, Any]:
    """页面跳转。

    Args:
        context: 执行上下文
        config: 节点配置，包含 url

    Returns:
        执行结果
    """
    url = config.get("url")
    if not url:
        raise ValueError("navigate 节点需要 url 参数")

    await context.log("info", f"跳转到: {url}")
    await context.page.goto(url, wait_until="domcontentloaded")
    return {"url": url}


@register_action(
    name="click",
    label="点击元素",
    description="点击网页上的指定元素",
    category="browser",
    parameters={
        "type": "object",
        "properties": {
            "selector": {
                "type": "string",
                "description": "CSS 选择器"
            },
            "ai_target": {
                "type": "string",
                "description": "AI 定位目标描述（当 selector 不存在时使用）"
            }
        },
        "required": []
    },
    inputs=["flow"],
    outputs=["flow"]
)
async def click_action(context: Any, config: Dict[str, Any]) -> Dict[str, Any]:
    """点击元素。

    Args:
        context: 执行上下文
        config: 节点配置，包含 selector 或 ai_target

    Returns:
        执行结果
    """
    selector = config.get("selector")
    ai_target = config.get("ai_target")

    if not selector and not ai_target:
        raise ValueError("click 节点需要 selector 或 ai_target 参数")

    target_desc = selector or ai_target
    await context.log("info", f"点击元素: {target_desc}")

    locator = await locate_element(context.page, selector, ai_target, context)
    await locator.click(timeout=30000)

    return {}


@register_action(
    name="input_text",
    label="输入文本",
    description="在指定元素中输入文本",
    category="browser",
    parameters={
        "type": "object",
        "properties": {
            "selector": {
                "type": "string",
                "description": "CSS 选择器"
            },
            "ai_target": {
                "type": "string",
                "description": "AI 定位目标描述（当 selector 不存在时使用）"
            },
            "value": {
                "type": "string",
                "description": "要输入的文本"
            },
            "clear_before": {
                "type": "boolean",
                "description": "输入前是否清空",
                "default": True
            },
            "press_enter": {
                "type": "boolean",
                "description": "输入后是否按回车",
                "default": False
            }
        },
        "required": ["value"]
    },
    inputs=["flow"],
    outputs=["flow"]
)
async def input_text_action(context: Any, config: Dict[str, Any]) -> Dict[str, Any]:
    """输入文本。

    Args:
        context: 执行上下文
        config: 节点配置

    Returns:
        执行结果
    """
    selector = config.get("selector")
    ai_target = config.get("ai_target")
    value = config.get("value", "")
    clear_before = config.get("clear_before", True)
    press_enter = config.get("press_enter", False)

    if not selector and not ai_target:
        raise ValueError("input_text 节点需要 selector 或 ai_target 参数")

    target_desc = selector or ai_target
    await context.log("info", f"输入文本到 {target_desc}: {value[:50]}...")

    locator = await locate_element(context.page, selector, ai_target, context)
    if clear_before:
        await locator.fill("")
    await locator.type(value)

    if press_enter:
        await context.page.keyboard.press("Enter")

    return {"value": value}


@register_action(
    name="screenshot",
    label="截图",
    description="截取当前页面截图",
    category="browser",
    parameters={
        "type": "object",
        "properties": {
            "filename": {
                "type": "string",
                "description": "保存的文件名（可选）"
            }
        },
        "required": []
    },
    inputs=["flow"],
    outputs=["flow"]
)
async def screenshot_action(context: Any, config: Dict[str, Any]) -> Dict[str, Any]:
    """截图。

    Args:
        context: 执行上下文
        config: 节点配置

    Returns:
        执行结果，包含 base64 图片数据
    """
    filename = config.get("filename")
    await context.log("info", "执行截图")

    screenshot_bytes = await context.page.screenshot(type="jpeg", quality=60)
    base64_data = base64.b64encode(screenshot_bytes).decode()

    if filename:
        import os
        save_dir = context.data_dir / "screenshots"
        save_dir.mkdir(parents=True, exist_ok=True)
        filepath = save_dir / filename
        with open(filepath, "wb") as f:
            f.write(screenshot_bytes)

    return {"data": base64_data}
