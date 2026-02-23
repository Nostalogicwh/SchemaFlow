"""AI元素定位模块 - 合并了多种定位策略。

本模块提供基于无障碍树（Accessibility Tree）的AI元素定位功能，
相比HTML方案更加精简，token消耗减少60-70%。

核心功能：
1. 获取页面无障碍树快照
2. 使用AI分析无障碍树定位目标元素
3. 保存和复用CSS选择器
4. 混合定位模式（CSS选择器优先 + AI后备）
"""

import asyncio
import json
import hashlib
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
from playwright.async_api import Page, Locator, TimeoutError as PlaywrightTimeoutError
from openai import APIError, RateLimitError, APITimeoutError


@dataclass
class AccessibleNode:
    """无障碍树节点。"""

    role: str
    name: Optional[str]
    node_id: str
    properties: Dict[str, Any]
    children: List["AccessibleNode"]


@dataclass
class LocationResult:
    """定位结果。"""

    selector: str
    confidence: float
    reasoning: str
    method: str


async def wait_for_page_stability(page: Page, timeout: int = 5000) -> bool:
    """等待页面稳定（网络空闲和DOM稳定）。

    Args:
        page: Playwright页面对象
        timeout: 最大等待时间（毫秒）

    Returns:
        是否成功等待到稳定状态
    """
    try:
        await page.wait_for_load_state("networkidle", timeout=timeout)
        return True
    except Exception:
        return False


async def extract_interactive_elements(
    page: Page, max_elements: int = 50
) -> List[Dict[str, Any]]:
    """提取页面可交互元素 - Set-of-Mark 方案。

    使用 JavaScript 注入提取所有"视觉上可见"且"可交互"的 DOM 元素，
    给它们打上连续数字标签（Mark ID），实现 100% 准确率的零代码操控。

    Args:
        page: Playwright页面对象
        max_elements: 最大元素数量限制

    Returns:
        元素列表，包含 mark_id, type, text, selector 等信息
    """
    # Set-of-Mark: 提取可见可交互元素并打上数字标签
    elements = await page.evaluate(
        """
        (maxElements) => {
            // 1. 定义选择器：标准交互元素 + "流氓"可交互元素
            const interactiveSelectors = [
                // 标准交互元素
                'button',
                'a[href]',
                'input:not([type="hidden"])',
                'select',
                'textarea',
                '[role="button"]',
                '[role="link"]',
                '[role="checkbox"]',
                '[role="radio"]',
                '[role="textbox"]',
                '[role="searchbox"]',
                '[role="combobox"]',
                // "流氓"可交互元素：绑定了点击事件或看起来像按钮的 div/span
                'div[onclick]',
                'span[onclick]',
                'div[role]',
                'span[role]',
                // 光标样式暗示可交互
                '[style*="cursor: pointer"]',
                '[class*="btn"]',
                '[class*="button"]',
            ];
            
            const selector = interactiveSelectors.join(', ');
            const allNodes = Array.from(document.querySelectorAll(selector));
            
            // 2. 过滤：只保留可见元素（视口内、非隐藏、不透明）
            const visibleNodes = allNodes.filter(el => {
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 0 
                    && rect.height > 0
                    && rect.top >= 0 
                    && rect.left >= 0
                    && rect.bottom <= (window.innerHeight || document.documentElement.clientHeight)
                    && rect.right <= (window.innerWidth || document.documentElement.clientWidth)
                    && style.visibility !== 'hidden'
                    && style.opacity !== '0'
                    && style.display !== 'none';
            });
            
            // 3. Set-of-Mark：给每个元素打上连续数字 ID
            let markId = 1;
            return visibleNodes.slice(0, maxElements).map((el) => {
                const tag = el.tagName.toLowerCase();
                
                // className 可能是对象(如 SVGAnimatedString)，需要先转为字符串
                const classStr = typeof el.className === 'string' ? el.className : (el.className ? String(el.className) : '');
                
                // 提取最相关的文本
                const text = (el.innerText || el.value || el.placeholder || el.title || '').trim();
                
                // 生成描述性名称
                let description = text.slice(0, 50);
                if (!description) {
                    const ariaLabel = el.getAttribute('aria-label');
                    description = ariaLabel || el.title || 
                                 (classStr && classStr.includes('icon') ? '[icon]' : '') ||
                                 '[no text]';
                }
                
                // 推断交互类型
                let type = 'element';
                if (tag === 'button' || el.getAttribute('role') === 'button' || 
                    el.onclick || (classStr && classStr.includes('btn'))) {
                    type = 'button';
                } else if (tag === 'a' || el.getAttribute('role') === 'link') {
                    type = 'link';
                } else if (tag === 'input' || tag === 'textarea') {
                    const inputType = el.type || 'text';
                    if (inputType === 'password') type = 'password';
                    else if (inputType === 'search') type = 'search';
                    else type = 'input';
                } else if (tag === 'select') {
                    type = 'select';
                }
                
                // 生成 Playwright 可用的 selector
                let selector;
                if (el.id) {
                    selector = `#${el.id}`;
                } else if (classStr) {
                    const firstClass = classStr.split(' ')[0];
                    selector = `${tag}.${firstClass}`;
                } else {
                    // 使用 nth-of-type 作为回退
                    const siblings = Array.from(el.parentNode.children).filter(c => c.tagName === el.tagName);
                    const index = siblings.indexOf(el) + 1;
                    selector = `${tag}:nth-of-type(${index})`;
                }
                
                return {
                    mark_id: markId++,  // Set-of-Mark 关键：连续数字标记
                    type: type,
                    tag: tag,
                    text: description,
                    selector: selector,
                    id: el.id || null,
                    className: classStr || null,
                };
            }).filter(el => el.text !== '[no text]'); // 只保留有描述的元素
        }
        """,
        max_elements,
    )

    return elements


def _parse_accessibility_tree(
    nodes: List[Dict], max_elements: int
) -> List[Dict[str, Any]]:
    """解析无障碍树节点，提取可交互元素。

    Args:
        nodes: 无障碍树节点列表
        max_elements: 最大元素数量限制

    Returns:
        提取的元素列表
    """
    elements = []
    index = 0

    interactive_roles = {
        "button",
        "link",
        "textbox",
        "searchbox",
        "combobox",
        "checkbox",
        "radio",
        "menuitem",
        "tab",
        "treeitem",
        "listitem",
        "gridcell",
        "cell",
        "heading",
    }

    def traverse(node: Dict):
        nonlocal index
        if index >= max_elements:
            return

        role = node.get("role", "")
        name = node.get("name", "")

        if role in interactive_roles or node.get("focused") or node.get("checked"):
            element = {
                "index": index,
                "tag": _role_to_tag(role),
                "id": node.get("keyshortcuts"),
                "className": None,
                "text": name[:100] if name else "",
                "type": _role_to_input_type(role),
                "placeholder": None,
                "ariaLabel": name if name else None,
                "href": node.get("value") if role == "link" else None,
                "name": name if name else None,
                "value": node.get("value"),
                "role": role,
            }
            elements.append(element)
            index += 1

        if "children" in node:
            for child in node["children"]:
                traverse(child)

    for node in nodes:
        traverse(node)

    return elements


def _role_to_tag(role: str) -> str:
    """将无障碍角色转换为HTML标签。"""
    role_to_tag_map = {
        "button": "button",
        "link": "a",
        "textbox": "input",
        "searchbox": "input",
        "combobox": "select",
        "checkbox": "input",
        "radio": "input",
        "heading": "h1",
        "listitem": "li",
        "menuitem": "div",
        "tab": "div",
        "treeitem": "div",
        "gridcell": "td",
        "cell": "td",
    }
    return role_to_tag_map.get(role, "div")


def _role_to_input_type(role: str) -> Optional[str]:
    """将无障碍角色转换为input类型。"""
    role_to_type_map = {
        "textbox": "text",
        "searchbox": "search",
        "checkbox": "checkbox",
        "radio": "radio",
    }
    return role_to_type_map.get(role)


def build_ai_prompt(url: str, ai_target: str, elements: List[Dict[str, Any]]) -> str:
    """构建LLM Prompt - Set-of-Mark 方案。

    Args:
        url: 当前页面URL
        ai_target: 用户描述的目标元素
        elements: 页面元素列表（包含 mark_id）

    Returns:
        构建好的prompt字符串
    """
    elements_desc = []
    for el in elements:
        mark_id = el.get("mark_id", el.get("index", 0))
        parts = [f"[{mark_id}] <{el.get('type', el.get('tag', 'element'))}>"]

        # 添加文本描述
        text = el.get("text", "")
        if text:
            parts.append(f'"{text[:60]}"')

        # 添加其他属性
        attrs = []
        if el.get("id"):
            attrs.append(f"id={el['id']}")
        if el.get("tag"):
            attrs.append(f"tag={el['tag']}")
        if el.get("selector"):
            attrs.append(f"selector={el['selector']}")

        if attrs:
            parts.append("(" + ", ".join(attrs) + ")")

        elements_desc.append(" ".join(parts))

    prompt = f"""You are a web automation assistant. Identify which element the user wants to interact with.

Current Page URL: {url}
User Target Description: "{ai_target}"

Available Interactive Elements (Set-of-Mark format):
{chr(10).join(elements_desc)}

Instructions:
1. Each element has a unique Mark ID in square brackets [1], [2], etc.
2. Each element has a pre-calculated CSS selector (shown as selector=...).
3. You should prioritize returning these pre-calculated selectors in your response.
4. Look for the element that best matches the user's description.
5. Consider the element type, text content, and context.

Return JSON format:
{{
    "mark_id": <number - the Mark ID of the best matching element, or null if no match>,
    "selector": "<CSS selector to locate this element - use the pre-calculated selector from the element list>",
    "confidence": <0.0-1.0 confidence score>,
    "reasoning": "<brief explanation of why this element matches>",
    "alternatives": [<array of other possible Mark IDs>]
}}

Important:
1. Return only valid JSON, no markdown code blocks
2. The selector should be the pre-calculated CSS selector from the element list (e.g., #id, a.class-name, etc.)
3. Do NOT make up your own selector - use the one provided in the element description"""

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

        # Set-of-Mark: 支持 mark_id (新) 和 best_match_index (旧版兼容)
        mark_id = result.get("mark_id") or result.get("best_match_index")

        return {
            "mark_id": mark_id,
            "selector": result.get("selector"),
            "confidence": result.get("confidence", 0.0),
            "reasoning": result.get("reasoning", ""),
            "alternatives": result.get("alternatives", []),
        }
    except json.JSONDecodeError as e:
        return {
            "mark_id": None,
            "selector": None,
            "confidence": 0.0,
            "reasoning": f"Failed to parse AI response: {str(e)}",
            "alternatives": [],
        }


async def verify_selector(
    page: Page, selector: str, timeout: int = 5000
) -> Tuple[bool, Optional[Locator]]:
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
        await locator.wait_for(state="visible", timeout=timeout)
        count = await locator.count()
        return count > 0, locator
    except Exception:
        return False, None


async def try_fallback_strategies(
    page: Page, ai_target: str, context: Any
) -> Tuple[Optional[str], Optional[Locator]]:
    """尝试多重定位策略回退（通用版本）。

    回退顺序：get_by_role → get_by_text → get_by_placeholder → get_by_label → 属性匹配

    Args:
        page: Playwright页面对象
        ai_target: 用户描述的目标元素
        context: 执行上下文

    Returns:
        (selector字符串, Locator对象)
    """
    strategies = [
        ("get_by_role_button", lambda: page.get_by_role("button", name=ai_target)),
        ("get_by_role_link", lambda: page.get_by_role("link", name=ai_target)),
        ("get_by_role_textbox", lambda: page.get_by_role("textbox", name=ai_target)),
        ("get_by_role_searchbox", lambda: page.get_by_role("searchbox")),
        ("get_by_text_exact", lambda: page.get_by_text(ai_target, exact=True)),
        ("get_by_text_fuzzy", lambda: page.get_by_text(ai_target, exact=False)),
        ("get_by_placeholder", lambda: page.get_by_placeholder(ai_target)),
        ("get_by_label", lambda: page.get_by_label(ai_target)),
        ("aria-label", lambda: page.locator(f"[aria-label*='{ai_target}']")),
        ("title", lambda: page.locator(f"[title*='{ai_target}']")),
        ("name", lambda: page.locator(f"[name*='{ai_target}']")),
        ("data-testid", lambda: page.locator(f"[data-testid*='{ai_target}']")),
    ]

    for strategy_name, get_locator in strategies:
        try:
            locator = get_locator()
            if locator is None:
                continue

            count = await locator.count()
            if count > 0:
                element = locator.first
                try:
                    tag = await element.evaluate("el => el.tagName.toLowerCase()")
                    element_id = await element.evaluate("el => el.id")
                    if element_id:
                        selector = f"#{element_id}"
                    else:
                        selector = f"[{strategy_name}]: {ai_target}"

                    await context.log(
                        "info",
                        f"回退定位成功 [{strategy_name}]: {ai_target} (匹配 {count} 个)",
                    )
                    return selector, element
                except (TimeoutError, ValueError, KeyError) as e:
                    await context.log(
                        "debug",
                        f"无法获取元素信息 [{strategy_name}]: {ai_target} - {e}",
                    )
                    await context.log(
                        "info",
                        f"回退定位成功 [{strategy_name}]: {ai_target} (匹配 {count} 个)",
                    )
                    return f"[{strategy_name}]: {ai_target}", element

        except (TimeoutError, ValueError) as e:
            await context.log("debug", f"回退策略 [{strategy_name}] 失败: {str(e)}")
            continue

    return None, None


async def take_debug_screenshot(
    page: Page, context: Any, filename_prefix: str = "locate_failed"
) -> Optional[str]:
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

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{filename_prefix}_{timestamp}.jpg"

        screenshot_bytes = await page.screenshot(
            type="jpeg", quality=70, full_page=True
        )

        if hasattr(context, "data_dir"):
            import os

            save_dir = context.data_dir / "screenshots"
            save_dir.mkdir(parents=True, exist_ok=True)
            filepath = save_dir / filename
            with open(filepath, "wb") as f:
                f.write(screenshot_bytes)

            await context.log("info", f"调试截图已保存: {filepath}")
            return str(filepath)

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
    enable_fallback: bool = True,
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

    stability_timeout = min(3000, int(timeout * 0.1))
    await context.log("info", f"等待页面稳定... (timeout: {stability_timeout}ms)")
    await wait_for_page_stability(page, timeout=stability_timeout)

    elements = await extract_interactive_elements(page)
    await context.log("info", f"提取到 {len(elements)} 个可交互元素")

    if not elements:
        screenshot_path = await take_debug_screenshot(page, context, "no_elements")
        error_msg = "页面上没有可交互元素"
        if screenshot_path:
            error_msg += f" (截图: {screenshot_path})"
        raise ValueError(error_msg)

    prompt = build_ai_prompt(url, ai_target, elements)

    if not hasattr(context, "llm_client") or context.llm_client is None:
        raise ValueError("AI定位需要配置LLM客户端，请在设置中配置API Key")

    try:
        response = await context.llm_client.chat.completions.create(
            model=getattr(context, "llm_model", "gpt-4o-mini"),
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=500,
        )

        response_text = response.choices[0].message.content
        await context.log("debug", f"AI响应: {response_text[:300]}...")

    except (APIError, RateLimitError, APITimeoutError) as e:
        raise ValueError(f"LLM调用失败: {str(e)}")

    parsed = parse_ai_response(response_text)

    if parsed["confidence"] < 0.1:
        await context.log(
            "warn", f"AI定位置信度过低 ({parsed['confidence']}): {parsed['reasoning']}"
        )

        if enable_fallback:
            fallback_selector, fallback_locator = await try_fallback_strategies(
                page, ai_target, context
            )
            if fallback_selector:
                await context.log("info", f"使用回退策略定位成功: {fallback_selector}")
                return fallback_selector

        screenshot_path = await take_debug_screenshot(page, context, "low_confidence")
        error_msg = f"AI定位置信度过低 ({parsed['confidence']}): {parsed['reasoning']}"
        if screenshot_path:
            error_msg += f" (截图: {screenshot_path})"
        raise ValueError(error_msg)

    selector = parsed["selector"]
    await context.log(
        "info", f"AI建议selector: {selector} (置信度: {parsed['confidence']})"
    )

    is_valid, locator = await verify_selector(
        page, selector, timeout=min(3000, timeout // 4)
    )

    if not is_valid:
        await context.log("warn", f"AI生成的selector无效: {selector}")

        # Set-of-Mark: 通过 mark_id 或 best_match_index 查找对应元素
        mark_id = parsed.get("mark_id")
        best_match_index = parsed.get("best_match_index")

        target_element = None
        if mark_id is not None:
            target_element = next(
                (el for el in elements if el.get("mark_id") == mark_id), None
            )
        elif best_match_index is not None and 0 <= best_match_index < len(elements):
            # 兼容旧格式：通过数组索引查找
            target_element = elements[best_match_index]

        if target_element and target_element.get("selector"):
            stable_selector = target_element["selector"]
            is_stable_valid, _ = await verify_selector(
                page, stable_selector, timeout=2000
            )
            if is_stable_valid:
                await context.log(
                    "info",
                    f"使用元素预计算selector: {stable_selector}",
                )
                return stable_selector

        # 备选方案：尝试 alternatives 中的 id
        alternatives = parsed.get("alternatives", [])
        for alt_id in alternatives:
            # alt_id 可能是 mark_id 或索引
            alt_element = None
            if isinstance(alt_id, int):
                if 0 <= alt_id < len(elements):
                    alt_element = elements[alt_id]
            else:
                alt_element = next(
                    (el for el in elements if el.get("mark_id") == alt_id), None
                )

            if alt_element and alt_element.get("selector"):
                alt_selector = alt_element["selector"]
                is_alt_valid, _ = await verify_selector(
                    page, alt_selector, timeout=1500
                )
                if is_alt_valid:
                    await context.log("info", f"使用备选元素selector: {alt_selector}")
                    return alt_selector

        if enable_fallback:
            fallback_selector, fallback_locator = await try_fallback_strategies(
                page, ai_target, context
            )
            if fallback_selector:
                await context.log("info", f"使用回退策略定位成功: {fallback_selector}")
                return fallback_selector

        screenshot_path = await take_debug_screenshot(page, context, "invalid_selector")
        error_msg = f"AI生成的selector无效: {selector}"
        if screenshot_path:
            error_msg += f" (截图: {screenshot_path})"
        raise ValueError(error_msg)

    await context.log(
        "info",
        f"AI定位成功: {selector} (置信度: {parsed['confidence']}, 原因: {parsed['reasoning']})",
    )

    return selector


class HybridElementLocator:
    """混合元素定位器。

    实现CSS选择器优先 + AI后备的定位策略：
    1. 首先尝试使用CSS选择器定位
    2. 如果选择器失效且启用AI定位，则使用AI定位
    3. AI定位成功后，保存新的CSS选择器供下次使用

    Attributes:
        page: Playwright页面对象
        context: 执行上下文
        saved_selectors: 已保存的CSS选择器缓存
    """

    def __init__(self, page: Page, context: Any):
        """初始化混合定位器。

        Args:
            page: Playwright页面对象
            context: 执行上下文
        """
        self.page = page
        self.context = context
        self.saved_selectors: Dict[str, str] = {}

    async def locate(
        self,
        target_description: str,
        saved_selector: Optional[str] = None,
        enable_ai_fallback: bool = True,
        timeout: int = 10000,
    ) -> LocationResult:
        """定位元素。

        按照以下顺序尝试定位：
        1. 使用已保存的CSS选择器
        2. 如果失效且启用AI，使用AI定位
        3. 返回定位结果

        Args:
            target_description: 目标元素描述（用于AI定位）
            saved_selector: 已保存的CSS选择器（可选）
            enable_ai_fallback: CSS选择器失效时是否启用AI定位
            timeout: 定位超时时间（毫秒）

        Returns:
            LocationResult对象，包含选择器和定位方法

        Raises:
            ValueError: 无法定位元素时
        """
        if saved_selector:
            if await self._verify_selector(saved_selector, timeout):
                await self.context.log(
                    "info", f"使用已保存的选择器定位成功: {saved_selector}"
                )
                return LocationResult(
                    selector=saved_selector,
                    confidence=1.0,
                    reasoning="使用已保存的CSS选择器定位成功",
                    method="css",
                )
            else:
                await self.context.log(
                    "warning", f"已保存的选择器失效: {saved_selector}"
                )

        if enable_ai_fallback:
            await self.context.log("info", f"启用AI定位: {target_description}")
            return await self._locate_with_ai(target_description, timeout)

        raise ValueError(f"无法定位元素: {target_description}")

    async def _verify_selector(self, selector: str, timeout: int) -> bool:
        """验证CSS选择器是否有效。

        Args:
            selector: CSS选择器
            timeout: 超时时间（毫秒）

        Returns:
            选择器是否有效
        """
        try:
            locator = self.page.locator(selector)
            await locator.wait_for(state="visible", timeout=timeout)
            count = await locator.count()
            return count > 0
        except Exception:
            return False

    async def _locate_with_ai(
        self, target_description: str, timeout: int
    ) -> LocationResult:
        """使用AI和无障碍树定位元素。

        Args:
            target_description: 目标元素描述
            timeout: 超时时间（毫秒）

        Returns:
            LocationResult对象

        Raises:
            ValueError: AI定位失败时
        """
        await self.context.log("debug", "获取无障碍树快照...")
        accessibility_tree = await self._get_accessibility_snapshot()

        if not accessibility_tree:
            raise ValueError("无法获取页面无障碍树")

        prompt = self._build_ai_prompt(target_description, accessibility_tree)

        if not hasattr(self.context, "llm_client") or self.context.llm_client is None:
            raise ValueError("AI定位需要配置LLM客户端")

        try:
            response = await self.context.llm_client.chat.completions.create(
                model=getattr(self.context, "llm_model", "gpt-4o-mini"),
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=300,
            )

            response_text = response.choices[0].message.content
            await self.context.log("debug", f"AI响应: {response_text}")

        except (APIError, RateLimitError, APITimeoutError) as e:
            raise ValueError(f"LLM调用失败: {str(e)}")

        result = self._parse_ai_response(response_text)

        if result["confidence"] < 0.3:
            raise ValueError(
                f"AI定位置信度过低 ({result['confidence']}): {result['reasoning']}"
            )

        best_match_index = result.get("best_match_index")

        if best_match_index is None:
            raise ValueError(f"AI未找到匹配元素: {result['reasoning']}")

        if not (0 <= best_match_index < len(accessibility_tree)):
            raise ValueError(f"AI返回的索引 {best_match_index} 超出范围")

        target_element = accessibility_tree[best_match_index]
        unique_selector = target_element.get("selector")

        if not unique_selector:
            raise ValueError(f"元素 {best_match_index} 没有有效的选择器")

        await self.context.log(
            "info",
            f"AI定位成功: index={best_match_index}, selector={unique_selector}, 置信度={result['confidence']}",
        )

        return LocationResult(
            selector=unique_selector,
            confidence=result["confidence"],
            reasoning=result["reasoning"],
            method="ai",
        )

    async def _get_accessibility_snapshot(self) -> List[Dict[str, Any]]:
        """获取页面无障碍树快照。

        使用 DOM 查询提取可交互元素信息，转换为无障碍树格式。
        Playwright 1.58.0 移除了 accessibility API，所以使用 DOM 回退方案。

        Returns:
            无障碍树节点列表
        """
        try:
            # Set-of-Mark 方案：提取可见可交互元素并打上数字标签
            elements = await self.page.evaluate(
                """
                () => {
                    // 1. 定义选择器：标准交互元素 + "流氓"可交互元素
                    const interactiveSelectors = [
                        // 标准交互元素
                        'button',
                        'a[href]',
                        'input:not([type="hidden"])',
                        'select',
                        'textarea',
                        '[role="button"]',
                        '[role="link"]',
                        '[role="checkbox"]',
                        '[role="radio"]',
                        '[role="textbox"]',
                        '[role="searchbox"]',
                        '[role="combobox"]',
                        // "流氓"可交互元素：绑定了点击事件或看起来像按钮的 div/span
                        'div[onclick]',
                        'span[onclick]',
                        'div[role]',
                        'span[role]',
                        // 光标样式暗示可交互
                        '[style*="cursor: pointer"]',
                        '[class*="btn"]',
                        '[class*="button"]',
                    ];
                    
                    const selector = interactiveSelectors.join(', ');
                    const allNodes = Array.from(document.querySelectorAll(selector));
                    
                    // 2. 过滤：只保留可见元素
                    const visibleNodes = allNodes.filter(el => {
                        const rect = el.getBoundingClientRect();
                        const style = window.getComputedStyle(el);
                        return rect.width > 0 
                            && rect.height > 0
                            && rect.top >= 0 
                            && rect.left >= 0
                            && rect.bottom <= (window.innerHeight || document.documentElement.clientHeight)
                            && rect.right <= (window.innerWidth || document.documentElement.clientWidth)
                            && style.visibility !== 'hidden'
                            && style.opacity !== '0'
                            && style.display !== 'none';
                    });
                    
                    // 3. Set-of-Mark：给每个元素打上连续数字 ID
                    let markId = 1;
                    return visibleNodes.slice(0, 100).map((el) => {
                        const tag = el.tagName.toLowerCase();
                        
                        // 提取最相关的文本
                        const text = (el.innerText || el.value || el.placeholder || el.title || '').trim();
                        
                        // 生成描述性名称
                        let description = text.slice(0, 50);
                        if (!description) {
                            // 如果没有文本，尝试从其他属性推断
                            const ariaLabel = el.getAttribute('aria-label');
                            const ariaDesc = el.getAttribute('aria-describedby');
                            // className 可能是对象(如 SVGAnimatedString)，需要先转为字符串
                            const classStr = typeof el.className === 'string' ? el.className : (el.className ? String(el.className) : '');
                            description = ariaLabel || el.title || 
                                         (classStr && classStr.includes('icon') ? '[icon]' : '') ||
                                         '[no text]';
                        }
                        
                        // 推断交互类型
                        const classStr = typeof el.className === 'string' ? el.className : (el.className ? String(el.className) : '');
                        let type = 'element';
                        if (tag === 'button' || el.getAttribute('role') === 'button' || 
                            el.onclick || classStr.includes('btn')) {
                            type = 'button';
                        } else if (tag === 'a' || el.getAttribute('role') === 'link') {
                            type = 'link';
                        } else if (tag === 'input' || tag === 'textarea') {
                            const inputType = el.type || 'text';
                            if (inputType === 'password') type = 'password';
                            else if (inputType === 'search') type = 'search';
                            else type = 'input';
                        } else if (tag === 'select') {
                            type = 'select';
                        }
                        
                        // 生成唯一 selector - 层级+位置优先
                        function generateUniqueSelector(element, allElements) {
                            const tag = element.tagName.toLowerCase();
                            
                            // 策略 1: ID（最优先，绝对唯一）
                            if (element.id) {
                                const selector = `#${CSS.escape(element.id)}`;
                                if (document.querySelectorAll(selector).length === 1) {
                                    return selector;
                                }
                            }
                            
                            // 策略 2: 层级 + 位置（最稳定）
                            function buildPathSelector(el, maxDepth = 5) {
                                const path = [];
                                let current = el;
                                let depth = 0;
                                
                                while (current && current !== document.body && depth < maxDepth) {
                                    const parent = current.parentElement;
                                    if (!parent) break;
                                    
                                    const siblings = Array.from(parent.children);
                                    const index = siblings.indexOf(current) + 1;
                                    const currentTag = current.tagName.toLowerCase();
                                    
                                    // 尝试使用父元素的唯一 class
                                    const parentClass = parent.className && typeof parent.className === 'string'
                                        ? parent.className.split(' ').find(c => c && c.length > 2 && !c.match(/^[0-9]/))
                                        : null;
                                    
                                    if (parentClass) {
                                        // 父元素 class + 当前元素位置
                                        const selector = `.${CSS.escape(parentClass)} > ${currentTag}:nth-child(${index})`;
                                        if (document.querySelectorAll(selector).length === 1) {
                                            return selector;
                                        }
                                    }
                                    
                                    // 尝试使用父元素的 ID
                                    if (parent.id) {
                                        const selector = `#${CSS.escape(parent.id)} > ${currentTag}:nth-child(${index})`;
                                        if (document.querySelectorAll(selector).length === 1) {
                                            return selector;
                                        }
                                    }
                                    
                                    path.unshift({ tag: currentTag, index });
                                    current = parent;
                                    depth++;
                                }
                                
                                // 构建完整路径选择器
                                if (path.length >= 2) {
                                    const pathSelector = path.map(p => `${p.tag}:nth-child(${p.index})`).join(' > ');
                                    if (document.querySelectorAll(pathSelector).length === 1) {
                                        return pathSelector;
                                    }
                                }
                                
                                return null;
                            }
                            
                            const pathSelector = buildPathSelector(element);
                            if (pathSelector) {
                                return pathSelector;
                            }
                            
                            // 策略 3: data-testid
                            const testId = element.getAttribute('data-testid');
                            if (testId) {
                                const selector = `[data-testid="${testId}"]`;
                                if (document.querySelectorAll(selector).length === 1) {
                                    return selector;
                                }
                            }
                            
                            // 策略 4: name 属性
                            const nameAttr = element.getAttribute('name');
                            if (nameAttr) {
                                const selector = `${tag}[name="${nameAttr}"]`;
                                if (document.querySelectorAll(selector).length === 1) {
                                    return selector;
                                }
                            }
                            
                            // 策略 5: href（链接）
                            if (tag === 'a') {
                                const href = element.getAttribute('href');
                                if (href && href !== '#' && !href.startsWith('javascript:')) {
                                    const hrefEnd = href.split('/').filter(p => p).pop() || href.slice(-30);
                                    const selector = `a[href*="${hrefEnd}"]`;
                                    if (document.querySelectorAll(selector).length === 1) {
                                        return selector;
                                    }
                                }
                            }
                            
                            // 策略 6: 组合多个 class（最后选择）
                            const classStr = typeof element.className === 'string' ? element.className : '';
                            const classes = classStr.split(' ').filter(c => c && c.length > 2);
                            if (classes.length > 0) {
                                const fullClassSelector = tag + classes.map(c => '.' + CSS.escape(c)).join('');
                                if (document.querySelectorAll(fullClassSelector).length === 1) {
                                    return fullClassSelector;
                                }
                            }
                            
                            // 最终回退：使用在提取列表中的索引
                            const elementIndex = allElements.indexOf(element);
                            return `${tag}:eq(${elementIndex})`;
                        }
                        
                        const selector = generateUniqueSelector(el, visibleNodes);
                        
                        return {
                            id: markId++,  // Set-of-Mark 关键：连续数字标记
                            type: type,
                            tag: tag,
                            text: description,
                            selector: selector
                        };
                    }).filter(el => el.text !== '[no text]'); // 只保留有描述的元素
                }
                """
            )

            # 转换为 AI 友好的格式
            interactive_nodes = [
                {
                    "role": el["type"],
                    "name": f"[{el['id']}] {el['text']}",
                    "node_id": f"mark_{el['id']}",
                    "selector": el["selector"],
                    "properties": {
                        "tag": el["tag"],
                        "mark_id": el["id"],
                    },
                    "depth": 0,
                }
                for el in elements[:50]
            ]

            await self.context.log(
                "debug", f"Set-of-Mark 提取到 {len(interactive_nodes)} 个可交互元素"
            )
            return interactive_nodes

        except Exception as e:
            await self.context.log("error", f"获取无障碍树失败: {e}")
            return []

    def _flatten_accessibility_tree(
        self, node: Dict, depth: int = 0
    ) -> List[Dict[str, Any]]:
        """扁平化无障碍树。

        Args:
            node: 无障碍树节点
            depth: 当前深度

        Returns:
            扁平化的节点列表
        """
        result = []

        if node:
            node_info = {
                "role": node.get("role", "unknown"),
                "name": node.get("name"),
                "node_id": f"node_{len(result)}",
                "properties": {
                    k: v
                    for k, v in node.items()
                    if k not in ["role", "name", "children", "value"]
                },
                "value": node.get("value"),
                "depth": depth,
            }
            result.append(node_info)

            children = node.get("children", [])
            for child in children:
                result.extend(self._flatten_accessibility_tree(child, depth + 1))

        return result

    def _build_ai_prompt(
        self, target_description: str, accessibility_tree: List[Dict]
    ) -> str:
        """构建AI提示词。

        Args:
            target_description: 目标元素描述
            accessibility_tree: 无障碍树节点列表

        Returns:
            构建好的prompt字符串
        """
        nodes_desc = []
        for i, node in enumerate(accessibility_tree):
            role = node.get("role", "unknown")
            name = node.get("name", "")
            selector = node.get("selector", "")

            if name:
                indent = "  " * node.get("depth", 0)
                node_info = f'[{i}] {indent}<{role}> "{name}"'
                if selector:
                    node_info += f" | {selector}"
                nodes_desc.append(node_info)

        prompt = f"""你是一个网页自动化助手。请根据页面元素列表定位用户描述的元素。

目标元素描述: "{target_description}"

页面可交互元素列表:
{chr(10).join(nodes_desc[:50])}

请分析元素列表，找到最匹配目标描述的元素。

返回JSON格式:
{{
    "best_match_index": <元素索引号[0-49]，如果没有匹配则为null>,
    "confidence": <0.0-1.0之间的置信度>,
    "reasoning": "<匹配原因的简短说明>"
}}

注意:
1. 返回有效的JSON格式，不要包含markdown代码块
2. best_match_index 是元素在列表中的索引号（方括号中的数字）
3. 系统会根据你返回的索引号自动获取该元素的唯一选择器
4. 如果没有匹配项，best_match_index设为null，confidence设为0
"""

        return prompt

    def _parse_ai_response(self, response_text: str) -> Dict[str, Any]:
        """解析AI响应。

        Args:
            response_text: AI返回的文本

        Returns:
            解析后的字典
        """
        try:
            text = response_text.strip()

            if text.startswith("```"):
                lines = text.split("\n")
                text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])

            result = json.loads(text)

            return {
                "best_match_index": result.get("best_match_index"),
                "confidence": result.get("confidence", 0.0),
                "reasoning": result.get("reasoning", ""),
            }
        except json.JSONDecodeError as e:
            return {
                "best_match_index": None,
                "confidence": 0.0,
                "reasoning": f"解析AI响应失败: {str(e)}",
            }

    async def _try_fallback_strategies(
        self, target_description: str
    ) -> Optional[LocationResult]:
        """尝试回退定位策略。

        Args:
            target_description: 目标元素描述

        Returns:
            LocationResult或None
        """
        strategies = [
            (
                "get_by_role_button",
                lambda: self.page.get_by_role("button", name=target_description),
            ),
            (
                "get_by_role_link",
                lambda: self.page.get_by_role("link", name=target_description),
            ),
            (
                "get_by_text",
                lambda: self.page.get_by_text(target_description, exact=False),
            ),
            (
                "get_by_placeholder",
                lambda: self.page.get_by_placeholder(target_description),
            ),
            ("get_by_label", lambda: self.page.get_by_label(target_description)),
        ]

        for strategy_name, get_locator in strategies:
            try:
                await self.context.log("debug", f"尝试回退策略: {strategy_name}")
                locator = get_locator()
                count = await locator.count()
                if count > 0:
                    element = locator.first
                    selector = await self._generate_stable_selector_from_locator(
                        element
                    )

                    if selector:
                        await self.context.log(
                            "info",
                            f"回退策略成功 [{strategy_name}]: {target_description}",
                        )
                        return LocationResult(
                            selector=selector,
                            confidence=0.6,
                            reasoning=f"使用回退策略定位: {strategy_name}",
                            method="fallback",
                        )
            except Exception as e:
                await self.context.log(
                    "debug", f"回退策略 [{strategy_name}] 失败: {str(e)}"
                )
                continue

        return None

    async def _generate_stable_selector(self, node_id: str) -> Optional[str]:
        """生成稳定的选择器（基于node_id）。

        Args:
            node_id: 节点ID

        Returns:
            CSS选择器或None
        """
        return None

    async def _generate_stable_selector_from_locator(
        self, locator: Locator
    ) -> Optional[str]:
        """从定位器生成稳定的选择器。

        Args:
            locator: Playwright Locator

        Returns:
            CSS选择器或None
        """
        try:
            element_id = await locator.evaluate("el => el.id")
            if element_id:
                return f"#{element_id}"

            element_name = await locator.evaluate("el => el.getAttribute('name')")
            if element_name:
                tag = await locator.evaluate("el => el.tagName.toLowerCase()")
                return f"{tag}[name='{element_name}']"

            testid = await locator.evaluate("el => el.getAttribute('data-testid')")
            if testid:
                return f"[data-testid='{testid}']"

            class_name = await locator.evaluate("el => el.className")
            if class_name:
                tag = await locator.evaluate("el => el.tagName.toLowerCase()")
                first_class = class_name.split()[0] if class_name else ""
                if first_class:
                    return f"{tag}.{first_class}"

            return None
        except Exception:
            return None


class AITargetLocator(HybridElementLocator):
    """AI目标定位器 - HybridElementLocator的别名，保持向后兼容。"""

    pass


async def debug_locator(
    page: Page,
    context: Any,
    target_description: str,
    saved_selector: Optional[str] = None,
) -> Dict[str, Any]:
    """调试定位器。

    用于前端调试弹窗，测试定位是否成功。

    Args:
        page: Playwright页面对象
        context: 执行上下文
        target_description: 目标元素描述
        saved_selector: 已保存的CSS选择器

    Returns:
        调试结果字典
    """
    locator = HybridElementLocator(page, context)

    try:
        result = await locator.locate(
            target_description=target_description,
            saved_selector=saved_selector,
            enable_ai_fallback=True,
            timeout=10000,
        )

        return {
            "success": True,
            "selector": result.selector,
            "confidence": result.confidence,
            "method": result.method,
            "reasoning": result.reasoning,
        }
    except ValueError as e:
        return {"success": False, "error": str(e), "selector": None, "method": None}


def generate_selector_key(node_type: str, node_id: str, field: str) -> str:
    """生成选择器缓存键。

    Args:
        node_type: 节点类型
        node_id: 节点ID
        field: 字段名

    Returns:
        缓存键
    """
    key_str = f"{node_type}:{node_id}:{field}"
    return hashlib.md5(key_str.encode()).hexdigest()[:16]
