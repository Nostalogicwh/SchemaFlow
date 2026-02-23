"""控制节点 - 等待、用户输入等。"""

from typing import Dict, Any
from ..actions import register_action
from .utils import locate_element


@register_action(
    name="wait",
    label="等待",
    description="等待指定时间",
    category="control",
    parameters={
        "type": "object",
        "properties": {
            "seconds": {"type": "number", "description": "等待的秒数", "default": 1}
        },
        "required": [],
    },
    inputs=["flow"],
    outputs=["flow"],
)
async def wait_action(context: Any, config: Dict[str, Any]) -> Dict[str, Any]:
    """等待指定时间。

    Args:
        context: 执行上下文
        config: 节点配置，包含 seconds

    Returns:
        执行结果
    """
    import asyncio

    seconds = config.get("seconds", 1)
    if seconds <= 0:
        await context.log("info", "等待时间为 0，跳过等待")
        return {}
    await context.log("info", f"等待 {seconds} 秒")
    await asyncio.sleep(seconds)
    return {}


@register_action(
    name="wait_for_element",
    label="等待元素",
    description="等待元素出现",
    category="control",
    parameters={
        "type": "object",
        "properties": {
            "selector": {"type": "string", "description": "CSS 选择器"},
            "ai_target": {
                "type": "string",
                "description": "AI 定位目标描述（当 selector 不存在时使用）",
            },
            "wait_time": {
                "type": "number",
                "description": "等待时间（秒）",
                "default": 10,
            },
            "timeout": {
                "type": "number",
                "description": "结束等待时间（秒）",
                "default": 30,
            },
        },
        "required": [],
    },
    inputs=["flow"],
    outputs=["flow"],
)
async def wait_for_element_action(
    context: Any, config: Dict[str, Any]
) -> Dict[str, Any]:
    """等待元素出现。

    Args:
        context: 执行上下文
        config: 节点配置，包含 selector、ai_target、wait_time 和 timeout

    Returns:
        执行结果
    """
    selector = config.get("selector")
    ai_target = config.get("ai_target")
    wait_time = config.get("wait_time", 10)  # 等待时间（秒）
    timeout = config.get("timeout", 30)  # 结束等待时间（秒）

    if not selector and not ai_target:
        raise ValueError("wait_for_element 节点需要提供 selector 或 ai_target 参数")

    target_desc = selector or ai_target
    await context.log(
        "info",
        f"等待元素: {target_desc} (等待时间: {wait_time}s, 结束等待: {timeout}s)",
    )

    try:
        # 使用 locate_element 来定位元素（支持 AI 定位）
        # wait_time 作为定位的超时时间，timeout 作为整体节点的最大执行时间
        await locate_element(
            context.page,
            selector,
            ai_target,
            context,
            wait_for_visible=True,
            timeout=wait_time * 1000,
        )
        await context.log("info", f"元素已出现: {target_desc}")
    except ValueError as e:
        await context.log("error", f"等待元素失败: {target_desc}, 错误: {str(e)}")
        raise

    return {}


@register_action(
    name="user_input",
    label="用户干预",
    description="暂停执行，等待用户手动操作后继续",
    category="control",
    parameters={
        "type": "object",
        "properties": {
            "prompt": {"type": "string", "description": "提示信息"},
            "timeout": {
                "type": "number",
                "description": "超时时间（秒）",
                "default": 300,
            },
        },
        "required": ["prompt"],
    },
    inputs=["flow"],
    outputs=["flow"],
)
async def user_input_action(context: Any, config: Dict[str, Any]) -> Dict[str, Any]:
    """用户干预节点。

    暂停执行并等待用户输入。
    - 前台模式：在 Playwright 浏览器顶部显示非阻塞通知栏，页面跳转时自动继续
    - 后台模式：通过 WebSocket 通知前端应用显示弹窗

    Args:
        context: 执行上下文
        config: 节点配置

    Returns:
        执行结果

    Raises:
        RuntimeError: 用户取消操作（仅限明确点击取消）
    """
    import asyncio
    import logging

    logger = logging.getLogger(__name__)

    prompt = config.get("prompt", "请完成操作后继续")
    timeout = config.get("timeout", 300)

    is_headed = not getattr(context, "_headless", True)
    await context.log("info", f"等待用户输入: {prompt} (前台模式: {is_headed})")

    if is_headed and context.page:
        await context.log("info", "前台模式：在浏览器中显示顶部通知栏")
        try:
            result = await context.page.evaluate(
                """({ prompt, timeout }) => {
                    return new Promise((resolve) => {
                        const oldBanner = document.getElementById('schemaflow-banner');
                        if (oldBanner) oldBanner.remove();
                        
                        const banner = document.createElement('div');
                        banner.id = 'schemaflow-banner';
                        banner.style.cssText = `
                            position: fixed;
                            top: 0;
                            left: 0;
                            right: 0;
                            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                            color: white;
                            padding: 12px 20px;
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            font-family: system-ui, -apple-system, sans-serif;
                            font-size: 14px;
                            z-index: 2147483647;
                            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                        `;
                        
                        const content = document.createElement('div');
                        content.style.cssText = 'flex: 1; display: flex; align-items: center; gap: 10px;';
                        content.innerHTML = '<span style="font-size: 18px;">🙋</span><span>' + prompt + '</span>';
                        
                        const buttons = document.createElement('div');
                        buttons.style.cssText = 'display: flex; gap: 8px;';
                        
                        const continueBtn = document.createElement('button');
                        continueBtn.textContent = '继续执行';
                        continueBtn.style.cssText = `
                            padding: 8px 16px;
                            background: white;
                            color: #2563eb;
                            border: none;
                            border-radius: 6px;
                            cursor: pointer;
                            font-weight: 500;
                            font-size: 14px;
                        `;
                        continueBtn.onclick = () => {
                            banner.remove();
                            resolve('continue');
                        };
                        
                        const cancelBtn = document.createElement('button');
                        cancelBtn.textContent = '取消执行';
                        cancelBtn.style.cssText = `
                            padding: 8px 16px;
                            background: rgba(255,255,255,0.2);
                            color: white;
                            border: 1px solid rgba(255,255,255,0.3);
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 14px;
                        `;
                        cancelBtn.onclick = () => {
                            banner.remove();
                            resolve('cancel');
                        };
                        
                        buttons.appendChild(continueBtn);
                        buttons.appendChild(cancelBtn);
                        banner.appendChild(content);
                        banner.appendChild(buttons);
                        document.body.appendChild(banner);
                        
                        setTimeout(() => {
                            if (document.getElementById('schemaflow-banner')) {
                                banner.remove();
                                resolve('timeout');
                            }
                        }, timeout * 1000);
                    });
                }""",
                {"prompt": prompt, "timeout": timeout},
            )

            if result == "cancel":
                await context.log("info", "用户取消了操作")
                raise RuntimeError("用户取消了操作")
            elif result == "timeout":
                await context.log("info", "等待超时，自动继续执行")
            else:
                await context.log("info", "用户点击了继续")

            return {}

        except RuntimeError:
            raise
        except Exception as e:
            await context.log("info", f"页面可能已跳转（{e}），自动继续执行下一节点")
            return {}

    if context.websocket:
        try:
            logger.info(f"[{context.execution_id}] 后台模式：等待 WebSocket 响应")
            response = await context.request_user_input(prompt, timeout)
            logger.info(f"[{context.execution_id}] 收到 WebSocket 响应: {response}")
            await context.log("info", f"用户响应: {response}")
            if response == "cancel":
                raise RuntimeError("用户取消了操作")
        except TimeoutError:
            await context.log("info", "用户输入超时，自动继续执行")
        except RuntimeError:
            raise
        except Exception as e:
            logger.error(f"[{context.execution_id}] 后台模式异常: {e}", exc_info=True)
            await context.log("warning", f"等待异常: {e}，自动继续执行")
    else:
        await context.log("info", "无 WebSocket 连接，等待 5 秒后继续")
        await asyncio.sleep(5)

    return {}
