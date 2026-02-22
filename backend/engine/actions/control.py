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
            "use_browser_dialog": {
                "type": "boolean",
                "description": "前台模式下是否使用浏览器弹窗（而非前端弹窗）",
                "default": True,
            },
        },
        "required": ["prompt"],
    },
    inputs=["flow"],
    outputs=["flow"],
)
async def user_input_action(context: Any, config: Dict[str, Any]) -> Dict[str, Any]:
    """用户干预节点。

    暂停执行并等待用户输入。支持三种模式：
    1. 后台模式（headless=True）：通过WebSocket发送消息到前端显示弹窗
    2. 前台模式（headless=False）：在Playwright浏览器中显示confirm弹窗
    3. 无WebSocket模式：直接等待

    Args:
        context: 执行上下文
        config: 节点配置

    Returns:
        执行结果

    Raises:
        TimeoutError: 用户输入超时
        RuntimeError: 用户取消操作
    """
    prompt = config.get("prompt", "请完成操作后继续")
    timeout = config.get("timeout", 300)
    use_browser_dialog = config.get("use_browser_dialog", True)

    await context.log("info", f"等待用户输入: {prompt}")

    # 判断是否是前台模式
    is_headed_mode = not getattr(context, "_is_cdp", False) and context.page is not None

    # 前台模式：在Playwright浏览器中显示弹窗
    if is_headed_mode and use_browser_dialog and context.page:
        await context.log("info", "前台模式：在浏览器中显示弹窗")
        try:
            # 在浏览器中显示自定义弹窗
            result = await context.page.evaluate(
                """(prompt) => {
                    return new Promise((resolve) => {
                        // 创建自定义弹窗样式
                        const dialog = document.createElement('div');
                        dialog.id = 'schemaflow-user-input-dialog';
                        dialog.style.cssText = `
                            position: fixed;
                            top: 50%;
                            left: 50%;
                            transform: translate(-50%, -50%);
                            background: white;
                            padding: 20px;
                            border-radius: 8px;
                            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                            z-index: 10000;
                            font-family: system-ui, -apple-system, sans-serif;
                            max-width: 400px;
                            text-align: center;
                        `;

                        // 添加遮罩层
                        const overlay = document.createElement('div');
                        overlay.style.cssText = `
                            position: fixed;
                            top: 0;
                            left: 0;
                            width: 100%;
                            height: 100%;
                            background: rgba(0,0,0,0.5);
                            z-index: 9999;
                        `;

                        // 弹窗内容
                        dialog.innerHTML = `
                            <div style="margin-bottom: 15px;">
                                <strong style="font-size: 16px; color: #333;">SchemaFlow - 需要用户操作</strong>
                            </div>
                            <div style="margin-bottom: 20px; color: #666; line-height: 1.5;">${prompt}</div>
                            <div style="display: flex; gap: 10px; justify-content: center;">
                                <button id="schemaflow-continue" style="
                                    padding: 8px 20px;
                                    background: #2563eb;
                                    color: white;
                                    border: none;
                                    border-radius: 4px;
                                    cursor: pointer;
                                    font-size: 14px;
                                ">继续执行</button>
                                <button id="schemaflow-cancel" style="
                                    padding: 8px 20px;
                                    background: #e5e7eb;
                                    color: #374151;
                                    border: none;
                                    border-radius: 4px;
                                    cursor: pointer;
                                    font-size: 14px;
                                ">取消</button>
                            </div>
                        `;

                        document.body.appendChild(overlay);
                        document.body.appendChild(dialog);

                        // 绑定按钮事件
                        document.getElementById('schemaflow-continue').onclick = () => {
                            document.body.removeChild(dialog);
                            document.body.removeChild(overlay);
                            resolve('continue');
                        };

                        document.getElementById('schemaflow-cancel').onclick = () => {
                            document.body.removeChild(dialog);
                            document.body.removeChild(overlay);
                            resolve('cancel');
                        };
                    });
                }""",
                prompt,
            )

            if result == "cancel":
                await context.log("info", "用户在浏览器中取消了操作")
                raise RuntimeError("用户取消了操作")

            await context.log("info", "用户在浏览器中点击了继续")

        except Exception as e:
            if "用户取消" in str(e):
                raise
            # 如果浏览器弹窗失败，回退到前端弹窗
            await context.log("warning", f"浏览器弹窗失败，回退到前端弹窗: {e}")

    # 后台模式或无浏览器模式：通过WebSocket发送消息到前端
    if context.websocket:
        try:
            response = await context.request_user_input(prompt, timeout)
            await context.log("info", f"用户响应: {response}")
        except TimeoutError:
            await context.log("warning", "用户输入超时，继续执行")
            # 超时后继续执行，不中断流程
        except RuntimeError as e:
            await context.log("info", f"用户取消: {e}")
            # 用户取消，抛出异常让执行器处理
            raise
    else:
        # 无 WebSocket 模式，直接等待
        import asyncio

        await context.log("info", "无 WebSocket 连接，等待 5 秒后继续")
        await asyncio.sleep(5)

    return {}
