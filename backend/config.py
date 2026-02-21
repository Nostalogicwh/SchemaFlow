"""统一配置管理 - 加载 settings.toml，支持 settings.local.toml 覆盖和环境变量优先。"""
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
        print("  cd backend && source .venv/bin/activate && python main.py", file=sys.stderr)
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
