"""登录态检测模块 - 检测页面是否处于已登录状态。"""
import logging

logger = logging.getLogger(__name__)


async def check_login_status(page, url: str) -> bool:
    """检测页面是否处于已登录状态。

    通过以下信号判断：
    1. URL 是否跳转到了 login/signin 页面
    2. 页面是否存在明显的登录表单

    Args:
        page: Playwright page 对象
        url: 目标 URL

    Returns:
        bool: True 表示已登录，False 表示未登录
    """
    current_url = page.url.lower()
    login_keywords = ["login", "signin", "sign-in", "auth", "passport", "/sign_in", "/log_in"]
    
    if any(kw in current_url for kw in login_keywords):
        logger.debug(f"检测到登录关键词在 URL 中: {current_url}")
        return False

    # 检查是否有明显的登录表单
    try:
        login_form = await page.query_selector(
            'form[action*="login"], form[action*="signin"], '
            'input[type="password"]:visible, '
            '[data-testid*="login"], [data-testid*="signin"], '
            '.login-form, .signin-form, #login-form, #signin-form'
        )
        if login_form:
            logger.debug("检测到登录表单")
            return False
    except Exception as e:
        logger.warning(f"检查登录状态时出错: {e}")

    return True


async def wait_for_login_completion(page, timeout: int = 300) -> bool:
    """等待用户完成登录。

    通过检测页面变化来判断登录是否完成。

    Args:
        page: Playwright page 对象
        timeout: 超时时间（秒）

    Returns:
        bool: True 表示登录成功，False 表示超时
    """
    import asyncio
    
    logger.info(f"等待用户登录完成，超时时间: {timeout}秒")
    
    start_time = asyncio.get_event_loop().time()
    check_interval = 2  # 每2秒检查一次
    
    while (asyncio.get_event_loop().time() - start_time) < timeout:
        # 检查是否还在登录页
        is_logged_in = await check_login_status(page, page.url)
        if is_logged_in:
            logger.info("检测到登录完成")
            return True
        
        await asyncio.sleep(check_interval)
    
    logger.warning("等待登录超时")
    return False
