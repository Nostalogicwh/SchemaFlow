"""AI模型配置管理 - 统一管理不同场景的AI模型配置。

支持按场景配置不同的模型类型，包括：
- intervention_detection: 干预检测
- element_location: 元素定位
- workflow_generation: 工作流生成
- code_generation: 代码生成
- general: 通用任务
"""

import os
import yaml
import logging
from pathlib import Path
from dataclasses import dataclass, field
from typing import Dict, Optional, Any
from enum import Enum

logger = logging.getLogger(__name__)


class ScenarioType(str, Enum):
    """AI应用场景类型。"""

    INTERVENTION_DETECTION = "intervention_detection"  # 干预检测
    ELEMENT_LOCATION = "element_location"  # 元素定位
    WORKFLOW_GENERATION = "workflow_generation"  # 工作流生成
    CODE_GENERATION = "code_generation"  # 代码生成
    GENERAL = "general"  # 通用任务


@dataclass
class ModelConfig:
    """单个模型的配置。"""

    provider: str  # 提供商 (openai, anthropic, deepseek等)
    model: str  # 模型名称
    api_key: Optional[str] = None  # API密钥
    base_url: Optional[str] = None  # API基础URL
    temperature: float = 0.7  # 温度参数
    max_tokens: Optional[int] = None  # 最大token数
    timeout: int = 60  # 超时时间(秒)
    extra_params: Dict[str, Any] = field(default_factory=dict)  # 额外参数


@dataclass
class ScenarioConfig:
    """场景配置，包含该场景使用的模型配置。"""

    scenario: ScenarioType  # 场景类型
    description: str  # 场景描述
    model: ModelConfig  # 模型配置
    fallback_enabled: bool = True  # 是否启用回退
    fallback_models: list = field(default_factory=list)  # 回退模型列表


class AIModelConfigManager:
    """AI模型配置管理器。

    负责加载、管理和提供不同场景的AI模型配置。
    支持从YAML配置文件加载，并允许环境变量覆盖。
    """

    _instance = None
    _config: Dict[ScenarioType, ScenarioConfig] = {}
    _config_file: Path = None

    def __new__(cls):
        """单例模式。"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        """初始化配置管理器。"""
        if not self._config:
            self._load_config()

    def _get_config_path(self) -> Path:
        """获取配置文件路径。

        按以下顺序查找：
        1. 环境变量 AI_CONFIG_PATH
        2. 项目根目录 backend/config/ai_config.yaml
        3. 当前目录 ai_config.yaml

        Returns:
            配置文件路径
        """
        # 1. 环境变量
        if env_path := os.environ.get("AI_CONFIG_PATH"):
            path = Path(env_path)
            if path.exists():
                return path
            logger.warning(f"环境变量 AI_CONFIG_PATH 指定的文件不存在: {env_path}")

        # 2. 项目默认路径
        base_dir = Path(__file__).parent.parent.parent
        default_path = base_dir / "backend" / "config" / "ai_config.yaml"
        if default_path.exists():
            return default_path

        # 3. 备用路径
        fallback_path = Path("ai_config.yaml")
        if fallback_path.exists():
            return fallback_path

        logger.warning("未找到AI配置文件，将使用默认配置")
        return default_path

    def _load_config(self):
        """加载配置文件。"""
        config_path = self._get_config_path()
        self._config_file = config_path

        if not config_path.exists():
            logger.warning(f"配置文件不存在: {config_path}，创建默认配置")
            self._create_default_config()
            return

        try:
            with open(config_path, "r", encoding="utf-8") as f:
                raw_config = yaml.safe_load(f)

            if not raw_config or "scenarios" not in raw_config:
                logger.warning("配置文件格式错误，使用默认配置")
                self._create_default_config()
                return

            # 解析配置
            for scenario_name, scenario_data in raw_config["scenarios"].items():
                try:
                    scenario = ScenarioType(scenario_name)
                    model_data = scenario_data.get("model", {})

                    # 环境变量覆盖API密钥
                    api_key = model_data.get("api_key")
                    env_var_name = f"AI_API_KEY_{scenario.value.upper()}"
                    if env_api_key := os.environ.get(env_var_name):
                        api_key = env_api_key
                        logger.debug(f"使用环境变量 {env_var_name} 覆盖API密钥")

                    model_config = ModelConfig(
                        provider=model_data.get("provider", "openai"),
                        model=model_data.get("model", "gpt-3.5-turbo"),
                        api_key=api_key,
                        base_url=model_data.get("base_url"),
                        temperature=model_data.get("temperature", 0.7),
                        max_tokens=model_data.get("max_tokens"),
                        timeout=model_data.get("timeout", 60),
                        extra_params=model_data.get("extra_params", {}),
                    )

                    scenario_config = ScenarioConfig(
                        scenario=scenario,
                        description=scenario_data.get("description", ""),
                        model=model_config,
                        fallback_enabled=scenario_data.get("fallback_enabled", True),
                        fallback_models=scenario_data.get("fallback_models", []),
                    )

                    self._config[scenario] = scenario_config
                    logger.info(
                        f"加载场景配置: {scenario.value} -> {model_config.provider}/{model_config.model}"
                    )

                except ValueError as e:
                    logger.warning(f"未知的场景类型: {scenario_name}, 跳过: {e}")

        except Exception as e:
            logger.error(f"加载配置文件失败: {e}")
            self._create_default_config()

    def _create_default_config(self):
        """创建默认配置。"""
        default_model = ModelConfig(
            provider="deepseek",
            model="deepseek-chat",
            api_key=os.environ.get("LLM_API_KEY"),
            base_url=os.environ.get("LLM_BASE_URL", "https://api.deepseek.com/v1"),
            temperature=0.7,
            timeout=60,
        )

        for scenario in ScenarioType:
            self._config[scenario] = ScenarioConfig(
                scenario=scenario,
                description=f"{scenario.value} 场景的默认配置",
                model=default_model,
                fallback_enabled=True,
                fallback_models=[],
            )

        logger.info("已创建默认AI模型配置")

    def get_scenario_config(self, scenario: ScenarioType) -> ScenarioConfig:
        """获取指定场景的配置。

        Args:
            scenario: 场景类型

        Returns:
            场景配置
        """
        if scenario not in self._config:
            # 返回通用配置作为回退
            logger.warning(f"场景 {scenario.value} 未配置，使用通用配置")
            return self._config.get(
                ScenarioType.GENERAL, self._create_default_general_config()
            )
        return self._config[scenario]

    def get_model_for_scenario(self, scenario: ScenarioType) -> ModelConfig:
        """获取指定场景的模型配置。

        Args:
            scenario: 场景类型

        Returns:
            模型配置
        """
        config = self.get_scenario_config(scenario)
        return config.model

    def get_client_config(self, scenario: ScenarioType) -> Dict[str, Any]:
        """获取指定场景的客户顿配置字典。

        返回可用于初始化OpenAI/Anthropic等客户端的配置。

        Args:
            scenario: 场景类型

        Returns:
            客户端配置字典
        """
        model_config = self.get_model_for_scenario(scenario)

        config = {
            "model": model_config.model,
            "temperature": model_config.temperature,
            "timeout": model_config.timeout,
        }

        if model_config.max_tokens:
            config["max_tokens"] = model_config.max_tokens

        # 添加提供商特定的配置
        if model_config.provider in ["openai", "deepseek"]:
            config["api_key"] = model_config.api_key
            if model_config.base_url:
                config["base_url"] = model_config.base_url
        elif model_config.provider == "anthropic":
            config["api_key"] = model_config.api_key

        # 合并额外参数
        config.update(model_config.extra_params)

        return config

    def _create_default_general_config(self) -> ScenarioConfig:
        """创建默认的通用配置。"""
        return ScenarioConfig(
            scenario=ScenarioType.GENERAL,
            description="通用任务的默认配置",
            model=ModelConfig(
                provider="deepseek",
                model="deepseek-chat",
                api_key=os.environ.get("LLM_API_KEY"),
                base_url=os.environ.get("LLM_BASE_URL", "https://api.deepseek.com/v1"),
                temperature=0.7,
                timeout=60,
            ),
            fallback_enabled=True,
            fallback_models=[],
        )

    def list_scenarios(self) -> list:
        """列出所有已配置的场景。

        Returns:
            场景类型列表
        """
        return list(self._config.keys())

    def reload(self):
        """重新加载配置。"""
        self._config.clear()
        self._load_config()
        logger.info("配置已重新加载")


# 全局配置管理器实例
_config_manager = None


def get_ai_config_manager() -> AIModelConfigManager:
    """获取AI配置管理器实例（单例）。

    Returns:
        AIModelConfigManager实例
    """
    global _config_manager
    if _config_manager is None:
        _config_manager = AIModelConfigManager()
    return _config_manager


def get_model_for_scenario(scenario: ScenarioType) -> ModelConfig:
    """快捷函数：获取指定场景的模型配置。

    Args:
        scenario: 场景类型

    Returns:
        模型配置
    """
    return get_ai_config_manager().get_model_for_scenario(scenario)


def get_client_config(scenario: ScenarioType) -> Dict[str, Any]:
    """快捷函数：获取指定场景的客户顿配置。

    Args:
        scenario: 场景类型

    Returns:
        客户端配置字典
    """
    return get_ai_config_manager().get_client_config(scenario)
