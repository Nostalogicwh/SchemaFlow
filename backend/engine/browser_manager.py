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

    async def connect(self, context, headless: bool = True, storage_state=None) -> Tuple[bool, bool]:
        """连接浏览器。

        启动独立浏览器，支持注入 storage_state 恢复登录态。

        Args:
            context: 执行上下文
            headless: 是否无头模式
            storage_state: 可选，前端传入的凭证 JSON，直接注入 context

        Returns:
            (is_cdp, reused_page) - 固定返回 (False, False)，保留接口兼容
        """
        logger.info(f"[{context.execution_id}] 浏览器连接开始")
        await context.log("debug", f"BrowserManager.connect() 开始")

        if context.browser is not None:
            is_cdp = getattr(context, '_is_cdp', False)
            await context.log("info", f"浏览器已连接，复用现有状态")
            return is_cdp, getattr(context, '_reused_page', False)

        from playwright.async_api import async_playwright
        self.playwright = await async_playwright().start()

        # 仅当用户在 settings 中明确配置了 cdp_url 时才尝试 CDP
        cdp_url = None
        try:
            from config import get_settings
            cdp_url = get_settings().get("browser", {}).get("cdp_url_manual")
        except Exception:
            pass

        if cdp_url:
            try:
                await context.log("info", f"尝试 CDP 连接: {cdp_url}")
                context.browser = await self.playwright.chromium.connect_over_cdp(cdp_url)
                self._connected_port = 0  # CDP 不使用端口号
                
                if storage_state:
                    # CDP 模式下无法直接注入 storage_state 到新 context
                    # 需要创建新 context
                    context._context = await context.browser.new_context(storage_state=storage_state)
                    context.page = await context._context.new_page()
                else:
                    default_context = context.browser.contexts[0]
                    context.page = await default_context.new_page()
                
                context._is_cdp = True
                context._reused_page = False
                await context.log("info", f"✓ CDP 连接成功")
                return True, False
            except Exception as e:
                await context.log("warning", f"CDP 连接失败: {e}，回退到独立浏览器")

        # 默认路径：启动独立浏览器
        await context.log("info", "启动独立浏览器...")
        context.browser = await self.playwright.chromium.launch(headless=headless)

        if storage_state:
            context._context = await context.browser.new_context(storage_state=storage_state)
            await context.log("info", "已注入登录凭证")
        else:
            context._context = await context.browser.new_context()

        context.page = await context._context.new_page()
        context._is_cdp = False
        context._reused_page = False
        
        return False, False

    async def cleanup(self, context):
        """清理浏览器资源。"""
        logger.info(f"[{context.execution_id}] 开始清理浏览器资源")
        is_cdp = getattr(context, '_is_cdp', False)
        
        if is_cdp:
            # CDP 模式下，如果有独立创建的 context，需要关闭
            custom_context = getattr(context, '_context', None)
            if custom_context:
                try:
                    await custom_context.close()
                    await context.log("debug", "关闭自定义 context")
                except Exception:
                    pass
        
        if self.playwright is not None:
            try:
                await self.playwright.stop()
                logger.info(f"[{context.execution_id}] 浏览器已关闭")
            except Exception:
                pass
