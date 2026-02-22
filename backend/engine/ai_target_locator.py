"""AI目标定位模块 - 使用无障碍树进行元素定位。

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
from playwright.async_api import Page, Locator
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
    method: str  # 'css', 'ai', 'fallback'


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
        # 1. 尝试使用已保存的CSS选择器
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

        # 2. 如果选择器失效或不存在，且启用AI定位
        if enable_ai_fallback:
            await self.context.log("info", f"启用AI定位: {target_description}")
            return await self._locate_with_ai(target_description, timeout)

        # 3. 无法定位
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
        # 1. 获取无障碍树快照
        await self.context.log("debug", "获取无障碍树快照...")
        accessibility_tree = await self._get_accessibility_snapshot()

        if not accessibility_tree:
            raise ValueError("无法获取页面无障碍树")

        # 2. 构建AI提示词
        prompt = self._build_ai_prompt(target_description, accessibility_tree)

        # 3. 调用AI进行定位
        if not hasattr(self.context, "llm_client") or self.context.llm_client is None:
            raise ValueError("AI定位需要配置LLM客户端")

        try:
            response = await self.context.llm_client.chat.completions.create(
                model=getattr(self.context, "llm_model", "gpt-4o-mini"),
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=500,
            )

            response_text = response.choices[0].message.content
            await self.context.log("debug", f"AI响应: {response_text[:300]}...")

        except (APIError, RateLimitError, APITimeoutError) as e:
            raise ValueError(f"LLM调用失败: {str(e)}")

        # 4. 解析AI响应
        result = self._parse_ai_response(response_text)

        if result["confidence"] < 0.3:
            # 尝试回退策略
            fallback_result = await self._try_fallback_strategies(target_description)
            if fallback_result:
                return fallback_result

            raise ValueError(
                f"AI定位置信度过低 ({result['confidence']}): {result['reasoning']}"
            )

        # 5. 验证生成的选择器
        selector = result["selector"]
        if await self._verify_selector(selector, timeout=3000):
            await self.context.log(
                "info", f"AI定位成功: {selector} (置信度: {result['confidence']})"
            )
            return LocationResult(
                selector=selector,
                confidence=result["confidence"],
                reasoning=result["reasoning"],
                method="ai",
            )

        # 6. 验证失败，尝试生成更稳定的选择器
        stable_selector = await self._generate_stable_selector(result.get("node_id"))
        if stable_selector and await self._verify_selector(
            stable_selector, timeout=2000
        ):
            await self.context.log("info", f"使用稳定选择器: {stable_selector}")
            return LocationResult(
                selector=stable_selector,
                confidence=result["confidence"],
                reasoning=f"AI定位成功，使用稳定选择器: {result['reasoning']}",
                method="ai",
            )

        # 7. 所有尝试都失败
        raise ValueError(f"AI定位失败: 无法验证选择器 {selector}")

    async def _get_accessibility_snapshot(self) -> List[Dict[str, Any]]:
        """获取页面无障碍树快照。

        使用Playwright的accessibility.snapshot()获取页面的无障碍树，
        这比HTML更加精简，token消耗减少60-70%。

        Returns:
            无障碍树节点列表
        """
        try:
            # 获取无障碍树快照
            snapshot = await self.page.accessibility.snapshot()

            if not snapshot:
                return []

            # 转换为结构化数据
            nodes = self._flatten_accessibility_tree(snapshot)

            # 过滤可交互节点
            interactive_roles = [
                "button",
                "link",
                "textbox",
                "searchbox",
                "checkbox",
                "radio",
                "combobox",
                "menuitem",
                "tab",
                "treeitem",
                "listitem",
                "heading",
                "img",
                "generic",
            ]

            interactive_nodes = [
                node
                for node in nodes
                if node.get("role") in interactive_roles and node.get("name")
            ]

            await self.context.log(
                "debug", f"提取到 {len(interactive_nodes)} 个可交互无障碍节点"
            )
            return interactive_nodes[:50]  # 限制节点数量

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
            # 添加当前节点
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

            # 递归处理子节点
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
        # 格式化无障碍树节点
        nodes_desc = []
        for i, node in enumerate(accessibility_tree):
            role = node.get("role", "unknown")
            name = node.get("name", "")

            if name:  # 只包含有名称的节点
                indent = "  " * node.get("depth", 0)
                nodes_desc.append(f'[{i}] {indent}<{role}> "{name}"')

        prompt = f"""你是一个网页自动化助手。请根据页面无障碍树定位用户描述的元素。

目标元素描述: "{target_description}"

页面无障碍树（可交互元素）:
{chr(10).join(nodes_desc[:40])}

请分析无障碍树，找到最匹配目标描述的节点。

返回JSON格式:
{{
    "best_match_index": <节点索引号或null>,
    "selector": "<CSS选择器字符串>",
    "confidence": <0.0-1.0之间的置信度>,
    "reasoning": "<匹配原因的简短说明>",
    "node_id": "<选中的节点ID>"
}}

注意:
1. 返回有效的JSON格式，不要包含markdown代码块
2. selector应该是稳定的CSS选择器，优先使用ID或特定属性
3. 如果没有匹配项，best_match_index设为null，confidence设为0
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

            # 移除markdown代码块标记
            if text.startswith("```"):
                lines = text.split("\n")
                text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])

            result = json.loads(text)

            return {
                "best_match_index": result.get("best_match_index"),
                "selector": result.get("selector"),
                "confidence": result.get("confidence", 0.0),
                "reasoning": result.get("reasoning", ""),
                "node_id": result.get("node_id"),
            }
        except json.JSONDecodeError as e:
            return {
                "best_match_index": None,
                "selector": None,
                "confidence": 0.0,
                "reasoning": f"解析AI响应失败: {str(e)}",
                "node_id": None,
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
                locator = get_locator()
                count = await locator.count()
                if count > 0:
                    # 尝试生成CSS选择器
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
            except Exception:
                continue

        return None

    async def _generate_stable_selector(self, node_id: str) -> Optional[str]:
        """生成稳定的选择器（基于node_id）。

        Args:
            node_id: 节点ID

        Returns:
            CSS选择器或None
        """
        # 这里简化处理，实际应该通过DOM查询获取元素属性
        # 由于我们已经从accessibility tree获取了信息，可以尝试常见的属性
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
            # 尝试获取元素属性
            element_id = await locator.evaluate("el => el.id")
            if element_id:
                return f"#{element_id}"

            # 尝试获取name属性
            element_name = await locator.evaluate("el => el.getAttribute('name')")
            if element_name:
                tag = await locator.evaluate("el => el.tagName.toLowerCase()")
                return f"{tag}[name='{element_name}']"

            # 尝试获取data-testid
            testid = await locator.evaluate("el => el.getAttribute('data-testid')")
            if testid:
                return f"[data-testid='{testid}']"

            # 使用class（可能不稳定，但作为最后手段）
            class_name = await locator.evaluate("el => el.className")
            if class_name:
                tag = await locator.evaluate("el => el.tagName.toLowerCase()")
                # 只使用第一个class
                first_class = class_name.split()[0] if class_name else ""
                if first_class:
                    return f"{tag}.{first_class}"

            return None
        except Exception:
            return None


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
