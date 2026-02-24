"""元素定位模块 - 支持 CSS 选择器和 AI 后备定位。"""

import json
from typing import Dict, Any, Optional, Tuple
from playwright.async_api import Page, Locator


class HybridElementLocator:
    """混合元素定位器 - 优先使用 CSS，失败时启用 AI 定位。"""

    def __init__(self, page: Page):
        self.page = page

    async def locate(
        self,
        selector: Optional[str] = None,
        ai_target: Optional[str] = None,
        context: Any = None,
    ) -> Tuple[Locator, Optional[str]]:
        """定位元素。

        Args:
            selector: CSS 选择器
            ai_target: AI 定位目标描述
            context: 执行上下文（用于日志和 AI 调用）

        Returns:
            (locator, effective_selector) - 定位器和实际使用的 CSS 选择器
        """
        # 优先尝试 CSS 选择器
        if selector:
            try:
                locator = self.page.locator(selector)
                # 检查元素是否存在且可见
                count = await locator.count()
                if count > 0:
                    is_visible = await locator.first.is_visible()
                    if is_visible:
                        if context:
                            await context.log("info", f"CSS 选择器定位成功: {selector}")
                        return locator, selector
                    else:
                        if context:
                            await context.log(
                                "warn", f"CSS 选择器定位到元素但不可见: {selector}"
                            )
                else:
                    if context:
                        await context.log("warn", f"CSS 选择器未找到元素: {selector}")
            except Exception as e:
                if context:
                    await context.log(
                        "warn", f"CSS 选择器定位失败: {selector}, 错误: {e}"
                    )

        # CSS 失败且有 AI 目标时，使用 AI 定位
        if ai_target and context:
            return await self._locate_with_ai(ai_target, context)

        # 都没有成功
        if selector:
            raise ValueError(f"无法定位元素，CSS 选择器失效: {selector}")
        elif ai_target:
            raise ValueError(f"无法定位元素，AI 定位未实现: {ai_target}")
        else:
            raise ValueError("必须提供 selector 或 ai_target 参数")

    async def _locate_with_ai(
        self, ai_target: str, context: Any
    ) -> Tuple[Locator, Optional[str]]:
        """使用 AI 定位元素。

        Args:
            ai_target: AI 定位目标描述
            context: 执行上下文

        Returns:
            (locator, effective_selector) - 定位器和最佳 CSS 选择器
        """
        await context.log("info", f"启动 AI 定位: {ai_target}")

        # 获取页面信息和候选元素
        page_info = await self._get_page_info()

        # 调用 AI 获取最佳定位策略
        selector = await self._ask_ai_for_selector(ai_target, page_info, context)

        if selector:
            await context.log("info", f"AI 定位成功，选择器: {selector}")
            locator = self.page.locator(selector)

            # 验证 AI 返回的选择器是否有效
            try:
                count = await locator.count()
                if count > 0:
                    return locator, selector
            except Exception:
                pass

            await context.log("warn", f"AI 返回的选择器无效: {selector}")

        raise ValueError(f"AI 定位失败: {ai_target}")

    async def _get_page_info(self) -> Dict[str, Any]:
        """获取当前页面信息供 AI 分析。

        Returns:
            页面信息字典
        """
        # 获取页面标题和 URL
        title = await self.page.title()
        url = self.page.url

        # 获取可交互元素列表（简化版本）
        elements = await self.page.evaluate("""
            () => {
                const interactive = [];
                const tags = ['button', 'a', 'input', 'textarea', 'select'];

                tags.forEach(tag => {
                    document.querySelectorAll(tag).forEach((el, idx) => {
                        const rect = el.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0) {
                            interactive.push({
                                tag: tag,
                                text: el.textContent?.trim()?.substring(0, 50) || '',
                                placeholder: el.placeholder || '',
                                id: el.id || '',
                                class: el.className || '',
                                type: el.type || '',
                                selector: tag + (el.id ? '#' + el.id : '') +
                                         (el.className ? '.' + el.className.split(' ')[0] : '')
                            });
                        }
                    });
                });

                return interactive.slice(0, 50);  // 限制数量
            }
        """)

        return {"title": title, "url": url, "elements": elements}

    async def _ask_ai_for_selector(
        self, ai_target: str, page_info: Dict[str, Any], context: Any
    ) -> Optional[str]:
        """询问 AI 最佳元素选择器。

        Args:
            ai_target: 目标描述
            page_info: 页面信息
            context: 执行上下文

        Returns:
            CSS 选择器或 None
        """
        # 构建提示词
        prompt = f"""你是一个网页元素定位专家。请根据页面信息和用户目标，返回最佳的 CSS 选择器。

用户目标: {ai_target}

页面标题: {page_info["title"]}
页面 URL: {page_info["url"]}

页面上的可交互元素:
{json.dumps(page_info["elements"][:20], indent=2, ensure_ascii=False)}

请分析并返回:
1. 最匹配的 CSS 选择器（优先考虑 id、特定 class、或独特的属性组合）
2. 只返回选择器字符串，不要其他解释

CSS 选择器:"""

        try:
            # 调用 AI API（使用 context 中的方法）
            if hasattr(context, "call_ai") and callable(context.call_ai):
                response = await context.call_ai(prompt)
                # 清理响应，提取选择器
                selector = response.strip().strip('"').strip("'")
                if selector and not selector.lower().startswith("not found"):
                    return selector
            else:
                await context.log("warn", "上下文未提供 call_ai 方法，无法使用 AI 定位")
        except Exception as e:
            await context.log("error", f"AI 调用失败: {e}")

        return None


async def locate_element(
    page: Page,
    selector: Optional[str] = None,
    ai_target: Optional[str] = None,
    context: Any = None,
) -> Tuple[Locator, Optional[str]]:
    """便捷函数 - 定位元素。

    Args:
        page: Playwright 页面对象
        selector: CSS 选择器
        ai_target: AI 定位目标描述
        context: 执行上下文

    Returns:
        (locator, effective_selector) - 定位器和实际使用的 CSS 选择器
    """
    locator = HybridElementLocator(page)
    return await locator.locate(selector, ai_target, context)
