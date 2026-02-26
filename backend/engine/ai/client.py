"""统一AI客户端 - 基于场景路由到不同模型配置。

提供统一的接口来调用不同场景的AI模型，自动根据场景选择配置。
"""

import logging
from typing import Dict, Any, Optional
from openai import AsyncOpenAI, APIError, RateLimitError, APITimeoutError

from config.ai_models import (
    ScenarioType,
    get_ai_config_manager,
)

logger = logging.getLogger(__name__)


class AIClientError(Exception):
    """AI客户端错误。"""

    pass


class AIClient:
    """统一AI客户端。

    根据场景类型自动选择模型配置，提供统一的调用接口。
    支持同步和流式调用。
    """

    def __init__(self):
        """初始化AI客户端。"""
        self.config_manager = get_ai_config_manager()
        self._clients: Dict[str, AsyncOpenAI] = {}

    def _get_client(self, scenario: ScenarioType) -> AsyncOpenAI:
        """获取或创建指定场景的客户顿。

        Args:
            scenario: 场景类型

        Returns:
            OpenAI异步客户顿
        """
        config = self.config_manager.get_model_for_scenario(scenario)
        client_key = f"{config.provider}_{config.base_url}"

        if client_key not in self._clients:
            # 获取客户端配置（如有需要可用于后续扩展）
            # client_config = self.config_manager.get_client_config(scenario)

            self._clients[client_key] = AsyncOpenAI(
                api_key=config.api_key,
                base_url=config.base_url,
                timeout=config.timeout,
                max_retries=2,
            )

            logger.debug(f"创建AI客户端: {config.provider} -> {config.model}")

        return self._clients[client_key]

    async def chat_completion(
        self,
        messages: list,
        scenario: ScenarioType = ScenarioType.GENERAL,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        stream: bool = False,
        **extra_params,
    ) -> Dict[str, Any]:
        """发送聊天完成请求。

        Args:
            messages: 消息列表，格式为 [{"role": "user", "content": "..."}, ...]
            scenario: AI场景类型，决定使用哪个模型配置
            temperature: 覆盖配置的温度参数
            max_tokens: 覆盖配置的最大token数
            stream: 是否使用流式响应
            **extra_params: 额外参数

        Returns:
            响应结果字典

        Raises:
            AIClientError: 调用失败时
        """
        client = self._get_client(scenario)
        config = self.config_manager.get_model_for_scenario(scenario)

        request_params = {
            "model": config.model,
            "messages": messages,
            "temperature": temperature or config.temperature,
            "stream": stream,
        }

        if max_tokens or config.max_tokens:
            request_params["max_tokens"] = max_tokens or config.max_tokens

        request_params.update(config.extra_params)
        request_params.update(extra_params)

        try:
            logger.debug(
                f"[{scenario.value}] 发送请求到 {config.provider}/{config.model}"
            )

            if stream:
                return await self._stream_completion(client, request_params)
            else:
                response = await client.chat.completions.create(**request_params)
                return self._parse_response(response)

        except RateLimitError as e:
            logger.error(f"[{scenario.value}] 请求被限流: {e}")
            raise AIClientError(f"API请求被限流，请稍后重试: {e}")
        except APITimeoutError as e:
            logger.error(f"[{scenario.value}] 请求超时: {e}")
            raise AIClientError(f"API请求超时: {e}")
        except APIError as e:
            logger.error(f"[{scenario.value}] API错误: {e}")
            raise AIClientError(f"API调用失败: {e}")
        except Exception as e:
            logger.error(f"[{scenario.value}] 未知错误: {e}")
            raise AIClientError(f"AI调用失败: {e}")

    async def _stream_completion(
        self, client: AsyncOpenAI, request_params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """处理流式完成请求。

        Args:
            client: OpenAI客户端
            request_params: 请求参数

        Returns:
            合并后的响应结果
        """
        full_content = ""
        full_reasoning = ""
        model = request_params.get("model", "unknown")

        try:
            stream = await client.chat.completions.create(**request_params)

            async for chunk in stream:
                if chunk.choices:
                    delta = chunk.choices[0].delta
                    if delta.content:
                        full_content += delta.content
                    if hasattr(delta, "reasoning_content") and delta.reasoning_content:
                        full_reasoning += delta.reasoning_content

            result = {"content": full_content, "model": model, "finish_reason": "stop"}

            if full_reasoning:
                result["reasoning_content"] = full_reasoning

            return result

        except Exception as e:
            logger.error(f"流式请求处理失败: {e}")
            raise

    def _parse_response(self, response) -> Dict[str, Any]:
        """解析API响应。

        Args:
            response: OpenAI API响应对象

        Returns:
            标准化的响应字典
        """
        if not response.choices:
            raise AIClientError("API返回空响应")

        choice = response.choices[0]
        message = choice.message

        result = {
            "content": message.content or "",
            "model": response.model,
            "finish_reason": choice.finish_reason,
            "usage": {
                "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
                "completion_tokens": response.usage.completion_tokens
                if response.usage
                else 0,
                "total_tokens": response.usage.total_tokens if response.usage else 0,
            },
        }

        if hasattr(message, "reasoning_content") and message.reasoning_content:
            result["reasoning_content"] = message.reasoning_content

        return result

    async def simple_chat(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        scenario: ScenarioType = ScenarioType.GENERAL,
        **kwargs,
    ) -> str:
        """简化版聊天接口。

        Args:
            prompt: 用户提示
            system_prompt: 系统提示（可选）
            scenario: 场景类型
            **kwargs: 其他参数

        Returns:
            AI响应文本
        """
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        result = await self.chat_completion(messages, scenario, **kwargs)
        return result.get("content", "")

    async def intervention_detection(
        self, screenshot_base64: str, context: str = ""
    ) -> Dict[str, Any]:
        """干预检测专用接口。

        Args:
            screenshot_base64: 页面截图的base64编码
            context: 额外的上下文信息

        Returns:
            检测结果，包含是否需要干预、干预类型等
        """
        system_prompt = """你是一个网页自动化测试的专家。请分析当前页面截图，判断：
1. 是否需要人工干预（如验证码、登录态失效、安全验证等）
2. 页面是否正常加载
3. 建议的操作

请以JSON格式返回结果：
{
    "needs_intervention": true/false,
    "intervention_type": "验证码/登录/安全验证/其他/无",
    "confidence": 0-1之间的置信度,
    "suggested_action": "建议的操作",
    "description": "详细描述"
}"""

        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": f"请分析以下页面截图。上下文: {context}"},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{screenshot_base64}"
                        },
                    },
                ],
            },
        ]

        result = await self.chat_completion(
            messages,
            scenario=ScenarioType.INTERVENTION_DETECTION,
            temperature=0.1,
            max_tokens=500,
        )

        return result

    async def element_location(
        self,
        description: str,
        html_content: Optional[str] = None,
        screenshot_base64: Optional[str] = None,
    ) -> Dict[str, Any]:
        """元素定位专用接口。

        Args:
            description: 元素的自然语言描述
            html_content: 页面HTML内容（可选）
            screenshot_base64: 页面截图（可选）

        Returns:
            定位结果，包含选择器、坐标等
        """
        system_prompt = """你是一个网页元素定位专家。请根据用户描述，在页面中找到对应的元素。
请返回以下格式的JSON：
{
    "found": true/false,
    "selector": "CSS选择器，如果能确定",
    "xpath": "XPath，如果能确定",
    "text": "元素的文本内容",
    "description": "元素的具体描述",
    "confidence": 0-1之间的置信度
}"""

        content = f"请帮我定位以下元素: {description}"
        if html_content:
            content += f"\n\n页面HTML片段:\n{html_content[:3000]}"

        messages = [{"role": "system", "content": system_prompt}]

        if screenshot_base64:
            messages.append(
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": content},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{screenshot_base64}"
                            },
                        },
                    ],
                }
            )
        else:
            messages.append({"role": "user", "content": content})

        result = await self.chat_completion(
            messages,
            scenario=ScenarioType.ELEMENT_LOCATION,
            temperature=0.3,
            max_tokens=1000,
        )

        return result

    async def generate_workflow(
        self, description: str, existing_nodes: Optional[list] = None
    ) -> Dict[str, Any]:
        """工作流生成专用接口。

        Args:
            description: 工作流描述
            existing_nodes: 已有节点列表（可选）

        Returns:
            生成的工作流定义
        """
        system_prompt = """你是一个工作流设计专家。请根据用户描述生成SchemaFlow工作流。
SchemaFlow工作流包含以下节点类型：
- start: 开始节点
- end: 结束节点
- open_tab: 打开标签页
- navigate: 页面跳转
- click: 点击元素
- input_text: 输入文本
- screenshot: 截图
- ai_action: AI自动化
- loop: 循环
- condition: 条件分支
- wait: 等待

请返回JSON格式的工作流定义：
{
    "nodes": [
        {"id": "node_1", "type": "open_tab", "config": {"url": "..."}}
    ],
    "edges": [
        {"source": "node_1", "target": "node_2"}
    ]
}"""

        content = f"请生成以下工作流: {description}"
        if existing_nodes:
            content += f"\n\n已有节点: {existing_nodes}"

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": content},
        ]

        result = await self.chat_completion(
            messages,
            scenario=ScenarioType.WORKFLOW_GENERATION,
            temperature=0.7,
            max_tokens=4000,
        )

        return result

    def get_config_info(self) -> Dict[str, Any]:
        """获取当前配置信息。

        Returns:
            配置信息字典
        """
        scenarios = {}
        for scenario in self.config_manager.list_scenarios():
            config = self.config_manager.get_scenario_config(scenario)
            scenarios[scenario.value] = {
                "description": config.description,
                "provider": config.model.provider,
                "model": config.model.model,
                "temperature": config.model.temperature,
                "max_tokens": config.model.max_tokens,
            }

        return {
            "scenarios": scenarios,
            "config_file": str(self.config_manager._config_file),
        }


_ai_client = None


def get_ai_client() -> AIClient:
    """获取AI客户端实例（单例）。

    Returns:
        AIClient实例
    """
    global _ai_client
    if _ai_client is None:
        _ai_client = AIClient()
    return _ai_client
