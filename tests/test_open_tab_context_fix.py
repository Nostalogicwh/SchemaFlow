"""测试浏览器登录态保持 - 重点测试 open_tab 节点。

测试场景：
1. CDP 模式下，当需要创建新页面时，应该在现有 context 中创建
2. 验证新页面继承登录态（cookies、localStorage 等）
"""
import asyncio
import sys
from pathlib import Path
from unittest.mock import MagicMock, AsyncMock, patch, call
import pytest

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from backend.engine.actions.browser import open_tab_action


class MockContext:
    """模拟执行上下文。"""
    def __init__(self):
        self.browser = None
        self.page = None
        self._is_cdp = False
        self._reused_page = False
        self.logs = []

    async def log(self, level, message):
        self.logs.append((level, message))
        print(f"[{level}] {message}")


@pytest.mark.asyncio
async def test_open_tab_creates_page_in_existing_context_cdp():
    """测试：CDP 模式下创建新页面时，使用现有 context 而不是 browser.new_page()。
    
    这是修复的关键：确保新页面继承登录态。
    """
    print("\n=== 测试场景：CDP 模式下在现有 context 中创建新页面 ===")
    
    context = MockContext()
    context._is_cdp = True
    
    # 模拟 browser 和 context
    mock_browser = MagicMock()
    mock_browser_context = MagicMock()
    mock_new_page = AsyncMock()
    
    # 设置 mocks
    mock_browser.contexts = [mock_browser_context]
    mock_browser_context.pages = []  # 没有现有页面
    mock_browser_context.new_page = mock_new_page
    mock_browser.new_page = AsyncMock()  # 这个不应该被调用
    
    context.browser = mock_browser
    context.page = None  # 需要创建新页面
    
    # 创建 mock 页面
    mock_page = MagicMock()
    mock_page.goto = AsyncMock()
    mock_new_page.return_value = mock_page
    
    # 执行 open_tab_action
    result = await open_tab_action(context, {"url": "https://chat.deepseek.com/"})
    
    # 验证：使用了 context.new_page() 而不是 browser.new_page()
    assert mock_browser_context.new_page.called, "应该调用 context.new_page() 来保持登录态"
    assert not mock_browser.new_page.called, "不应该调用 browser.new_page()（会创建新 context，丢失登录态）"
    
    # 验证：page 被正确设置
    assert context.page == mock_page, "context.page 应该被设置为创建的新页面"
    
    # 验证：goto 被调用
    mock_page.goto.assert_called_once_with("https://chat.deepseek.com/", wait_until="networkidle")
    
    print("✓ 正确使用了 context.new_page()，新页面将在现有 context 中创建")
    print("✓ 登录态（cookies、localStorage）将被继承")


@pytest.mark.asyncio
async def test_open_tab_reuses_existing_page_cdp():
    """测试：CDP 模式下如果有现有页面，应该复用。"""
    print("\n=== 测试场景：CDP 模式下复用现有页面 ===")
    
    context = MockContext()
    context._is_cdp = True
    
    # 模拟已有页面
    mock_existing_page = MagicMock()
    mock_existing_page.url = "https://example.com"
    mock_existing_page.goto = AsyncMock()
    
    mock_browser = MagicMock()
    mock_browser_context = MagicMock()
    mock_browser_context.pages = [mock_existing_page]
    mock_browser.contexts = [mock_browser_context]
    
    context.browser = mock_browser
    context.page = None  # 需要获取页面
    
    # 执行 open_tab_action
    result = await open_tab_action(context, {"url": "https://chat.deepseek.com/"})
    
    # 验证：复用了现有页面
    assert context.page == mock_existing_page, "应该复用现有页面"
    mock_existing_page.goto.assert_called_once()
    
    # 验证：没有创建新页面
    mock_browser_context.new_page.assert_not_called()
    mock_browser.new_page.assert_not_called()
    
    print("✓ 正确复用了现有页面")


@pytest.mark.asyncio
async def test_open_tab_non_cdp_mode():
    """测试：非 CDP 模式下直接创建新页面。"""
    print("\n=== 测试场景：非 CDP 模式下创建新页面 ===")
    
    context = MockContext()
    context._is_cdp = False
    
    mock_browser = MagicMock()
    mock_new_page = AsyncMock()
    mock_browser.new_page = mock_new_page
    
    mock_page = MagicMock()
    mock_page.goto = AsyncMock()
    mock_new_page.return_value = mock_page
    
    context.browser = mock_browser
    context.page = None
    
    # 执行 open_tab_action
    result = await open_tab_action(context, {"url": "https://example.com"})
    
    # 验证：在非 CDP 模式下直接使用 browser.new_page()
    assert mock_browser.new_page.called, "非 CDP 模式下应该调用 browser.new_page()"
    assert context.page == mock_page
    
    print("✓ 非 CDP 模式下正确创建了新页面")


@pytest.mark.asyncio
async def test_open_tab_with_existing_page():
    """测试：如果已有 page，直接在当前页面跳转。"""
    print("\n=== 测试场景：已有 page，在当前页面跳转 ===")
    
    context = MockContext()
    context._is_cdp = True
    
    mock_page = MagicMock()
    mock_page.goto = AsyncMock()
    mock_page.url = "https://current.com"
    
    mock_browser = MagicMock()
    context.browser = mock_browser
    context.page = mock_page  # 已有页面
    
    # 执行 open_tab_action
    result = await open_tab_action(context, {"url": "https://chat.deepseek.com/"})
    
    # 验证：没有创建新页面，直接跳转
    mock_page.goto.assert_called_once_with("https://chat.deepseek.com/", wait_until="networkidle")
    
    print("✓ 在现有页面上直接跳转")


if __name__ == "__main__":
    print("=" * 70)
    print("浏览器登录态保持测试 - open_tab 修复验证")
    print("=" * 70)
    
    asyncio.run(test_open_tab_creates_page_in_existing_context_cdp())
    asyncio.run(test_open_tab_reuses_existing_page_cdp())
    asyncio.run(test_open_tab_non_cdp_mode())
    asyncio.run(test_open_tab_with_existing_page())
    
    print("\n" + "=" * 70)
    print("所有测试通过！登录态保持修复验证成功。")
    print("=" * 70)
