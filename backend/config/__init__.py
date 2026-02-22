"""后端配置模块 - AI模型配置管理。

此模块提供AI模型配置管理功能。
主配置（get_settings）请从 backend.config（backend/config.py）导入。
"""

from .ai_models import (
    AIModelConfigManager,
    ScenarioType,
    ModelConfig,
    ScenarioConfig,
    get_ai_config_manager,
    get_model_for_scenario,
    get_client_config,
)

__all__ = [
    "AIModelConfigManager",
    "ScenarioType",
    "ModelConfig",
    "ScenarioConfig",
    "get_ai_config_manager",
    "get_model_for_scenario",
    "get_client_config",
]
