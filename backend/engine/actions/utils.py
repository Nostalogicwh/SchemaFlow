"""公共工具函数。"""
import re
from typing import Dict, Any, Optional

from ..ai_locator import locate_with_ai


async def locate_element(
    page, 
    selector: Optional[str] = None, 
    ai_target: Optional[str] = None, 
    context=None,
    wait_for_visible: bool = True,
    timeout: int = 30000
):
    """定位页面元素，支持CSS选择器或AI定位（增强版）。

    Args:
        page: Playwright页面对象
        selector: CSS选择器（可选）
        ai_target: AI定位描述（可选）
        context: 执行上下文，用于AI定位
        wait_for_visible: 是否等待元素可见
        timeout: 超时时间（毫秒）

    Returns:
        Playwright Locator对象

    Raises:
        ValueError: 无法定位元素时
    """
    locator = None
    used_selector = selector
    
    # 1. 如果提供了AI目标，使用AI定位
    if ai_target and not selector:
        if not context:
            raise ValueError("AI定位需要提供context")
        try:
            used_selector = await locate_with_ai(
                page, 
                ai_target, 
                context,
                timeout=timeout,
                enable_fallback=True
            )
        except ValueError as e:
            # 如果AI定位失败，尝试直接回退策略
            from ..ai_locator import try_fallback_strategies
            fallback_selector, fallback_locator = await try_fallback_strategies(page, ai_target, context)
            if fallback_selector and fallback_locator:
                await context.log("info", f"AI定位失败，使用回退策略: {fallback_selector}")
                used_selector = fallback_selector
                locator = fallback_locator
            else:
                raise e
    
    if not used_selector:
        raise ValueError("必须提供 selector 或 ai_target 参数")
    
    # 2. 创建locator（如果还没有）
    if locator is None:
        locator = page.locator(used_selector)
    
    # 3. 等待元素出现和可见
    if wait_for_visible:
        try:
            await locator.wait_for(state="visible", timeout=timeout)
            
            # 额外检查元素是否真的存在
            count = await locator.count()
            if count == 0:
                raise ValueError(f"选择器未匹配到任何元素: {used_selector}")
            
            if context:
                await context.log("debug", f"元素定位成功: {used_selector} (匹配 {count} 个)")
                
        except TimeoutError:
            if context:
                await context.log("error", f"等待元素超时: {used_selector}")
            raise ValueError(f"等待元素超时 ({timeout}ms): {used_selector}")
        except (TimeoutError, ValueError) as e:
            if context:
                await context.log("error", f"元素定位失败: {used_selector}, 错误: {str(e)}")
            raise ValueError(f"元素定位失败: {used_selector}, 错误: {str(e)}")
    
    return locator


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
