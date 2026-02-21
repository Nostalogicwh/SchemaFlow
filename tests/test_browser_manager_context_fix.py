"""测试 browser_manager 中创建新页面时保持登录态。

关键测试：当 page 被关闭后重新创建时，应该在现有 context 中创建。
"""
import asyncio
import sys
from pathlib import Path
from unittest.mock import MagicMock, AsyncMock, patch
import pytest

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from backend.engine.browser_manager import BrowserManager


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
async def test_browser_manager_creates_page_in_existing_context():
    """测试：BrowserManager 在 CDP 模式下重新创建 page 时，使用现有 context。
    
    这是修复的关键：browser.new_page() 会创建新 context（丢失登录态），
    而 context.new_page() 在现有 context 中创建（保持登录态）。
    """
    print("\n=== 测试场景：CDP 模式下 page 被关闭后重新创建 ===")
    
    context = MockContext()
    browser_mgr = BrowserManager()
    
    # 模拟 CDP 模式已连接，但 page 被关闭了
    mock_browser = MagicMock()
    mock_browser_context = MagicMock()
    mock_new_page = AsyncMock()
    
    mock_browser.contexts = [mock_browser_context]
    mock_browser_context.new_page = mock_new_page
    mock_browser.new_page = AsyncMock()  # 这个不应该被调用
    
    context.browser = mock_browser
    context.page = None  # page 被关闭
    context._is_cdp = True
    
    # 创建 mock 页面
    mock_page = MagicMock()
    mock_new_page.return_value = mock_page
    
    # 执行 connect
    is_cdp, reused = await browser_mgr.connect(context, headless=True)
    
    # 验证：使用了 context.new_page() 而不是 browser.new_page()
    assert mock_browser_context.new_page.called, "应该调用 context.new_page() 来保持登录态"
    assert not mock_browser.new_page.called, "不应该调用 browser.new_page()（会创建新 context，丢失登录态）"
    
    # 验证：返回正确的状态
    assert is_cdp == True
    assert reused == False  # 新创建的页面，不是复用
    assert context.page == mock_page
    
    print("✓ BrowserManager 正确使用了 context.new_page()，新页面将在现有 context 中创建")
    print("✓ 登录态（cookies、localStorage）将被继承")


@pytest.mark.asyncio
async def test_browser_manager_non_cdp_creates_new_context():
    """测试：非 CDP 模式下直接创建新页面。"""
    print("\n=== 测试场景：非 CDP 模式下创建新页面 ===")
    
    context = MockContext()
    browser_mgr = BrowserManager()
    
    mock_browser = MagicMock()
    mock_new_page = AsyncMock()
    mock_browser.new_page = mock_new_page
    
    mock_page = MagicMock()
    mock_new_page.return_value = mock_page
    
    context.browser = mock_browser
    context.page = None
    context._is_cdp = False
    
    # 执行 connect
    is_cdp, reused = await browser_mgr.connect(context, headless=True)
    
    # 验证：在非 CDP 模式下直接使用 browser.new_page()
    assert mock_browser.new_page.called, "非 CDP 模式下应该调用 browser.new_page()"
    assert context.page == mock_page
    
    print("✓ 非 CDP 模式下正确创建了新页面")


@pytest.mark.asyncio
async def test_browser_manager_reuses_existing_state():
    """测试：当 browser 和 page 都存在时，直接复用。"""
    print("\n=== 测试场景：已有 browser 和 page，直接复用 ===")
    
    context = MockContext()
    browser_mgr = BrowserManager()
    
    mock_browser = MagicMock()
    mock_page = MagicMock()
    
    context.browser = mock_browser
    context.page = mock_page
    context._is_cdp = True
    context._reused_page = True
    
    # 执行 connect
    is_cdp, reused = await browser_mgr.connect(context, headless=True)
    
    # 验证：没有创建新页面
    mock_browser.new_page.assert_not_called()
    
    # 验证：返回正确的状态
    assert is_cdp == True
    assert reused == True
    
    print("✓ 正确复用了现有的 browser 和 page")


if __name__ == "__main__":
    print("=" * 70)
    print("BrowserManager 登录态保持测试")
    print("=" * 70)
    
    asyncio.run(test_browser_manager_creates_page_in_existing_context())
    asyncio.run(test_browser_manager_non_cdp_creates_new_context())
    asyncio.run(test_browser_manager_reuses_existing_state())
    
    print("\n" + "=" * 70)
    print("所有测试通过！BrowserManager 修复验证成功。")
    print("=" * 70)
