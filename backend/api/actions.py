"""节点元数据 API。"""
from fastapi import APIRouter
import sys
from pathlib import Path

# 添加父目录到路径以导入模块
sys.path.append(str(Path(__file__).parent.parent))

from engine.actions import registry

router = APIRouter(prefix="/api", tags=["actions"])


@router.get("/actions")
async def list_actions():
    """获取所有可用节点的元数据。

    Returns:
        节点元数据列表
    """
    return registry.list_all()
