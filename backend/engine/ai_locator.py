"""AI智能元素定位模块。"""
import asyncio
import json
from typing import Dict, Any, List, Optional, Tuple
from playwright.async_api import Page, Locator, TimeoutError as PlaywrightTimeoutError
from openai import APIError, RateLimitError, APITimeoutError


async def wait_for_page_stability(page: Page, timeout: int = 5000) -> bool:
    """等待页面稳定（网络空闲和DOM稳定）。
    
    Args:
        page: Playwright页面对象
        timeout: 最大等待时间（毫秒）
        
    Returns:
        是否成功等待到稳定状态
    """
    try:
        # 等待网络空闲，但某些SPA页面可能永远达不到networkidle
        # 所以捕获超时后继续执行
        await page.wait_for_load_state("networkidle", timeout=timeout)
        return True
    except Exception:
        # 即使网络未完全空闲，也继续尝试定位
        # 因为页面可能已经加载足够用于定位
        return False


async def extract_interactive_elements(page: Page, max_elements: int = 50) -> List[Dict[str, Any]]:
    """提取页面可交互元素。
    
    Args:
        page: Playwright页面对象
        max_elements: 最大元素数量限制
        
    Returns:
        元素列表，每个元素包含 tag, id, class, text, type, placeholder, aria-label, href, index
    """
    elements = await page.evaluate("""
        (maxElements) => {
            const interactiveSelectors = [
                'a[href]',
                'button',
                'input',
                'select',
                'textarea',
                '[role="button"]',
                '[role="link"]',
                '[role="checkbox"]',
                '[role="radio"]',
                '[role="textbox"]',
                '[role="combobox"]',
                '[onclick]',
                '[tabindex]:not([tabindex="-1"])',
            ];
            
            const selector = interactiveSelectors.join(', ');
            const nodes = Array.from(document.querySelectorAll(selector));
            
            const visibleElements = nodes
                .filter(el => {
                    const rect = el.getBoundingClientRect();
                    return rect.width > 0 && rect.height > 0;
                })
                .slice(0, maxElements);
            
            return visibleElements.map((el, index) => ({
                index,
                tag: el.tagName.toLowerCase(),
                id: el.id || null,
                className: el.className || null,
                text: (el.textContent || el.value || el.placeholder || '').trim().slice(0, 100),
                type: el.type || null,
                placeholder: el.placeholder || null,
                ariaLabel: el.getAttribute('aria-label') || null,
                href: el.href || null,
                name: el.name || null,
                value: el.value || null,
            }));
        }
    """, max_elements)
    
    return elements


def build_ai_prompt(url: str, ai_target: str, elements: List[Dict[str, Any]]) -> str:
    """构建LLM Prompt。
    
    Args:
        url: 当前页面URL
        ai_target: 用户描述的目标元素
        elements: 页面元素列表
        
    Returns:
        构建好的prompt字符串
    """
    elements_desc = []
    for el in elements:
        parts = [f"[{el['index']}] <{el['tag']}>"]
        
        attrs = []
        if el.get('id'):
            attrs.append(f"id={el['id']}")
        if el.get('className') and isinstance(el.get('className'), str):
            attrs.append(f"class={el['className'][:50]}")
        if el.get('type'):
            attrs.append(f"type={el['type']}")
        if el.get('placeholder'):
            attrs.append(f"placeholder={el['placeholder']}")
        if el.get('ariaLabel'):
            attrs.append(f"aria-label={el['ariaLabel']}")
        if el.get('name'):
            attrs.append(f"name={el['name']}")
        if el.get('href'):
            attrs.append(f"href={el['href'][:60]}")
            
        if attrs:
            parts.append("(" + ", ".join(attrs) + ")")
            
        text = el.get('text', '')
        if text:
            parts.append(f'"{text[:50]}"')
            
        elements_desc.append(" ".join(parts))
    
    prompt = f"""You are an element locator for web automation.

Current page URL: {url}

User wants to interact with: "{ai_target}"

Available interactive elements on the page:
{chr(10).join(elements_desc)}

Analyze the elements and find the best match for the user's description.

Respond in JSON format:
{{
    "best_match_index": <index of best matching element>,
    "selector": "<CSS selector to locate this element>",
    "confidence": <0.0-1.0 confidence score>,
    "reasoning": "<brief explanation of why this element matches>",
    "alternatives": [<list of other possible indexes if confident one is wrong>]
}}

Rules:
1. Prefer exact text matches over partial matches
2. Consider element type (button, link, input) based on user intent
3. If multiple similar elements exist, prefer the first visible one
4. Generate a robust CSS selector using id, class, or attributes
5. If no good match exists, set confidence to 0 and explain why

Respond ONLY with valid JSON, no other text."""
    
    return prompt


def parse_ai_response(response_text: str) -> Dict[str, Any]:
    """解析LLM返回。
    
    Args:
        response_text: LLM返回的文本
        
    Returns:
        解析后的字典，包含 best_match_index, selector, confidence, reasoning, alternatives
    """
    try:
        text = response_text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
        
        result = json.loads(text)
        
        return {
            "best_match_index": result.get("best_match_index"),
            "selector": result.get("selector"),
            "confidence": result.get("confidence", 0.0),
            "reasoning": result.get("reasoning", ""),
            "alternatives": result.get("alternatives", []),
        }
    except json.JSONDecodeError as e:
        return {
            "best_match_index": None,
            "selector": None,
            "confidence": 0.0,
            "reasoning": f"Failed to parse AI response: {str(e)}",
            "alternatives": [],
        }


async def verify_selector(page: Page, selector: str, timeout: int = 5000) -> Tuple[bool, Optional[Locator]]:
    """验证CSS selector是否能定位到元素。
    
    Args:
        page: Playwright页面对象
        selector: CSS选择器
        timeout: 超时时间（毫秒）
        
    Returns:
        (是否成功, Locator对象)
    """
    try:
        locator = page.locator(selector)
        # 等待元素出现
        await locator.wait_for(state="visible", timeout=timeout)
        count = await locator.count()
        return count > 0, locator
    except (TimeoutError, ValueError):
        return False, None


async def try_fallback_strategies(page: Page, ai_target: str, context: Any) -> Tuple[Optional[str], Optional[Locator]]:
    """尝试多重定位策略回退。
    
    回退顺序：ID → CSS选择器 → get_by_role → get_by_text → get_by_placeholder → get_by_label
    
    Args:
        page: Playwright页面对象
        ai_target: 用户描述的目标元素
        context: 执行上下文
        
    Returns:
        (selector字符串, Locator对象)
    """
    strategies = [
        # 1. ID选择器（最稳定）
        ("id", lambda: page.locator(f"#{ai_target}") if not any(c in ai_target for c in " .[]()") else None),
        
        # 2. 精确文本匹配
        ("get_by_text_exact", lambda: page.get_by_text(ai_target, exact=True)),
        
        # 3. 模糊文本匹配
        ("get_by_text_fuzzy", lambda: page.get_by_text(ai_target, exact=False)),
        
        # 4. 按钮角色
        ("get_by_role_button", lambda: page.get_by_role("button", name=ai_target)),
        
        # 5. 链接角色
        ("get_by_role_link", lambda: page.get_by_role("link", name=ai_target)),
        
        # 6. 文本框角色
        ("get_by_role_textbox", lambda: page.get_by_role("textbox", name=ai_target)),
        
        # 7. placeholder
        ("get_by_placeholder", lambda: page.get_by_placeholder(ai_target)),
        
        # 8. label
        ("get_by_label", lambda: page.get_by_label(ai_target)),
        
        # 9. aria-label属性
        ("aria-label", lambda: page.locator(f"[aria-label*='{ai_target}']")),
        
        # 10. title属性
        ("title", lambda: page.locator(f"[title*='{ai_target}']")),
        
        # 11. name属性
        ("name", lambda: page.locator(f"[name*='{ai_target}']")),
        
        # 12. data-testid或其他测试属性
        ("data-testid", lambda: page.locator(f"[data-testid*='{ai_target}']")),
    ]
    
    for strategy_name, get_locator in strategies:
        try:
            locator = get_locator()
            if locator is None:
                continue
            
            count = await locator.count()
            if count > 0:
                # 获取第一个匹配的元素
                element = locator.first
                # 尝试生成稳定的selector
                try:
                    # 获取元素的属性用于生成selector
                    tag = await element.evaluate("el => el.tagName.toLowerCase()")
                    element_id = await element.evaluate("el => el.id")
                    if element_id:
                        selector = f"#{element_id}"
                    else:
                        # 使用原始策略名称作为selector
                        selector = f"[{strategy_name}]: {ai_target}"
                    
                    await context.log("info", f"回退定位成功 [{strategy_name}]: {ai_target} (匹配 {count} 个)")
                    return selector, element
                except (TimeoutError, ValueError, KeyError) as e:
                    # 如果无法获取元素信息，返回原始locator
                    await context.log("debug", f"无法获取元素信息 [{strategy_name}]: {ai_target} - {e}")
                    await context.log("info", f"回退定位成功 [{strategy_name}]: {ai_target} (匹配 {count} 个)")
                    return f"[{strategy_name}]: {ai_target}", element

        except (TimeoutError, ValueError) as e:
            await context.log("debug", f"回退策略 [{strategy_name}] 失败: {str(e)}")
            continue
    
    return None, None


async def take_debug_screenshot(page: Page, context: Any, filename_prefix: str = "locate_failed") -> Optional[str]:
    """定位失败时截取调试截图。
    
    Args:
        page: Playwright页面对象
        context: 执行上下文
        filename_prefix: 文件名前缀
        
    Returns:
        截图保存路径或None
    """
    try:
        import base64
        from datetime import datetime
        
        # 生成文件名
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{filename_prefix}_{timestamp}.jpg"
        
        # 截图
        screenshot_bytes = await page.screenshot(type="jpeg", quality=70, full_page=True)
        
        # 保存到数据目录
        if hasattr(context, 'data_dir'):
            import os
            save_dir = context.data_dir / "screenshots"
            save_dir.mkdir(parents=True, exist_ok=True)
            filepath = save_dir / filename
            with open(filepath, "wb") as f:
                f.write(screenshot_bytes)
            
            await context.log("info", f"调试截图已保存: {filepath}")
            return str(filepath)
        
        # 如果没有data_dir，返回base64
        base64_data = base64.b64encode(screenshot_bytes).decode()
        return f"data:image/jpeg;base64,{base64_data}"
        
    except (IOError, OSError) as e:
        await context.log("warn", f"截图保存失败: {str(e)}")
        return None


async def locate_with_ai(
    page: Page, 
    ai_target: str, 
    context: Any,
    timeout: int = 30000,
    enable_fallback: bool = True
) -> str:
    """使用AI定位元素并返回selector（增强版）。
    
    Args:
        page: Playwright页面对象
        ai_target: 用户描述的目标元素
        context: 执行上下文（用于获取LLM客户端）
        timeout: 总超时时间（毫秒）
        enable_fallback: 启用回退策略
        
    Returns:
        CSS selector字符串
        
    Raises:
        ValueError: 无法定位元素时
    """
    url = page.url
    await context.log("info", f"AI定位开始: {ai_target}")
    
    # 1. 智能等待页面稳定
    # 给页面稳定更多时间，但不超过总超时的40%
    stability_timeout = min(15000, int(timeout * 0.4))
    await context.log("info", f"等待页面稳定... (timeout: {stability_timeout}ms)")
    await wait_for_page_stability(page, timeout=stability_timeout)
    
    # 2. 首先尝试回退策略（快速路径）
    if enable_fallback:
        await context.log("info", "尝试快速定位策略...")
        fallback_selector, fallback_locator = await try_fallback_strategies(page, ai_target, context)
        if fallback_selector and fallback_locator:
            # 验证回退策略找到的locator
            try:
                await fallback_locator.wait_for(state="visible", timeout=3000)
                await context.log("info", f"使用快速定位策略: {fallback_selector}")
                return fallback_selector
            except TimeoutError:
                await context.log("info", "快速定位策略超时，继续使用AI定位")
    
    # 3. 提取页面元素
    elements = await extract_interactive_elements(page)
    await context.log("info", f"提取到 {len(elements)} 个可交互元素")
    
    if not elements:
        # 截图调试
        screenshot_path = await take_debug_screenshot(page, context, "no_elements")
        error_msg = "页面上没有可交互元素"
        if screenshot_path:
            error_msg += f" (截图: {screenshot_path})"
        raise ValueError(error_msg)
    
    # 4. 调用AI进行定位
    prompt = build_ai_prompt(url, ai_target, elements)
    
    if not hasattr(context, 'llm_client') or context.llm_client is None:
        raise ValueError("AI定位需要配置LLM客户端，请在设置中配置API Key")
    
    try:
        response = await context.llm_client.chat.completions.create(
            model=getattr(context, 'llm_model', 'gpt-4o-mini'),
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=500,
        )
        
        response_text = response.choices[0].message.content
        await context.log("debug", f"AI响应: {response_text[:300]}...")
        
    except (APIError, RateLimitError, APITimeoutError) as e:
        raise ValueError(f"LLM调用失败: {str(e)}")
    
    parsed = parse_ai_response(response_text)
    
    if parsed["confidence"] < 0.3:  # 降低置信度阈值，让回退策略有机会执行
        await context.log("warn", f"AI定位置信度过低 ({parsed['confidence']}): {parsed['reasoning']}")
        
        # 尝试回退策略
        if enable_fallback:
            fallback_selector, fallback_locator = await try_fallback_strategies(page, ai_target, context)
            if fallback_selector:
                await context.log("info", f"使用回退策略定位成功: {fallback_selector}")
                return fallback_selector
        
        # 截图调试
        screenshot_path = await take_debug_screenshot(page, context, "low_confidence")
        error_msg = f"AI定位置信度过低 ({parsed['confidence']}): {parsed['reasoning']}"
        if screenshot_path:
            error_msg += f" (截图: {screenshot_path})"
        raise ValueError(error_msg)
    
    selector = parsed["selector"]
    await context.log("info", f"AI建议selector: {selector} (置信度: {parsed['confidence']})")
    
    # 5. 验证selector是否有效
    is_valid, locator = await verify_selector(page, selector, timeout=min(10000, timeout // 2))
    
    if not is_valid:
        await context.log("warn", f"AI生成的selector无效: {selector}")
        
        # 尝试使用AI返回的best_match_index来构建更稳定的selector
        best_index = parsed.get("best_match_index")
        if best_index is not None and 0 <= best_index < len(elements):
            element = elements[best_index]
            # 构建基于ID的selector（最稳定）
            if element.get('id'):
                stable_selector = f"#{element['id']}"
                is_stable_valid, _ = await verify_selector(page, stable_selector, timeout=5000)
                if is_stable_valid:
                    await context.log("info", f"使用稳定selector: {stable_selector}")
                    return stable_selector
        
        # 尝试备选方案
        alternatives = parsed.get("alternatives", [])
        for alt_index in alternatives:
            if 0 <= alt_index < len(elements):
                element = elements[alt_index]
                if element.get('id'):
                    alt_selector = f"#{element['id']}"
                    is_alt_valid, _ = await verify_selector(page, alt_selector, timeout=3000)
                    if is_alt_valid:
                        await context.log("info", f"使用备选selector: {alt_selector}")
                        return alt_selector
        
        # 回退策略
        if enable_fallback:
            fallback_selector, fallback_locator = await try_fallback_strategies(page, ai_target, context)
            if fallback_selector:
                await context.log("info", f"使用回退策略定位成功: {fallback_selector}")
                return fallback_selector
        
        # 截图调试
        screenshot_path = await take_debug_screenshot(page, context, "invalid_selector")
        error_msg = f"AI生成的selector无效: {selector}"
        if screenshot_path:
            error_msg += f" (截图: {screenshot_path})"
        raise ValueError(error_msg)
    
    await context.log("info", f"AI定位成功: {selector} (置信度: {parsed['confidence']}, 原因: {parsed['reasoning']})")
    
    return selector
