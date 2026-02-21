"""浏览器管理器 - 负责浏览器连接和生命周期管理。"""
import logging
from typing import Tuple, Optional, List
import socket
import subprocess
import re
import sys

from playwright.async_api import Error

logger = logging.getLogger(__name__)


class BrowserManager:
    """浏览器连接和生命周期管理。

    负责：
    - 通过 CDP 连接用户本地浏览器（保留登录态）
    - 自动发现 Chrome 调试端口
    - 页面复用逻辑
    - 资源清理
    
    重要：本管理器不存储任何用户数据到服务端，所有登录态依赖本地 Chrome
    """

    # 常见 Chrome 调试端口
    COMMON_DEBUG_PORTS = [9222, 9223, 9224, 9225, 9333]

    def __init__(self):
        self.playwright = None
        self._connected_port: Optional[int] = None

    def _check_port_open(self, host: str, port: int, timeout: float = 2.0) -> bool:
        """检查指定端口是否开放。"""
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(timeout)
            result = sock.connect_ex((host, port))
            sock.close()
            return result == 0
        except Exception:
            return False

    def _find_chrome_debug_ports(self) -> List[int]:
        """查找所有开放的 Chrome 调试端口。"""
        open_ports = []
        
        # 检查常见端口
        for port in self.COMMON_DEBUG_PORTS:
            if self._check_port_open("127.0.0.1", port):
                # 验证是否是 Chrome 调试端口
                try:
                    import urllib.request
                    with urllib.request.urlopen(
                        f"http://127.0.0.1:{port}/json/version", 
                        timeout=2
                    ) as response:
                        data = response.read().decode('utf-8')
                        if "Browser" in data or "Chrome" in data:
                            open_ports.append(port)
                except Exception:
                    pass
        
        return open_ports

    def _get_chrome_launch_command(self) -> str:
        """根据操作系统获取启动 Chrome 的命令。"""
        if sys.platform == "darwin":  # macOS
            return (
                "/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome \\\n"
                "  --remote-debugging-port=9222 \\\n"
                "  > /tmp/chrome.log 2>&1 &"
            )
        elif sys.platform == "win32":  # Windows
            return (
                '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" ^\n'
                "  --remote-debugging-port=9222"
            )
        else:  # Linux
            return (
                "google-chrome \\\n"
                "  --remote-debugging-port=9222 \\\n"
                "  > /tmp/chrome.log 2>&1 &"
            )

    async def connect(self, context, headless: bool = True) -> Tuple[bool, bool]:
        """连接浏览器。

        自动发现本地 Chrome 的调试端口并连接。

        Args:
            context: 执行上下文
            headless: 是否无头模式（仅独立浏览器有效）

        Returns:
            (is_cdp, reused_page) - 是否 CDP 模式和是否复用页面
        """
        logger.info(f"[{context.execution_id}] 浏览器连接开始")
        await context.log("debug", f"BrowserManager.connect() 开始")

        if context.browser is not None and context.page is None:
            # browser存在但page被关闭，需要创建新页面
            is_cdp = getattr(context, '_is_cdp', False)
            await context.log("info", f"Browser已连接，创建新页面（CDP模式: {is_cdp}）")
            if is_cdp and context.browser.contexts:
                default_context = context.browser.contexts[0]
                context.page = await default_context.new_page()
                await context.log("info", "在现有 BrowserContext 中创建新页面（保持登录态）")
            else:
                context.page = await context.browser.new_page()
            context._reused_page = False
            return is_cdp, False

        if context.browser is not None or context.page is not None:
            is_cdp = getattr(context, '_is_cdp', False)
            reused_page = getattr(context, '_reused_page', False)
            await context.log("debug", f"浏览器已连接，复用现有状态")
            return is_cdp, reused_page

        from playwright.async_api import async_playwright
        self.playwright = await async_playwright().start()

        # 自动发现 Chrome 调试端口
        await context.log("info", "正在搜索本地 Chrome 调试端口...")
        available_ports = self._find_chrome_debug_ports()
        
        if available_ports:
            await context.log("info", f"发现 {len(available_ports)} 个 Chrome 调试端口: {available_ports}")
        else:
            await context.log("warn", "未发现任何 Chrome 调试端口")

        # 尝试连接第一个可用的端口
        for port in available_ports:
            cdp_url = f"http://127.0.0.1:{port}"
            try:
                await context.log("info", f"尝试连接 Chrome (端口 {port})...")
                context.browser = await self.playwright.chromium.connect_over_cdp(cdp_url)
                self._connected_port = port
                
                default_context = context.browser.contexts[0]
                existing_pages = default_context.pages
                
                await context.log("info", f"✓ 成功连接到 Chrome (端口 {port})")
                logger.info(f"[{context.execution_id}] 浏览器连接成功: 端口 {port}, 已有页面 {len(existing_pages)} 个")
                await context.log("info", f"  已有页面: {len(existing_pages)} 个")
                
                for i, p in enumerate(existing_pages[:3]):  # 只显示前3个
                    await context.log("info", f"    - {p.url[:80]}{'...' if len(p.url) > 80 else ''}")

                # 寻找可复用的页面
                reused = None
                for p in existing_pages:
                    if p.url and p.url != "about:blank":
                        reused = p
                        break

                if reused:
                    context.page = reused
                    context._reused_page = True
                    await context.log("info", f"✓ 复用已有页面: {reused.url[:60]}...")
                else:
                    context.page = await default_context.new_page()
                    context._reused_page = False
                    await context.log("info", "创建新页面")

                context._is_cdp = True
                return True, context._reused_page

            except Error as e:
                await context.log("debug", f"端口 {port} 连接失败: {e}")
                continue

        # 所有端口都连接失败
        logger.warning(f"[{context.execution_id}] 无法连接到本地 Chrome 调试端口，启动独立浏览器")
        await context.log("error", "=" * 70)
        await context.log("error", "无法连接到本地 Chrome")
        await context.log("error", "=" * 70)
        await context.log("error", "")
        await context.log("error", "检测到您正在运行的 Chrome 没有开启远程调试端口。")
        await context.log("error", "")
        await context.log("error", "解决方案（二选一）：")
        await context.log("error", "")
        await context.log("error", "【方案1】开启当前 Chrome 的调试端口（推荐）：")
        await context.log("error", "  1. 完全退出 Chrome（Cmd+Q 或右键退出）")
        await context.log("error", "  2. 在终端执行以下命令重启 Chrome：")
        await context.log("error", "")
        await context.log("error", self._get_chrome_launch_command())
        await context.log("error", "")
        await context.log("error", "  3. 在 Chrome 中登录 DeepSeek")
        await context.log("error", "  4. 重新运行工作流")
        await context.log("error", "")
        await context.log("error", "【方案2】使用独立浏览器（无登录态）：")
        await context.log("error", "  工作流将在独立浏览器中运行，需要手动登录")
        await context.log("error", "")
        await context.log("error", "=" * 70)
        
        # 回退到独立浏览器
        await context.log("warn", "启动独立浏览器（无登录态）...")
        context.browser = await self.playwright.chromium.launch(headless=headless)
        context.page = await context.browser.new_page()
        context._is_cdp = False
        context._reused_page = False
        return False, False

    async def cleanup(self, context):
        """清理浏览器资源。"""
        logger.info(f"[{context.execution_id}] 开始清理浏览器资源")
        is_cdp = getattr(context, '_is_cdp', False)
        reused_page = getattr(context, '_reused_page', False)
        
        if is_cdp:
            if not reused_page:
                try:
                    if context.page and not context.page.is_closed():
                        await context.page.close()
                        await context.log("debug", "关闭新创建的页面")
                except Error:
                    pass
        elif self.playwright is not None:
            try:
                await self.playwright.stop()
                logger.info(f"[{context.execution_id}] 独立浏览器已关闭")
            except Error:
                pass
