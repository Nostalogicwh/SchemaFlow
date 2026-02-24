"""公共工具函数。"""

import re
from typing import Dict, Any, Optional


async def locate_element(
    page,
    selector: Optional[str] = None,
    ai_target: Optional[str] = None,
    context=None,
    wait_for_visible: bool = True,
    timeout: int = 30000,
):
    """定位页面元素，支持CSS选择器或AI定位（混合模式）。

    使用 HybridElementLocator 实现 CSS 选择器优先 + AI 后备的定位策略。

    Args:
        page: Playwright页面对象
        selector: CSS选择器（可选，优先级最高）
        ai_target: AI定位描述（可选，用于AI后备定位）
        context: 执行上下文，用于AI定位
        wait_for_visible: 是否等待元素可见
        timeout: 超时时间（毫秒）

    Returns:
        (Playwright Locator对象, effective_selector字符串) 元组

    Raises:
        ValueError: 无法定位元素时
    """
    if not selector and not ai_target:
        raise ValueError("必须提供 selector 或 ai_target 参数")

    if not context:
        raise ValueError("元素定位需要提供 context")

    # 检查是否启用 AI 后备
    enable_ai_fallback = getattr(context, "enable_ai_fallback", True)

    # 使用混合定位器
    from ..ai.locator import HybridElementLocator

    locator_manager = HybridElementLocator(page, context)

    try:
        # 执行混合定位
        result = await locator_manager.locate(
            target_description=ai_target or selector or "",
            saved_selector=selector,
            enable_ai_fallback=enable_ai_fallback and ai_target is not None,
            timeout=timeout,
        )

        await context.log(
            "info", f"元素定位成功: {result.selector} (方法: {result.method})"
        )

        # 创建 locator
        locator = page.locator(result.selector)

        # 等待元素可见
        if wait_for_visible:
            await locator.wait_for(state="visible", timeout=timeout)
            count = await locator.count()
            if count == 0:
                raise ValueError(f"选择器未匹配到任何元素: {result.selector}")
            await context.log(
                "debug", f"元素已可见: {result.selector} (匹配 {count} 个)"
            )

        # 返回 locator 和 effective_selector
        return locator, result.selector

    except ValueError as e:
        await context.log("error", f"元素定位失败: {str(e)}")
        raise
    except Exception as e:
        await context.log("error", f"元素定位异常: {str(e)}")
        raise ValueError(f"元素定位失败: {str(e)}")


async def _locate_by_ai_target(page, ai_target: str, context=None):
    """基于语义描述定位元素。

    Args:
        page: Playwright 页面实例
        ai_target: 用户描述的目标元素（如"登录按钮"、"搜索框"）
        context: 执行上下文（用于日志）

    Returns:
        定位到的 Locator

    Raises:
        ValueError: 未找到匹配元素
    """
    strategies = [
        ("get_by_role('button')", lambda: page.get_by_role("button", name=ai_target)),
        ("get_by_role('link')", lambda: page.get_by_role("link", name=ai_target)),
        ("get_by_text", lambda: page.get_by_text(ai_target, exact=False)),
        ("get_by_placeholder", lambda: page.get_by_placeholder(ai_target)),
        ("get_by_label", lambda: page.get_by_label(ai_target)),
        ("aria-label", lambda: page.locator(f"[aria-label*='{ai_target}']")),
        ("title", lambda: page.locator(f"[title*='{ai_target}']")),
    ]

    for name, get_locator in strategies:
        locator = get_locator()
        count = await locator.count()
        if count > 0:
            if context:
                await context.log(
                    "info", f"AI 定位成功 [{name}]: {ai_target} (匹配 {count} 个)"
                )
            return locator.first
    raise ValueError(f"AI 定位失败: 未找到匹配「{ai_target}」的元素")


def resolve_variables(config: Any, variables: Dict[str, Any]) -> Any:
    """解析变量引用 {{variable_name}}。

    递归处理字典、列表和字符串中的变量引用。

    Args:
        config: 要解析的配置（可以是字典、列表、字符串或其他类型）
        variables: 变量字典

    Returns:
        解析后的配置
    """

    def resolve_value(value):
        if isinstance(value, str):
            pattern = r"\{\{(\w+)\}\}"
            matches = list(re.finditer(pattern, value))

            if matches:
                result = value
                for match in reversed(matches):
                    var_name = match.group(1)
                    var_value = str(variables.get(var_name, match.group(0)))
                    result = result[: match.start()] + var_value + result[match.end() :]
                return result
            return value
        elif isinstance(value, dict):
            return {k: resolve_value(v) for k, v in value.items()}
        elif isinstance(value, list):
            return [resolve_value(v) for v in value]
        return value

    return resolve_value(config)
