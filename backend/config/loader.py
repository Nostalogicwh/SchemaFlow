"""统一配置加载器 - 支持 YAML 配置文件、本地覆盖和环境变量优先。

配置加载优先级（从低到高）：
1. config.yaml - 默认配置
2. config.local.yaml - 本地覆盖（不提交到git）
3. 环境变量 - 最高优先级

使用方式：
    from config import get_config, get_ai_config, get_model_for_scenario

    config = get_config()
    server_port = config["server"]["port"]

    ai_config = get_ai_config()
    model = get_model_for_scenario("intervention_detection")
"""

import os
import logging
from pathlib import Path
from typing import Any, Dict, Optional

import yaml

logger = logging.getLogger(__name__)

_BASE_DIR = Path(__file__).parent.parent
_CONFIG: Optional[Dict[str, Any]] = None


def _deep_merge(base: Dict, override: Dict) -> Dict:
    """深度合并两个字典，override 覆盖 base。"""
    merged = base.copy()
    for key, value in override.items():
        if key in merged and isinstance(merged[key], dict) and isinstance(value, dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def _load_yaml(path: Path) -> Dict[str, Any]:
    """加载 YAML 文件。"""
    if not path.exists():
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def _apply_env_overrides(config: Dict[str, Any]) -> Dict[str, Any]:
    """应用环境变量覆盖。"""
    # AI 相关环境变量
    if os.environ.get("LLM_API_KEY"):
        config.setdefault("ai", {})["api_key"] = os.environ["LLM_API_KEY"]
    if os.environ.get("LLM_BASE_URL"):
        config.setdefault("ai", {})["base_url"] = os.environ["LLM_BASE_URL"]

    # 服务器配置
    if os.environ.get("SERVER_HOST"):
        config.setdefault("server", {})["host"] = os.environ["SERVER_HOST"]
    if os.environ.get("SERVER_PORT"):
        config.setdefault("server", {})["port"] = int(os.environ["SERVER_PORT"])

    # 浏览器配置
    if os.environ.get("CDP_URL"):
        config.setdefault("browser", {})["cdp_url"] = os.environ["CDP_URL"]

    return config


def _load() -> Dict[str, Any]:
    """加载配置文件并应用覆盖。"""
    # 1. 加载默认配置
    default_path = _BASE_DIR / "config.yaml"
    config = _load_yaml(default_path)

    # 2. 加载本地覆盖（可选）
    local_path = _BASE_DIR / "config.local.yaml"
    if local_path.exists():
        local_config = _load_yaml(local_path)
        config = _deep_merge(config, local_config)
        logger.debug(f"已加载本地配置覆盖: {local_path}")

    # 3. 环境变量优先覆盖
    config = _apply_env_overrides(config)

    return config


def _build_legacy_llm_config(config: Dict[str, Any]) -> Dict[str, Any]:
    """构建向后兼容的 llm 配置（从 ai.models[default] 转换）。

    旧代码使用 config["llm"]["api_key"] 等方式访问，
    此函数将新的 ai 配置结构转换为旧的 llm 结构。
    """
    ai_config = config.get("ai", {})
    models = ai_config.get("models", {})
    scenarios = ai_config.get("scenarios", {})
    default_model_name = scenarios.get("default", "deepseek-chat")
    default_model = models.get(default_model_name, {})

    return {
        "api_key": ai_config.get("api_key") or default_model.get("api_key", ""),
        "base_url": default_model.get("base_url", "https://api.deepseek.com/v1"),
        "model": default_model.get("model_id", default_model_name),
        "temperature": default_model.get("temperature", 0.1),
        "timeout": default_model.get("timeout", 600),
    }


def load_config() -> Dict[str, Any]:
    """加载并返回配置字典。"""
    global _CONFIG
    if _CONFIG is None:
        _CONFIG = _load()
        # 添加向后兼容的 llm 配置
        _CONFIG["llm"] = _build_legacy_llm_config(_CONFIG)
        logger.info("配置加载完成")
    return _CONFIG


def get_config() -> Dict[str, Any]:
    """获取全局配置实例（单例）。"""
    return load_config()


def get_ai_config() -> Dict[str, Any]:
    """获取 AI 配置部分。"""
    config = get_config()
    return config.get("ai", {})


def get_model_config(model_name: str) -> Optional[Dict[str, Any]]:
    """获取指定模型的配置。

    Args:
        model_name: 模型名称（如 "deepseek-chat", "gpt-4o"）

    Returns:
        模型配置字典，如果不存在返回 None
    """
    ai_config = get_ai_config()
    models = ai_config.get("models", {})
    return models.get(model_name)


def get_model_for_scenario(scenario: str) -> Dict[str, Any]:
    """获取指定场景对应的模型配置。

    Args:
        scenario: 场景名称（如 "intervention_detection", "element_location"）

    Returns:
        模型配置字典，包含 provider, model_id, temperature 等
    """
    ai_config = get_ai_config()
    scenarios = ai_config.get("scenarios", {})
    models = ai_config.get("models", {})

    # 获取场景对应的模型名称
    model_name = scenarios.get(scenario)
    if not model_name:
        # 尝试使用默认模型
        model_name = scenarios.get("default")
        logger.debug(f"场景 '{scenario}' 未配置，使用默认模型: {model_name}")

    if not model_name:
        logger.warning("未找到默认模型配置，返回空配置")
        return {}

    # 获取模型配置
    model_config = models.get(model_name, {})
    if not model_config:
        logger.warning(f"模型 '{model_name}' 配置不存在")
        return {"model_id": model_name}

    # 返回配置，包含模型名称
    result = model_config.copy()
    result["model"] = result.get("model_id", model_name)
    return result


def get_server_config() -> Dict[str, Any]:
    """获取服务器配置。"""
    config = get_config()
    return config.get("server", {"host": "0.0.0.0", "port": 8000})


def get_browser_config() -> Dict[str, Any]:
    """获取浏览器配置。"""
    config = get_config()
    return config.get("browser", {"cdp_url": "http://localhost:9222"})


def get_logging_config() -> Dict[str, Any]:
    """获取日志配置。"""
    config = get_config()
    return config.get("logging", {"level": "INFO"})


def reload_config() -> Dict[str, Any]:
    """重新加载配置。"""
    global _CONFIG
    _CONFIG = None
    logger.info("配置已重置，将在下次访问时重新加载")
    return load_config()


def setup_logging(level: str = None, log_file: str = None) -> None:
    """配置日志系统。

    Args:
        level: 日志级别（DEBUG/INFO/WARNING/ERROR），默认从配置读取
        log_file: 日志文件路径（可选）
    """
    config = get_config()
    logging_config = config.get("logging", {})

    log_level = level or logging_config.get("level", "INFO")
    log_format = logging_config.get(
        "format", "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )

    handlers = [logging.StreamHandler()]

    if log_file:
        from logging.handlers import RotatingFileHandler

        file_handler = RotatingFileHandler(
            log_file, maxBytes=10 * 1024 * 1024, backupCount=5, encoding="utf-8"
        )
        file_handler.setFormatter(logging.Formatter(log_format))
        handlers.append(file_handler)

    logging.basicConfig(
        level=getattr(logging, log_level.upper(), logging.INFO),
        format=log_format,
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=handlers,
        force=True,
    )

    logger.info(f"日志系统已配置: level={log_level}")
