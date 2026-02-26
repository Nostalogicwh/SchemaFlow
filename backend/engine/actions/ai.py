"""AI自动化操作节点。"""

from typing import Dict, Any
from ..actions import register_action


@register_action(
    name="ai_action",
    label="AI自动化",
    description="使用AI自动执行浏览器操作，通过自然语言描述任务",
    category="ai",
    parameters={
        "type": "object",
        "properties": {
            "prompt": {
                "type": "string",
                "description": "自然语言描述的任务，例如：点击登录按钮，在搜索框输入关键词",
            },
            "max_steps": {
                "type": "integer",
                "description": "最大执行步骤数",
                "default": 10,
            },
        },
        "required": ["prompt"],
    },
    inputs=["flow"],
    outputs=["flow"],
)
async def ai_action_action(context: Any, config: Dict[str, Any]) -> Dict[str, Any]:
    """执行AI自动化操作。

    使用browser-use库实现自然语言驱动的浏览器操作。

    Args:
        context: 执行上下文，包含browser和page
        config: 节点配置，包含prompt和max_steps

    Returns:
        执行结果
    """
    prompt = config.get("prompt")
    max_steps = config.get("max_steps", 10)

    if not prompt:
        raise ValueError("ai_action 节点需要 prompt 参数")

    await context.log("info", f"AI自动化开始: {prompt[:50]}...")

    try:
        from browser_use import Agent
        from browser_use.llm.openai.chat import ChatOpenAI
        from browser_use.browser.session import BrowserSession
        from browser_use.browser.profile import BrowserProfile
        from config import get_settings

        # 获取LLM配置
        settings = get_settings()
        llm_cfg = settings.get("llm", {})

        # 创建 browser-use 的 ChatOpenAI 对象
        llm = ChatOpenAI(
            model=llm_cfg.get("model", "gpt-4o"),
            api_key=llm_cfg.get("api_key"),
            base_url=llm_cfg.get("base_url"),
            temperature=0.1,
        )

        # 创建 browser-use 的 BrowserSession
        # 如果有 CDP URL，连接到现有浏览器
        cdp_url = None
        if context.browser:
            # 尝试获取 CDP URL
            try:
                if hasattr(context.browser, "ws_endpoint"):
                    cdp_url = context.browser.ws_endpoint
                elif hasattr(context, "_cdp_url"):
                    cdp_url = context._cdp_url
            except:
                pass

        # 创建 BrowserSession
        browser_session = BrowserSession(
            cdp_url=cdp_url,
            is_local=True,
            headless=False,
        )

        # 创建 Agent
        agent = Agent(
            task=prompt,
            llm=llm,
            browser_session=browser_session,
            max_actions=max_steps,
        )

        result = await agent.run()

        await context.log("info", "AI自动化完成")

        return {
            "result": "AI自动化执行完成",
            "final_result": str(result.final_result)
            if hasattr(result, "final_result")
            else None,
        }

    except ImportError:
        raise ValueError("browser-use库未安装，请运行: pip install browser-use")
    except (RuntimeError, TimeoutError) as e:
        await context.log("error", f"AI自动化失败: {str(e)}")
        raise ValueError(f"AI自动化执行失败: {str(e)}")
    except Exception as e:
        await context.log("error", f"AI自动化错误: {str(e)}")
        raise ValueError(f"AI自动化执行错误: {str(e)}")
