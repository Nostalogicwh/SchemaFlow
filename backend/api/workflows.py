"""工作流 CRUD API。"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent))

from storage.file_storage import JSONFileStorage
from repository.base import ExecutionRepository
from dependencies import get_storage, get_execution_repo

router = APIRouter(prefix="/api", tags=["workflows"])


@router.get("/workflows")
async def list_workflows(
    skip: int = 0,
    limit: int = 100,
    storage: JSONFileStorage = Depends(get_storage)
) -> List[Dict[str, Any]]:
    """获取工作流列表。

    Args:
        skip: 跳过的数量
        limit: 返回的数量限制
        storage: 存储实例

    Returns:
        工作流列表
    """
    return await storage.list_workflows(skip=skip, limit=limit)


@router.get("/workflows/{workflow_id}")
async def get_workflow(
    workflow_id: str,
    storage: JSONFileStorage = Depends(get_storage)
) -> Dict[str, Any]:
    """获取工作流详情。

    Args:
        workflow_id: 工作流 ID
        storage: 存储实例

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
async def create_workflow(
    workflow: Dict[str, Any],
    storage: JSONFileStorage = Depends(get_storage)
) -> Dict[str, Any]:
    """创建工作流。

    Args:
        workflow: 工作流数据
        storage: 存储实例

    Returns:
        创建的工作流（包含 ID）
    """
    workflow_id = await storage.save_workflow(workflow)
    return await storage.get_workflow(workflow_id)


@router.put("/workflows/{workflow_id}")
async def update_workflow(
    workflow_id: str,
    workflow: Dict[str, Any],
    storage: JSONFileStorage = Depends(get_storage)
) -> Dict[str, Any]:
    """更新工作流。

    Args:
        workflow_id: 工作流 ID
        workflow: 工作流数据
        storage: 存储实例

    Returns:
        更新后的工作流

    Raises:
        HTTPException: 工作流不存在
    """
    workflow["id"] = workflow_id
    await storage.save_workflow(workflow)
    return await storage.get_workflow(workflow_id)


@router.delete("/workflows/{workflow_id}")
async def delete_workflow(
    workflow_id: str,
    storage: JSONFileStorage = Depends(get_storage)
) -> Dict[str, Any]:
    """删除工作流。

    Args:
        workflow_id: 工作流 ID
        storage: 存储实例

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
async def get_last_execution(
    workflow_id: str,
    repo: ExecutionRepository = Depends(get_execution_repo)
) -> Dict[str, Any]:
    """获取工作流最近一次执行记录。

    Args:
        workflow_id: 工作流 ID
        repo: 执行记录仓储

    Returns:
        最近一次执行记录，不存在则返回 null
    """
    record = await repo.get_latest_execution(workflow_id)
    if record is None:
        return {"execution": None}
    return {"execution": record}
