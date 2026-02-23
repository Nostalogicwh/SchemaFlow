"""
AI干预检测模块 - 使用轻量级LLM检测页面是否需要人工干预

功能:
- 检测登录框/登录表单
- 检测验证码(CAPTCHA)
- 检测广告拦截或隐私政策弹窗
- 检测需要人工确认的安全弹窗

要求:
- 使用gpt-4o-mini降低成本
- 检测失败时默认需要干预(安全优先)
- 所有注释使用中文
"""

import base64
import json
import logging
from typing import Dict, Any, Optional, List
import httpx

from config import get_settings

logger = logging.getLogger(__name__)

AI_INTERVENTION_MODEL = "gpt-4o-mini"


INTERVENTION_DETECTION_PROMPT = """分析以下网页截图，判断是否需要人工干预。

请检查是否存在以下情况：
1. 登录框或登录表单（包括用户名/密码输入框、登录按钮）
2. 验证码(CAPTCHA)界面
3. 广告拦截提示或隐私政策弹窗
4. 需要人工确认的安全弹窗或警告
5. 人机验证(CAPTCHA、reCAPTCHA、hCaptcha等)

请按以下JSON格式返回结果：
{
    "needs_intervention": true/false,
    "intervention_type": "类型描述",
    "confidence": 0.0-1.0,
    "reason": "判断原因"
}

只返回JSON，不要包含其他文字。"""


class InterventionType:
    """干预类型常量定义"""

    LOGIN = "登录表单"
    CAPTCHA = "验证码"
    POPUP = "弹窗"
    SECURITY = "安全确认"
    UNKNOWN = "未知"
    NONE = None


class AIInterventionDetector:
    """
    AI干预检测器

    使用轻量级LLM分析页面截图，判断是否需要人工干预。
    检测失败时默认需要干预（安全优先原则）。
    """

    def __init__(self, model: str = AI_INTERVENTION_MODEL):
        """
        初始化检测器

        Args:
            model: 使用的AI模型，默认gpt-4o-mini
        """
        self.model = model
        self.settings = get_settings()
        self.llm_config = self.settings.get("llm", {})

    async def detect(self, screenshot_base64: str) -> Dict[str, Any]:
        """
        检测截图是否需要人工干预

        Args:
            screenshot_base64: 截图的base64编码字符串

        Returns:
            检测结果字典，包含：
            - needs_intervention: bool - 是否需要干预
            - intervention_type: str - 干预类型
            - confidence: float - 置信度
            - reason: str - 判断原因
        """
        try:
            result = await self._call_llm_for_detection(screenshot_base64)
            return result
        except Exception as e:
            logger.warning(f"AI干预检测失败: {e}，默认需要干预")
            return {
                "needs_intervention": True,
                "intervention_type": InterventionType.UNKNOWN,
                "confidence": 0.5,
                "reason": f"检测过程出错: {str(e)}，为确保安全默认需要干预",
            }

    async def _call_llm_for_detection(self, screenshot_base64: str) -> Dict[str, Any]:
        """
        调用LLM进行干预检测

        Args:
            screenshot_base64: 截图的base64编码

        Returns:
            解析后的检测结果
        """
        api_key = self.llm_config.get("api_key")
        base_url = self.llm_config.get("base_url", "https://api.openai.com/v1")

        if not api_key:
            raise ValueError("未配置LLM API Key")

        messages = [
            {"role": "system", "content": INTERVENTION_DETECTION_PROMPT},
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "请分析这张网页截图，判断是否需要人工干预。",
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{screenshot_base64}"
                        },
                    },
                ],
            },
        ]

        timeout = httpx.Timeout(30.0, connect=5.0)

        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                f"{base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "messages": messages,
                    "temperature": 0.1,
                    "max_tokens": 500,
                },
            )

            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]

            result = self._parse_detection_result(content)
            logger.info(
                f"AI干预检测结果: needs_intervention={result['needs_intervention']}, "
                f"type={result['intervention_type']}, confidence={result['confidence']}"
            )
            return result

    def _parse_detection_result(self, content: str) -> Dict[str, Any]:
        """
        解析LLM返回的检测结果

        Args:
            content: LLM返回的JSON字符串

        Returns:
            解析后的字典
        """
        text = content.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

        try:
            result = json.loads(text)

            if "needs_intervention" not in result:
                raise ValueError("缺少needs_intervention字段")

            return {
                "needs_intervention": bool(result.get("needs_intervention", True)),
                "intervention_type": result.get(
                    "intervention_type", InterventionType.UNKNOWN
                ),
                "confidence": float(result.get("confidence", 0.5)),
                "reason": result.get("reason", "未提供原因"),
            }
        except json.JSONDecodeError as e:
            logger.error(f"解析AI检测结果失败: {e}")
            negative_keywords = ["不需要", "无需", "no intervention", "not needed"]
            if any(kw in text.lower() for kw in negative_keywords):
                return {
                    "needs_intervention": False,
                    "intervention_type": InterventionType.NONE,
                    "confidence": 0.6,
                    "reason": "通过关键词判断无需干预",
                }
            return {
                "needs_intervention": True,
                "intervention_type": InterventionType.UNKNOWN,
                "confidence": 0.5,
                "reason": f"无法解析AI响应: {str(e)}，默认需要干预",
            }


_detector_instance: Optional[AIInterventionDetector] = None


def get_detector() -> AIInterventionDetector:
    """获取全局检测器实例（单例模式）"""
    global _detector_instance
    if _detector_instance is None:
        _detector_instance = AIInterventionDetector()
    return _detector_instance


async def detect_intervention(screenshot_base64: str) -> Dict[str, Any]:
    """
    便捷函数：检测是否需要干预

    Args:
        screenshot_base64: 截图的base64编码

    Returns:
        检测结果
    """
    detector = get_detector()
    return await detector.detect(screenshot_base64)
