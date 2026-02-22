"""统一配置管理 - 加载 settings.toml，支持 settings.local.toml 覆盖和环境变量优先。"""

import logging
import logging.handlers
import os
import sys
from pathlib import Path

try:
    import tomllib  # Python 3.11+
except ModuleNotFoundError:
    try:
        import tomli as tomllib  # Python 3.9/3.10
    except ModuleNotFoundError:
        print("错误: 未找到 TOML 解析库", file=sys.stderr)
        print(f"当前 Python 版本: {sys.version}", file=sys.stderr)
        print("", file=sys.stderr)
        print("请确保在虚拟环境中运行后端:", file=sys.stderr)
        print(
            "  cd backend && source .venv/bin/activate && python main.py",
            file=sys.stderr,
        )
        print("", file=sys.stderr)
        print("或者使用启动脚本:", file=sys.stderr)
        print("  cd backend && bash start.sh", file=sys.stderr)
        print("", file=sys.stderr)
        print("如果虚拟环境不存在，请先运行:", file=sys.stderr)
        print("  cd backend && bash setup.sh", file=sys.stderr)
        sys.exit(1)

_BASE_DIR = Path(__file__).parent
_settings: dict = None


def _deep_merge(base: dict, override: dict) -> dict:
    """深度合并两个字典，override 覆盖 base。"""
    merged = base.copy()
    for key, value in override.items():
        if key in merged and isinstance(merged[key], dict) and isinstance(value, dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def _load() -> dict:
    """加载配置文件并应用环境变量覆盖。"""
    # 1. 加载默认配置
    default_path = _BASE_DIR / "settings.toml"
    with open(default_path, "rb") as f:
        settings = tomllib.load(f)

    # 2. 加载本地覆盖（可选）
    local_path = _BASE_DIR / "settings.local.toml"
    if local_path.exists():
        with open(local_path, "rb") as f:
            local = tomllib.load(f)
        settings = _deep_merge(settings, local)

    # 3. 环境变量优先覆盖
    if os.environ.get("LLM_API_KEY"):
        settings.setdefault("llm", {})["api_key"] = os.environ["LLM_API_KEY"]
    if os.environ.get("LLM_BASE_URL"):
        settings.setdefault("llm", {})["base_url"] = os.environ["LLM_BASE_URL"]

    return settings


def get_settings() -> dict:
    """获取全局配置（单例，首次调用时加载）。"""
    global _settings
    if _settings is None:
        _settings = _load()
    return _settings


def init_ai_config():
    """初始化AI模型配置。

    在应用启动时调用，加载AI模型配置并验证。
    """
    try:
        from backend.config.ai_models import get_ai_config_manager

        # 获取配置管理器实例（会自动加载配置）
        config_manager = get_ai_config_manager()

        # 验证配置
        scenarios = config_manager.list_scenarios()
        logger.info(f"AI模型配置加载成功，已配置 {len(scenarios)} 个场景")

        # 打印各场景配置
        for scenario in scenarios:
            model_config = config_manager.get_model_for_scenario(scenario)
            logger.info(
                f"  - {scenario.value}: {model_config.provider}/{model_config.model}"
            )

        return config_manager
    except Exception as e:
        logger.warning(f"AI模型配置加载失败: {e}，将使用默认配置")
        return None


def setup_logging(
    level: str = "INFO",
    log_dir: Path = None,
    log_to_file: bool = True,
    log_to_console: bool = True,
) -> logging.Logger:
    """配置全局日志系统。

    配置日志同时输出到控制台和文件，支持日志轮转。

    Args:
        level: 日志级别 (DEBUG, INFO, WARNING, ERROR)
        log_dir: 日志文件保存目录
        log_to_file: 是否输出到文件
        log_to_console: 是否输出到控制台

    Returns:
        根日志记录器
    """
    # 获取根日志记录器
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, level.upper()))

    # 清除现有的处理器
    root_logger.handlers.clear()

    # 创建格式化器
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # 配置控制台输出
    if log_to_console:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.DEBUG)
        console_handler.setFormatter(formatter)
        root_logger.addHandler(console_handler)

    # 配置文件输出
    if log_to_file:
        if log_dir is None:
            log_dir = _BASE_DIR / "logs"
        log_dir.mkdir(parents=True, exist_ok=True)

        # 使用RotatingFileHandler进行日志轮转
        file_handler = logging.handlers.RotatingFileHandler(
            log_dir / "schemaflow.log",
            maxBytes=10 * 1024 * 1024,  # 10MB
            backupCount=5,
            encoding="utf-8",
        )
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)

        # 单独的错误日志文件
        error_handler = logging.handlers.RotatingFileHandler(
            log_dir / "schemaflow_error.log",
            maxBytes=10 * 1024 * 1024,  # 10MB
            backupCount=5,
            encoding="utf-8",
        )
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(formatter)
        root_logger.addHandler(error_handler)

    # 配置第三方库的日志级别
    logging.getLogger("uvicorn").setLevel(logging.INFO)
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)
    logging.getLogger("fastapi").setLevel(logging.WARNING)

    return root_logger
