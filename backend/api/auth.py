"""API Key 管理模块。

提供全局 API Key 的生成、存储和校验功能。
API Key 存储在 data/api_keys.json 文件中。
"""

import hashlib
import secrets
import json
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime


def get_api_keys_file() -> Path:
    """获取 API Key 存储文件路径。"""
    # 使用相对于后端根目录的 data 目录
    data_dir = Path(__file__).parent.parent / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir / "api_keys.json"


def load_api_keys() -> Dict[str, Any]:
    """加载所有 API Keys。"""
    file_path = get_api_keys_file()
    if not file_path.exists():
        return {}

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return {}


def save_api_keys(keys: Dict[str, Any]) -> None:
    """保存 API Keys。"""
    file_path = get_api_keys_file()
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(keys, f, indent=2, ensure_ascii=False)


def hash_api_key(key: str) -> str:
    """对 API Key 进行哈希。"""
    return hashlib.sha256(key.encode()).hexdigest()


def generate_api_key() -> str:
    """生成新的 API Key。

    Returns:
        生成的 API Key（原始字符串，只显示一次）
    """
    # 生成 32 字节的随机字符串
    key = "sf_" + secrets.token_urlsafe(32)
    return key


def create_api_key(name: str = "default") -> str:
    """创建新的 API Key。

    Args:
        name: API Key 名称标识

    Returns:
        生成的 API Key（原始字符串，只显示一次）
    """
    key = generate_api_key()
    key_hash = hash_api_key(key)

    keys = load_api_keys()
    keys[key_hash] = {
        "name": name,
        "created_at": datetime.now().isoformat(),
        "is_active": True,
    }
    save_api_keys(keys)

    return key


def verify_api_key(key: str) -> bool:
    """验证 API Key 是否有效。

    Args:
        key: API Key 字符串

    Returns:
        是否有效
    """
    if not key:
        return False

    key_hash = hash_api_key(key)
    keys = load_api_keys()

    if key_hash not in keys:
        return False

    key_data = keys[key_hash]
    return key_data.get("is_active", True)


def get_active_api_key() -> Optional[str]:
    """获取当前有效的 API Key（用于前端显示）。

    返回存储中第一个 active 的 key 的 hash（不是原始 key）。

    Returns:
        API Key hash 或 None
    """
    keys = load_api_keys()
    for key_hash, data in keys.items():
        if data.get("is_active", True):
            return key_hash[:16] + "..."  # 只显示部分 hash
    return None


def revoke_api_key(key_hash: str) -> bool:
    """吊销 API Key。

    Args:
        key_hash: API Key 的哈希值

    Returns:
        是否成功吊销
    """
    keys = load_api_keys()
    if key_hash in keys:
        keys[key_hash]["is_active"] = False
        save_api_keys(keys)
        return True
    return False


def list_api_keys() -> Dict[str, Any]:
    """列出所有 API Keys（不包含原始 key）。

    Returns:
        API Key 列表
    """
    return load_api_keys()


def get_or_create_default_key() -> str:
    """获取或创建默认的 API Key。

    如果没有活跃的 API Key，则创建一个新的。

    Returns:
        API Key（如果是新创建的，返回原始 key；否则返回 hash）
    """
    keys = load_api_keys()

    # 查找活跃的 key
    for key_hash, data in keys.items():
        if data.get("is_active", True):
            return key_hash[:16] + "..."

    # 没有活跃的 key，创建一个新的
    return create_api_key("default")
