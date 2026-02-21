"""工作流 CRUD API。"""
from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
import sys
from pathlib import Path

# 添加父目录到路径以导入模块
sys.path.append(str(Path(__file__).parent.parent))

from storage.file_storage import JSONFileStorage
from repository import get_execution_repo

router = APIRouter(prefix="/api", tags=["workflows"])

# 初始化存储
storage = JSONFileStorage()


@router.get("/workflows")
async def list_workflows(skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """获取工作流列表。

    Args:
        skip: 跳过的数量
        limit: 返回的数量限制

    Returns:
        工作流列表
    """
    return await storage.list_workflows(skip=skip, limit=limit)


@router.get("/workflows/{workflow_id}")
async def get_workflow(workflow_id: str) -> Dict[str, Any]:
    """获取工作流详情。

    Args:
        workflow_id: 工作流 ID

    Returns:
        工作流详情

    Raises:
        HTTPException: 工作流不存在
    """
    workflow = await storage.get_workflow(workflow_id)
    if workflow is None:
        raise HTTPException(status_code=404, detail="工作流不存在")
    return workflow


@router.post("/workflows")
async def create_workflow(workflow: Dict[str, Any]) -> Dict[str, Any]:
    """创建工作流。

    Args:
        workflow: 工作流数据

    Returns:
        创建的工作流（包含 ID）
    """
    workflow_id = await storage.save_workflow(workflow)
    return await storage.get_workflow(workflow_id)


@router.put("/workflows/{workflow_id}")
async def update_workflow(workflow_id: str, workflow: Dict[str, Any]) -> Dict[str, Any]:
    """更新工作流。

    Args:
        workflow_id: 工作流 ID
        workflow: 工作流数据

    Returns:
        更新后的工作流

    Raises:
        HTTPException: 工作流不存在
    """
    # 确保原始 ID 不被覆盖
    workflow["id"] = workflow_id
    await storage.save_workflow(workflow)
    return await storage.get_workflow(workflow_id)


@router.delete("/workflows/{workflow_id}")
async def delete_workflow(workflow_id: str) -> Dict[str, Any]:
    """删除工作流。

    Args:
        workflow_id: 工作流 ID

    Returns:
        删除结果

    Raises:
        HTTPException: 工作流不存在
    """
    success = await storage.delete_workflow(workflow_id)
    if not success:
        raise HTTPException(status_code=404, detail="工作流不存在")
    return {"success": True, "workflow_id": workflow_id}


@router.get("/workflows/{workflow_id}/last-execution")
async def get_last_execution(workflow_id: str) -> Dict[str, Any]:
    """获取工作流最近一次执行记录。

    Args:
        workflow_id: 工作流 ID

    Returns:
        最近一次执行记录，不存在则返回 null
    """
    repo = get_execution_repo()
    record = await repo.get_latest_execution(workflow_id)
    if record is None:
        return {"execution": None}
    return {"execution": record}
