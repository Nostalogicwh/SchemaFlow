"""AI元素定位修复测试。"""

import pytest
from unittest.mock import Mock, AsyncMock


# 测试wait_for_page_stability
@pytest.mark.asyncio
async def test_wait_for_page_stability_success():
    """测试页面稳定等待成功。"""
    from engine.ai import wait_for_page_stability

    page = Mock()
    page.wait_for_load_state = AsyncMock()

    result = await wait_for_page_stability(page, timeout=5000)

    assert result is True
    page.wait_for_load_state.assert_called_once_with("networkidle", timeout=5000)


@pytest.mark.asyncio
async def test_wait_for_page_stability_timeout():
    """测试页面稳定等待超时但继续执行。"""
    from engine.ai import wait_for_page_stability

    page = Mock()
    page.wait_for_load_state = AsyncMock(side_effect=Exception("Timeout"))

    result = await wait_for_page_stability(page, timeout=5000)

    assert result is False


# 测试verify_selector
@pytest.mark.asyncio
async def test_verify_selector_success():
    """测试selector验证成功。"""
    from engine.ai import verify_selector

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
    from engine.ai import verify_selector

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
    from engine.ai import try_fallback_strategies

    page = Mock()
    context = Mock()
    context.log = AsyncMock()

    # 模拟通过get_by_text找到元素
    locator = Mock()
    locator.count = AsyncMock(return_value=1)
    locator.first = Mock()
    locator.first.evaluate = AsyncMock(return_value="div")
    page.get_by_text = Mock(return_value=locator)
    page.get_by_role = Mock(return_value=locator)
    page.get_by_placeholder = Mock(return_value=locator)
    page.get_by_label = Mock(return_value=locator)
    page.locator = Mock(return_value=locator)

    selector, element = await try_fallback_strategies(page, "test-id", context)

    assert selector is not None
    assert element is not None


@pytest.mark.asyncio
async def test_fallback_strategies_failure():
    """测试回退策略全部失败。"""
    from engine.ai import try_fallback_strategies

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
    from engine.ai import take_debug_screenshot

    page = Mock()
    page.screenshot = AsyncMock(return_value=b"fake_screenshot_data")

    context = Mock()
    context.log = AsyncMock()
    # 确保 context 没有 data_dir 属性
    del context.data_dir

    result = await take_debug_screenshot(page, context, "test_failed")

    # 应该返回 base64 格式的截图（因为没有 data_dir）
    assert result is not None
    assert result.startswith("data:image/jpeg;base64,")
    page.screenshot.assert_called_once()


# 测试locate_with_ai的完整流程
@pytest.mark.asyncio
async def test_locate_with_ai_full_flow():
    """测试完整的AI定位流程。"""
    from engine.ai.locator import HybridElementLocator

    page = Mock()
    page.url = "https://example.com"
    page.evaluate = AsyncMock(
        return_value=[
            {
                "id": 1,
                "type": "button",
                "tag": "button",
                "text": "Click me",
                "selector": "#test-btn",
            }
        ]
    )

    context = Mock()
    context.log = AsyncMock()
    context.llm_client = Mock()
    context.llm_client.chat.completions.create = AsyncMock(
        return_value=Mock(
            choices=[
                Mock(
                    message=Mock(
                        content='{"best_match_index": 0, "confidence": 0.9, "reasoning": "Perfect match"}'
                    )
                )
            ]
        )
    )
    context.llm_model = "gpt-4o-mini"

    locator = HybridElementLocator(page, context)
    result = await locator.locate(
        target_description="点击按钮",
        saved_selector=None,
        enable_ai_fallback=True,
        timeout=30000,
    )

    assert result.selector == "#test-btn"
    assert result.confidence == 0.9
    assert result.method == "ai"


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
        timeout=30000,
    )

    assert result is not None
    # verify_selector 会调用 wait_for，locate_element 也会调用 wait_for
    assert locator.wait_for.call_count >= 1


@pytest.mark.asyncio
async def test_locate_element_with_ai_fallback():
    """测试locate_element的AI定位回退。"""
    from engine.actions.utils import locate_element

    page = Mock()
    page.evaluate = AsyncMock(
        return_value=[
            {
                "id": 1,
                "type": "button",
                "tag": "button",
                "text": "Submit",
                "selector": "#submit-btn",
            }
        ]
    )

    context = Mock()
    context.log = AsyncMock()
    context.llm_client = Mock()
    context.llm_client.chat.completions.create = AsyncMock(
        return_value=Mock(
            choices=[
                Mock(
                    message=Mock(
                        content='{"best_match_index": 0, "confidence": 0.9, "reasoning": "Good match"}'
                    )
                )
            ]
        )
    )
    context.llm_model = "gpt-4o-mini"

    locator = Mock()
    locator.wait_for = AsyncMock()
    locator.count = AsyncMock(return_value=1)
    page.locator = Mock(return_value=locator)

    result = await locate_element(
        page,
        selector=None,
        ai_target="提交按钮",
        context=context,
        wait_for_visible=True,
        timeout=30000,
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
            timeout=1000,
        )

    assert "无法定位" in str(exc_info.value) or "超时" in str(exc_info.value)


# 测试 AI 返回无效 selector 但通过 mark_id 找到预计算 selector
@pytest.mark.asyncio
async def test_ai_returns_invalid_selector_uses_mark_id():
    """测试AI通过best_match_index找到预计算selector。"""
    from engine.ai.locator import HybridElementLocator

    page = Mock()
    page.evaluate = AsyncMock(
        return_value=[
            {
                "id": 1,
                "type": "link",
                "tag": "a",
                "text": "Result 1",
                "selector": "a.result-link",
            },
            {
                "id": 2,
                "type": "link",
                "tag": "a",
                "text": "Result 2",
                "selector": "a.result-link-2",
            },
        ]
    )

    context = Mock()
    context.log = AsyncMock()
    context.llm_client = Mock()
    context.llm_client.chat.completions.create = AsyncMock(
        return_value=Mock(
            choices=[
                Mock(
                    message=Mock(
                        content='{"best_match_index": 0, "confidence": 0.9, "reasoning": "First result"}'
                    )
                )
            ]
        )
    )
    context.llm_model = "gpt-4o-mini"

    locator = HybridElementLocator(page, context)
    result = await locator.locate(
        target_description="搜索结果标题",
        saved_selector=None,
        enable_ai_fallback=True,
        timeout=10000,
    )

    # 应该返回预计算的 selector
    assert result.selector == "a.result-link"
    assert result.confidence == 0.9


# 测试 AI prompt 包含 selector 信息
@pytest.mark.asyncio
async def test_ai_prompt_includes_selector():
    """测试AI prompt包含元素的selector信息。"""
    from engine.ai.locator import HybridElementLocator

    accessibility_tree = [
        {
            "role": "link",
            "name": "[1] Test Link",
            "node_id": "mark_1",
            "selector": "a.test-link",
            "properties": {"tag": "a", "mark_id": 1},
            "depth": 0,
        },
        {
            "role": "button",
            "name": "[2] Submit",
            "node_id": "mark_2",
            "selector": "button.submit-btn",
            "properties": {"tag": "button", "mark_id": 2},
            "depth": 0,
        },
    ]

    page = Mock()
    context = Mock()
    locator = HybridElementLocator(page, context)

    prompt = locator._build_ai_prompt("test target", accessibility_tree)

    # 检查 prompt 是否包含 selector 信息
    assert "a.test-link" in prompt
    assert "button.submit-btn" in prompt

    # 检查 prompt 是否指示 AI 返回 best_match_index
    assert "best_match_index" in prompt
    assert "索引号" in prompt or "index" in prompt.lower()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
