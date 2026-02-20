"""数据操作节点 - 提取、复制、粘贴等。"""
from typing import Dict, Any
from ..actions import register_action


@register_action(
    name="extract_text",
    label="提取文本",
    description="从指定元素中提取文本内容",
    category="data",
    parameters={
        "type": "object",
        "properties": {
            "selector": {
                "type": "string",
                "description": "CSS 选择器"
            },
            "output_var": {
                "type": "string",
                "description": "输出变量名"
            }
        },
        "required": ["selector", "output_var"]
    },
    inputs=["flow"],
    outputs=["flow"]
)
async def extract_text_action(context: Any, config: Dict[str, Any]) -> Dict[str, Any]:
    """提取文本。

    Args:
        context: 执行上下文
        config: 节点配置

    Returns:
        执行结果
    """
    selector = config.get("selector")
    output_var = config.get("output_var")

    context.log("info", f"提取文本: {selector}")

    element = await context.page.query_selector(selector)
    if element:
        text = await element.inner_text()
    else:
        text = ""

    # 保存到变量
    context.variables[output_var] = text
    context.clipboard = text

    context.log("info", f"提取到文本: {text[:50]}...")

    return {output_var: text}


@register_action(
    name="copy_to_clipboard",
    label="复制到剪贴板",
    description="将内容复制到剪贴板",
    category="data",
    parameters={
        "type": "object",
        "properties": {
            "value": {
                "type": "string",
                "description": "要复制的内容"
            }
        },
        "required": ["value"]
    },
    inputs=["flow"],
    outputs=["flow"]
)
async def copy_to_clipboard_action(context: Any, config: Dict[str, Any]) -> Dict[str, Any]:
    """复制到剪贴板。

    Args:
        context: 执行上下文
        config: 节点配置

    Returns:
        执行结果
    """
    value = config.get("value", "")

    # 解析变量引用
    if value.startswith("{{") and value.endswith("}}"):
        var_name = value[2:-2]
        value = str(context.variables.get(var_name, ""))

    context.clipboard = value
    context.log("info", f"复制到剪贴板: {value[:50]}...")

    return {"value": value}


@register_action(
    name="paste_from_clipboard",
    label="从剪贴板粘贴",
    description="从剪贴板粘贴内容到指定元素",
    category="data",
    parameters={
        "type": "object",
        "properties": {
            "selector": {
                "type": "string",
                "description": "CSS 选择器"
            }
        },
        "required": ["selector"]
    },
    inputs=["flow"],
    outputs=["flow"]
)
async def paste_from_clipboard_action(context: Any, config: Dict[str, Any]) -> Dict[str, Any]:
    """从剪贴板粘贴。

    Args:
        context: 执行上下文
        config: 节点配置

    Returns:
        执行结果
    """
    selector = config.get("selector")
    text = context.clipboard or ""

    context.log("info", f"粘贴到 {selector}: {text[:50]}...")

    await context.page.fill(selector, "")

    # 模拟粘贴（Playwright 的 paste 需要聚焦后）
    element = await context.page.query_selector(selector)
    if element:
        await element.fill(text)

    return {"value": text}


@register_action(
    name="set_variable",
    label="设置变量",
    description="设置上下文变量",
    category="data",
    parameters={
        "type": "object",
        "properties": {
            "name": {
                "type": "string",
                "description": "变量名"
            },
            "value": {
                "type": "string",
                "description": "变量值"
            }
        },
        "required": ["name", "value"]
    },
    inputs=["flow"],
    outputs=["flow"]
)
async def set_variable_action(context: Any, config: Dict[str, Any]) -> Dict[str, Any]:
    """设置变量。

    Args:
        context: 执行上下文
        config: 节点配置

    Returns:
        执行结果
    """
    name = config.get("name")
    value = config.get("value", "")

    context.variables[name] = value
    context.log("info", f"设置变量 {name} = {value[:50]}...")

    return {name: value}
