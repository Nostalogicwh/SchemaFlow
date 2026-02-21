"""浏览器管理器 - 负责浏览器连接和生命周期管理。"""
from typing import Tuple, Optional


class BrowserManager:
    """浏览器连接和生命周期管理。

    负责：
    - 通过 CDP 连接用户本地浏览器（保留登录态）
    - 降级启动独立浏览器
    - 页面复用逻辑
    - 资源清理
    """

    def __init__(self):
        self.playwright = None
        self._is_cdp: bool = False
        self._reused_page: bool = False

    async def connect(self, context, headless: bool = True) -> Tuple[bool, bool]:
        """连接浏览器。

        Args:
            context: 执行上下文
            headless: 是否无头模式（仅独立浏览器有效）

        Returns:
            (is_cdp, reused_page) - 是否 CDP 模式和是否复用页面
        """
        if context.browser is not None and context.page is None:
            context.page = await context.browser.new_page()
            return False, False

        if context.browser is not None or context.page is not None:
            return getattr(context, '_is_cdp', False), getattr(context, '_reused_page', False)

        from playwright.async_api import async_playwright
        self.playwright = await async_playwright().start()

        try:
            from config import get_settings
            cdp_url = get_settings()["browser"]["cdp_url"]
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
                self._reused_page = True
                context._reused_page = True
                await context.log("info", f"已复用已有页面: {reused.url}")
            else:
                context.page = await default_context.new_page()
                self._reused_page = False
                context._reused_page = False

            self._is_cdp = True
            context._is_cdp = True
            await context.log("info", "已连接本地浏览器（CDP 模式）")
            return True, self._reused_page

        except Exception as e:
            context.browser = await self.playwright.chromium.launch(headless=headless)
            context.page = await context.browser.new_page()
            self._is_cdp = False
            context._is_cdp = False
            self._reused_page = False
            context._reused_page = False
            await context.log("warn", f"未检测到本地浏览器调试端口，已启动独立浏览器（无登录态）: {e}")
            return False, False

    async def cleanup(self, context):
        """清理浏览器资源。

        CDP 模式：复用的页面不关闭，新建的页面才关闭
        独立模式：关闭整个 playwright 进程
        """
        if self._is_cdp:
            if not self._reused_page:
                try:
                    if context.page and not context.page.is_closed():
                        await context.page.close()
                except Exception:
                    pass
        elif self.playwright is not None:
            try:
                await self.playwright.stop()
            except Exception:
                pass

    @property
    def is_cdp(self) -> bool:
        return self._is_cdp

    @property
    def reused_page(self) -> bool:
        return self._reused_page
