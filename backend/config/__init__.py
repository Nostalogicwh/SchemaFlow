"""后端配置模块 - 统一配置管理。

此模块提供配置加载和管理功能。

使用方式：
    # 基础配置
    from config import get_config, get_settings
    config = get_config()
    port = config["server"]["port"]

    # AI 配置
    from config import get_ai_config, get_model_for_scenario
    model = get_model_for_scenario("intervention_detection")

    # 向后兼容：get_settings() 等同于 get_config()
"""

from .loader import (
    load_config,
    get_config,
    get_ai_config,
    get_model_config,
    get_model_for_scenario,
    get_server_config,
    get_browser_config,
    get_logging_config,
    reload_config,
    setup_logging,
)

# 向后兼容：旧版 config.py 的接口
get_settings = get_config

__all__ = [
    "load_config",
    "get_config",
    "get_settings",
    "get_ai_config",
    "get_model_config",
    "get_model_for_scenario",
    "get_server_config",
    "get_browser_config",
    "get_logging_config",
    "reload_config",
    "setup_logging",
]
