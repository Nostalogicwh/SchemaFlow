"""AI元素定位修复测试。"""
import pytest
import asyncio
import sys
from pathlib import Path
from unittest.mock import Mock, AsyncMock, MagicMock, patch
from typing import Any

# 添加backend目录到Python路径
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

# 测试wait_for_page_stability
@pytest.mark.asyncio
async def test_wait_for_page_stability_success():
    """测试页面稳定等待成功。"""
    from engine.ai_locator import wait_for_page_stability
    
    page = Mock()
    page.wait_for_load_state = AsyncMock()
    
    result = await wait_for_page_stability(page, timeout=5000)
    
    assert result is True
    page.wait_for_load_state.assert_called_once_with("networkidle", timeout=5000)


@pytest.mark.asyncio
async def test_wait_for_page_stability_timeout():
    """测试页面稳定等待超时但继续执行。"""
    from engine.ai_locator import wait_for_page_stability
    
    page = Mock()
    page.wait_for_load_state = AsyncMock(side_effect=Exception("Timeout"))
    
    result = await wait_for_page_stability(page, timeout=5000)
    
    assert result is False


# 测试verify_selector
@pytest.mark.asyncio
async def test_verify_selector_success():
    """测试selector验证成功。"""
    from engine.ai_locator import verify_selector
    
    page = Mock()
    locator = Mock()
    locator.wait_for = AsyncMock()
    locator.count = AsyncMock(return_value=1)
    page.locator = Mock(return_value=locator)
    
    is_valid, result_locator = await verify_selector(page, "#test-id", timeout=5000)
    
    assert is_valid is True
    assert result_locator is not None


@pytest.mark.asyncio
async def test_verify_selector_failure():
    """测试selector验证失败。"""
    from engine.ai_locator import verify_selector
    
    page = Mock()
    locator = Mock()
    locator.wait_for = AsyncMock(side_effect=Exception("Element not found"))
    page.locator = Mock(return_value=locator)
    
    is_valid, result_locator = await verify_selector(page, "#nonexistent", timeout=5000)
    
    assert is_valid is False
    assert result_locator is None


# 测试try_fallback_strategies
@pytest.mark.asyncio
async def test_fallback_strategies_success():
    """测试回退策略成功。"""
    from engine.ai_locator import try_fallback_strategies
    
    page = Mock()
    context = Mock()
    context.log = AsyncMock()
    
    # 模拟通过id找到元素
    locator = Mock()
    locator.count = AsyncMock(return_value=1)
    locator.first = Mock()
    locator.first.evaluate = AsyncMock(return_value="div")
    page.locator = Mock(return_value=locator)
    
    selector, element = await try_fallback_strategies(page, "test-id", context)
    
    assert selector is not None
    assert element is not None


@pytest.mark.asyncio
async def test_fallback_strategies_failure():
    """测试回退策略全部失败。"""
    from engine.ai_locator import try_fallback_strategies
    
    page = Mock()
    context = Mock()
    context.log = AsyncMock()
    
    # 所有策略都找不到元素
    locator = Mock()
    locator.count = AsyncMock(return_value=0)
    page.locator = Mock(return_value=locator)
    page.get_by_text = Mock(return_value=locator)
    page.get_by_role = Mock(return_value=locator)
    page.get_by_placeholder = Mock(return_value=locator)
    page.get_by_label = Mock(return_value=locator)
    
    selector, element = await try_fallback_strategies(page, "nonexistent", context)
    
    assert selector is None
    assert element is None


# 测试take_debug_screenshot
@pytest.mark.asyncio
async def test_take_debug_screenshot():
    """测试调试截图功能。"""
    from engine.ai_locator import take_debug_screenshot
    
    page = Mock()
    page.screenshot = AsyncMock(return_value=b"fake_screenshot_data")
    
    context = Mock()
    context.log = AsyncMock()
    context.data_dir = Mock()
    context.data_dir.__truediv__ = Mock(return_value=Mock())
    
    result = await take_debug_screenshot(page, context, "test_failed")
    
    page.screenshot.assert_called_once()


# 测试locate_with_ai的完整流程
@pytest.mark.asyncio
async def test_locate_with_ai_full_flow():
    """测试完整的AI定位流程。"""
    from engine.ai_locator import locate_with_ai
    
    page = Mock()
    page.url = "https://example.com"
    page.wait_for_load_state = AsyncMock()
    
    context = Mock()
    context.log = AsyncMock()
    context.llm_client = Mock()
    context.llm_client.chat.completions.create = AsyncMock(return_value=Mock(
        choices=[Mock(message=Mock(content='{"best_match_index": 0, "selector": "#test", "confidence": 0.9, "reasoning": "Perfect match"}'))]
    ))
    context.llm_model = "gpt-4o-mini"
    context.data_dir = Mock()
    
    # Mock extract_interactive_elements
    with patch('engine.ai_locator.extract_interactive_elements', new=AsyncMock(return_value=[
        {"index": 0, "id": "test", "tag": "button", "text": "Click me"}
    ])):
        # Mock verify_selector
        with patch('engine.ai_locator.verify_selector', new=AsyncMock(return_value=(True, Mock()))):
            selector = await locate_with_ai(page, "点击按钮", context, timeout=30000)
            
            assert selector == "#test"


# 测试locate_element增强功能
@pytest.mark.asyncio
async def test_locate_element_with_wait():
    """测试带等待的locate_element。"""
    from engine.actions.utils import locate_element
    
    page = Mock()
    locator = Mock()
    locator.wait_for = AsyncMock()
    locator.count = AsyncMock(return_value=1)
    page.locator = Mock(return_value=locator)
    
    context = Mock()
    context.log = AsyncMock()
    
    result = await locate_element(
        page, 
        selector="#test", 
        ai_target=None, 
        context=context,
        wait_for_visible=True,
        timeout=30000
    )
    
    assert result is not None
    locator.wait_for.assert_called_once_with(state="visible", timeout=30000)


@pytest.mark.asyncio
async def test_locate_element_with_ai_fallback():
    """测试locate_element的AI定位回退。"""
    from engine.actions.utils import locate_element
    
    page = Mock()
    context = Mock()
    context.log = AsyncMock()
    context.llm_client = Mock()
    context.llm_client.chat.completions.create = AsyncMock(return_value=Mock(
        choices=[Mock(message=Mock(content='{"best_match_index": 0, "selector": "#test", "confidence": 0.9, "reasoning": "Good match"}'))]
    ))
    context.llm_model = "gpt-4o-mini"
    context.data_dir = Mock()
    
    locator = Mock()
    locator.wait_for = AsyncMock()
    locator.count = AsyncMock(return_value=1)
    page.locator = Mock(return_value=locator)
    page.wait_for_load_state = AsyncMock()
    
    with patch('engine.ai_locator.extract_interactive_elements', new=AsyncMock(return_value=[
        {"index": 0, "id": "test", "tag": "button", "text": "Submit"}
    ])):
        with patch('engine.ai_locator.verify_selector', new=AsyncMock(return_value=(True, locator))):
            with patch('engine.ai_locator.try_fallback_strategies', new=AsyncMock(return_value=(None, None))):
                result = await locate_element(
                    page,
                    selector=None,
                    ai_target="提交按钮",
                    context=context,
                    wait_for_visible=True,
                    timeout=30000
                )
                
                assert result is not None


# 测试超时处理
@pytest.mark.asyncio
async def test_locate_element_timeout():
    """测试定位超时处理。"""
    from engine.actions.utils import locate_element
    
    page = Mock()
    locator = Mock()
    locator.wait_for = AsyncMock(side_effect=TimeoutError("Timeout"))
    page.locator = Mock(return_value=locator)
    
    context = Mock()
    context.log = AsyncMock()
    
    with pytest.raises(ValueError) as exc_info:
        await locate_element(
            page,
            selector="#test",
            ai_target=None,
            context=context,
            wait_for_visible=True,
            timeout=1000
        )
    
    assert "超时" in str(exc_info.value)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
