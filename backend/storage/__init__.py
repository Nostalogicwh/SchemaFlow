"""存储模块。"""
from .base import StorageBase
from .file_storage import JSONFileStorage

__all__ = ["StorageBase", "JSONFileStorage"]
