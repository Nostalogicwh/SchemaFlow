"""AI智能元素定位模块。"""
import json
from typing import Dict, Any, List, Optional
from playwright.async_api import Page


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


async def locate_with_ai(page: Page, ai_target: str, context: Any) -> str:
    """使用AI定位元素并返回selector。
    
    Args:
        page: Playwright页面对象
        ai_target: 用户描述的目标元素
        context: 执行上下文（用于获取LLM客户端）
        
    Returns:
        CSS selector字符串
        
    Raises:
        ValueError: 无法定位元素时
    """
    url = page.url
    await context.log("info", f"AI定位开始: {ai_target}")
    
    elements = await extract_interactive_elements(page)
    await context.log("info", f"提取到 {len(elements)} 个可交互元素")
    
    if not elements:
        raise ValueError("页面上没有可交互元素")
    
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
        await context.log("debug", f"AI响应: {response_text[:200]}...")
        
    except Exception as e:
        raise ValueError(f"LLM调用失败: {str(e)}")
    
    parsed = parse_ai_response(response_text)
    
    if parsed["confidence"] < 0.5:
        raise ValueError(f"AI定位置信度过低 ({parsed['confidence']}): {parsed['reasoning']}")
    
    selector = parsed["selector"]
    await context.log("info", f"AI定位成功: {selector} (置信度: {parsed['confidence']}, 原因: {parsed['reasoning']})")
    
    return selector
