"""浏览器操作节点。"""
import base64
from typing import Dict, Any
from ..actions import register_action
from .utils import locate_element


@register_action(
    name="open_tab",
    label="打开标签页",
    description="在当前标签页跳转到指定 URL（保持登录态）",
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
    """在当前页面跳转（保持登录态）。

    Args:
        context: 执行上下文
        config: 节点配置，包含 url

    Returns:
        执行结果
    """
    url = config.get("url")
    if not url:
        raise ValueError("open_tab 节点需要 url 参数")

    await context.log("info", f"打开页面: {url}")
    
    # CDP 模式下在当前页面跳转，保持登录态
    is_cdp = getattr(context, '_is_cdp', False)
    
    if context.page is None:
        # 如果页面不存在，需要创建（这种情况较少）
        if is_cdp and context.browser:
            # CDP 模式下尝试复用已有页面
            default_context = context.browser.contexts[0] if context.browser.contexts else None
            if default_context and default_context.pages:
                context.page = default_context.pages[0]
                await context.log("info", f"复用已有页面: {context.page.url}")
            else:
                context.page = await context.browser.new_page()
                await context.log("info", "创建新页面")
        else:
            context.page = await context.browser.new_page()
            await context.log("info", "创建新页面")
    
    # 在当前页面跳转
    if is_cdp:
        # CDP 模式使用 networkidle 等待，确保登录态恢复
        await context.page.goto(url, wait_until="networkidle")
        await context.log("info", f"页面跳转完成，当前 URL: {context.page.url}")
    else:
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
    
    # 检查是否是 CDP 模式（有登录态）
    is_cdp = getattr(context, '_is_cdp', False)
    
    if is_cdp:
        # CDP 模式下，确保在现有上下文中跳转，保持登录态
        await context.log("debug", "CDP 模式跳转，保持登录态")
        # 使用相同的 page 进行跳转，不创建新页面
        await context.page.goto(url, wait_until="networkidle")
        await context.log("info", f"页面跳转完成，当前 URL: {context.page.url}")
    else:
        # 独立浏览器模式
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

    try:
        locator = await locate_element(
            context.page, 
            selector, 
            ai_target, 
            context,
            wait_for_visible=True,
            timeout=30000
        )
        await locator.click(timeout=30000)
        await context.log("info", f"点击成功: {target_desc}")
    except ValueError as e:
        await context.log("error", f"点击失败: {target_desc}, 错误: {str(e)}")
        raise

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

    try:
        locator = await locate_element(
            context.page,
            selector,
            ai_target,
            context,
            wait_for_visible=True,
            timeout=30000
        )
        
        # 等待元素可交互
        await locator.wait_for(state="visible", timeout=5000)
        
        if clear_before:
            await locator.fill("")
        await locator.type(value)

        if press_enter:
            await context.page.keyboard.press("Enter")
            
        await context.log("info", f"输入成功: {target_desc}")
    except ValueError as e:
        await context.log("error", f"输入失败: {target_desc}, 错误: {str(e)}")
        raise

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


@register_action(
    name="switch_tab",
    label="切换标签页",
    description="切换到指定的标签页",
    category="browser",
    parameters={
        "type": "object",
        "properties": {
            "index": {
                "type": "integer",
                "description": "标签页索引（从0开始），与 title_match 二选一"
            },
            "title_match": {
                "type": "string",
                "description": "按标题模糊匹配标签页，与 index 二选一"
            }
        }
    },
    inputs=["flow"],
    outputs=["flow"]
)
async def switch_tab_action(context: Any, config: Dict[str, Any]) -> Dict[str, Any]:
    """切换标签页。"""
    if not context.browser:
        raise ValueError("浏览器未初始化")

    contexts = context.browser.contexts
    if not contexts:
        raise ValueError("没有可用的浏览器上下文")

    pages = contexts[0].pages
    if not pages:
        raise ValueError("没有可用的标签页")

    index = config.get("index")
    title_match = config.get("title_match")

    if index is not None:
        if index < 0 or index >= len(pages):
            raise ValueError(f"标签页索引 {index} 超出范围（0-{len(pages)-1}）")
        target_page = pages[index]
        await context.log("info", f"切换到标签页 {index}: {target_page.url}")
    elif title_match is not None:
        target_page = None
        for i, page in enumerate(pages):
            page_title = await page.title()
            if title_match.lower() in page_title.lower():
                target_page = page
                await context.log("info", f"切换到标签页（标题匹配）{i}: {page.url}")
                break
        if target_page is None:
            raise ValueError(f"找不到标题包含「{title_match}」的标签页")
    else:
        raise ValueError("必须提供 index 或 title_match 参数")

    context.page = target_page
    return {"page_url": target_page.url, "page_title": await target_page.title()}


@register_action(
    name="close_tab",
    label="关闭标签页",
    description="关闭当前标签页",
    category="browser",
    parameters={
        "type": "object",
        "properties": {},
    },
    inputs=["flow"],
    outputs=["flow"]
)
async def close_tab_action(context: Any, config: Dict[str, Any]) -> Dict[str, Any]:
    """关闭当前标签页。"""
    if not context.page:
        raise ValueError("当前没有打开的标签页")

    contexts = context.browser.contexts
    if not contexts:
        raise ValueError("没有可用的浏览器上下文")

    pages = contexts[0].pages
    if len(pages) <= 1:
        raise ValueError("无法关闭最后一个标签页")

    current_url = context.page.url
    await context.page.close()

    remaining_pages = contexts[0].pages
    if remaining_pages:
        context.page = remaining_pages[-1]
        await context.log("info", f"关闭标签页 {current_url}，切换到 {context.page.url}")
    else:
        context.page = None
        await context.log("info", f"关闭标签页 {current_url}，没有剩余标签页")

    return {"closed_url": current_url, "current_url": context.page.url if context.page else None}


@register_action(
    name="select_option",
    label="下拉选择",
    description="在下拉框中选择指定选项",
    category="browser",
    parameters={
        "type": "object",
        "properties": {
            "selector": {
                "type": "string",
                "description": "CSS选择器"
            },
            "ai_target": {
                "type": "string",
                "description": "AI定位目标描述（当 selector 不存在时使用）"
            },
            "value": {
                "type": "string",
                "description": "要选择的选项值（option的value属性）"
            },
            "label": {
                "type": "string",
                "description": "要选择的选项文本（option的显示文本），与 value 二选一"
            }
        },
        "required": []
    },
    inputs=["flow"],
    outputs=["flow"]
)
async def select_option_action(context: Any, config: Dict[str, Any]) -> Dict[str, Any]:
    """在下拉框中选择指定选项。"""
    if not context.page:
        raise ValueError("页面未初始化")

    selector = config.get("selector")
    ai_target = config.get("ai_target")
    
    if not selector and not ai_target:
        raise ValueError("select_option 节点需要 selector 或 ai_target 参数")

    value = config.get("value")
    label = config.get("label")

    if not value and not label:
        raise ValueError("必须提供 value 或 label 参数")

    target_desc = selector or ai_target
    
    try:
        element = await locate_element(
            context.page,
            selector,
            ai_target,
            context,
            wait_for_visible=True,
            timeout=30000
        )

        if value:
            await element.select_option(value=value)
            await context.log("info", f"选择下拉框选项（value）: {target_desc} = {value}")
        else:
            await element.select_option(label=label)
            await context.log("info", f"选择下拉框选项（label）: {target_desc} = {label}")
    except ValueError as e:
        await context.log("error", f"选择下拉框失败: {target_desc}, 错误: {str(e)}")
        raise

    return {"selector": target_desc, "selected_value": value, "selected_label": label}


@register_action(
    name="scroll",
    label="滚动页面",
    description="滚动页面到指定位置",
    category="browser",
    parameters={
        "type": "object",
        "properties": {
            "pixels": {
                "type": "integer",
                "description": "滚动像素数，正数向下滚动，负数向上滚动"
            },
            "to_bottom": {
                "type": "boolean",
                "description": "是否滚动到页面底部"
            },
            "to_top": {
                "type": "boolean",
                "description": "是否滚动到页面顶部"
            }
        }
    },
    inputs=["flow"],
    outputs=["flow"]
)
async def scroll_action(context: Any, config: Dict[str, Any]) -> Dict[str, Any]:
    """滚动页面。"""
    if not context.page:
        raise ValueError("页面未初始化")

    pixels = config.get("pixels")
    to_bottom = config.get("to_bottom", False)
    to_top = config.get("to_top", False)

    if to_bottom:
        await context.page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await context.log("info", "滚动到页面底部")
        return {"action": "to_bottom"}
    elif to_top:
        await context.page.evaluate("window.scrollTo(0, 0)")
        await context.log("info", "滚动到页面顶部")
        return {"action": "to_top"}
    elif pixels is not None:
        await context.page.evaluate(f"window.scrollBy(0, {pixels})")
        direction = "向下" if pixels > 0 else "向上"
        await context.log("info", f"{direction}滚动 {abs(pixels)} 像素")
        return {"action": "scroll", "pixels": pixels}
    else:
        raise ValueError("必须提供 pixels、to_bottom 或 to_top 参数")
