"""浏览器管理器 - 负责浏览器连接和生命周期管理。"""
from typing import Tuple, Optional

from playwright.async_api import Error


class BrowserManager:
    """浏览器连接和生命周期管理。

    负责：
    - 通过 CDP 连接用户本地浏览器（保留登录态）
    - 降级启动独立浏览器
    - 页面复用逻辑
    - 资源清理
    
    注：状态(_is_cdp, _reused_page)存储在context中，避免状态冗余
    """

    def __init__(self):
        self.playwright = None

    async def connect(self, context, headless: bool = True) -> Tuple[bool, bool]:
        """连接浏览器。

        Args:
            context: 执行上下文
            headless: 是否无头模式（仅独立浏览器有效）

        Returns:
            (is_cdp, reused_page) - 是否 CDP 模式和是否复用页面
        """
        await context.log("debug", f"BrowserManager.connect() 开始 - browser存在: {context.browser is not None}, page存在: {context.page is not None}")

        if context.browser is not None and context.page is None:
            # browser存在但page被关闭，需要创建新页面
            is_cdp = getattr(context, '_is_cdp', False)
            await context.log("info", f"Browser已连接，创建新页面（CDP模式: {is_cdp}）")
            context.page = await context.browser.new_page()
            context._reused_page = False
            await context.log("debug", f"新页面创建成功，返回状态: is_cdp={is_cdp}, reused_page=False")
            return is_cdp, False

        if context.browser is not None or context.page is not None:
            is_cdp = getattr(context, '_is_cdp', False)
            reused_page = getattr(context, '_reused_page', False)
            await context.log("debug", f"浏览器已连接，复用现有状态: is_cdp={is_cdp}, reused_page={reused_page}")
            return is_cdp, reused_page

        from playwright.async_api import async_playwright
        await context.log("debug", "启动 Playwright，尝试 CDP 连接...")
        self.playwright = await async_playwright().start()

        try:
            from config import get_settings
            cdp_url = get_settings()["browser"]["cdp_url"]
            await context.log("debug", f"尝试连接 CDP: {cdp_url}")
            context.browser = await self.playwright.chromium.connect_over_cdp(cdp_url)
            default_context = context.browser.contexts[0]
            await context.log("info", f"CDP 连接成功，contexts 数量: {len(context.browser.contexts)}")
            existing_pages = default_context.pages
            await context.log("info", f"已有页面数量: {len(existing_pages)}")
            for i, p in enumerate(existing_pages):
                await context.log("info", f"  页面 {i}: {p.url}")

            reused = None
            for p in existing_pages:
                if p.url and p.url != "about:blank":
                    reused = p
                    break

            if reused:
                context.page = reused
                context._reused_page = True
                await context.log("info", f"已复用已有页面: {reused.url}")
            else:
                context.page = await default_context.new_page()
                context._reused_page = False
                await context.log("info", "已创建新页面（在 CDP 模式下）")

            context._is_cdp = True
            reused_page = context._reused_page
            await context.log("info", f"已连接本地浏览器（CDP 模式），reused_page={reused_page}")
            return True, reused_page

        except Error as e:
            await context.log("warn", f"CDP 连接失败: {e}")
            context.browser = await self.playwright.chromium.launch(headless=headless)
            context.page = await context.browser.new_page()
            context._is_cdp = False
            context._reused_page = False
            await context.log("warn", f"已启动独立浏览器（无登录态）")
            return False, False

    async def cleanup(self, context):
        """清理浏览器资源。

        CDP 模式：复用的页面不关闭，新建的页面才关闭
        独立模式：关闭整个 playwright 进程
        """
        is_cdp = getattr(context, '_is_cdp', False)
        reused_page = getattr(context, '_reused_page', False)
        await context.log("debug", f"BrowserManager.cleanup() 开始 - is_cdp={is_cdp}, reused_page={reused_page}")

        if is_cdp:
            await context.log("debug", f"CDP 模式清理 - reused_page={reused_page}")
            if not reused_page:
                try:
                    if context.page and not context.page.is_closed():
                        await context.page.close()
                        await context.log("debug", "已关闭 CDP 模式下创建的新页面")
                except Error as e:
                    await context.log("debug", f"关闭页面时出错: {e}")
            else:
                await context.log("debug", "复用的页面保持打开（不关闭）")
        elif self.playwright is not None:
            await context.log("debug", "独立浏览器模式，停止 Playwright")
            try:
                await self.playwright.stop()
                await context.log("debug", "Playwright 已停止")
            except Error as e:
                await context.log("debug", f"停止 Playwright 时出错: {e}")
        else:
            await context.log("debug", "无需要清理的资源")
