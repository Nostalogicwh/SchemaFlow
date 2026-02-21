"""公共工具函数。"""
import re
from typing import Dict, Any


async def locate_element(page, selector: str = None, ai_target: str = None, context=None):
    """统一的元素定位函数。

    优先使用 selector，若为空则使用 ai_target 语义定位。

    Args:
        page: Playwright 页面实例
        selector: CSS 选择器（优先）
        ai_target: 语义描述目标元素
        context: 执行上下文（用于日志）

    Returns:
        定位到的 Locator

    Raises:
        ValueError: 未提供 selector 或 ai_target
    """
    if selector:
        return page.locator(selector)
    if ai_target:
        return await _locate_by_ai_target(page, ai_target, context)
    raise ValueError("必须提供 selector 或 ai_target")


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
                await context.log("info", f"AI 定位成功 [{name}]: {ai_target} (匹配 {count} 个)")
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
