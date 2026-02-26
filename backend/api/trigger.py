"""触发 API - 提供外部触发工作流的接口。

POST /api/trigger/{workflow_id} - 触发工作流执行
GET  /api/trigger/{execution_id}/result - 获取执行结果
"""

from fastapi import APIRouter, Header, Depends
from typing import Optional, Dict, Any
from pydantic import BaseModel

from .auth import verify_api_key
from .exceptions import APIException

router = APIRouter(prefix="/api/trigger", tags=["trigger"])


class TriggerRequest(BaseModel):
    """触发请求体。"""

    variables: Dict[str, Any] = {}
    headless: bool = True


class TriggerResponse(BaseModel):
    """触发响应。"""

    success: bool
    data: Dict[str, Any]


def verify_api_key_header(x_api_key: Optional[str] = Header(None)) -> str:
    """验证 API Key 的依赖函数。

    Args:
        x_api_key: 请求头中的 API Key

    Returns:
        验证通过的 API Key

    Raises:
        APIException: API Key 无效
    """
    if not x_api_key:
        raise APIException(
            status_code=401, code="UNAUTHORIZED", message="缺少 X-API-Key 请求头"
        )

    if not verify_api_key(x_api_key):
        raise APIException(
            status_code=401, code="INVALID_API_KEY", message="API Key 无效或已吊销"
        )

    return x_api_key


@router.post("/{workflow_id}", response_model=TriggerResponse)
async def trigger_workflow(
    workflow_id: str,
    request: TriggerRequest,
    api_key: str = Depends(verify_api_key_header),
):
    """触发工作流执行。

    Args:
        workflow_id: 工作流 ID
        request: 触发请求，包含变量和执行模式
        api_key: 验证通过的 API Key

    Returns:
        执行结果，包含 execution_id
    """
    from dependencies import get_storage
    from engine.executor import WorkflowExecutor
    from engine.context import ExecutionContext

    # 1. 获取工作流
    storage = get_storage()
    workflow = await storage.get_workflow(workflow_id)

    if not workflow:
        raise APIException(
            status_code=404,
            code="WORKFLOW_NOT_FOUND",
            message=f"工作流 {workflow_id} 不存在",
        )

    # 2. 创建执行上下文
    execution_id = f"trg_{workflow_id}_{int(__import__('time').time())}"

    context = ExecutionContext(
        workflow_id=workflow_id,
        execution_id=execution_id,
        variables=request.variables,
        headless=request.headless,
    )

    # 3. 启动执行（异步）
    executor = WorkflowExecutor()

    # 在后台执行工作流
    import asyncio

    asyncio.create_task(_execute_workflow_async(executor, context, workflow))

    return TriggerResponse(
        success=True,
        data={
            "execution_id": execution_id,
            "status": "started",
            "workflow_id": workflow_id,
        },
    )


async def _execute_workflow_async(
    executor: "WorkflowExecutor", context: "ExecutionContext", workflow: Dict[str, Any]
):
    """在后台异步执行工作流。

    Args:
        executor: 执行器
        context: 执行上下文
        workflow: 工作流配置
    """
    try:
        await executor.execute_workflow(workflow, context)
    except Exception as e:
        # 记录错误，但不抛出（因为这是后台任务）
        import logging

        logger = logging.getLogger(__name__)
        logger.error(f"触发执行失败: {e}")


@router.get("/{execution_id}/result")
async def get_execution_result(
    execution_id: str, api_key: str = Depends(verify_api_key_header)
):
    """获取执行结果。

    Args:
        execution_id: 执行 ID
        api_key: 验证通过的 API Key

    Returns:
        执行结果
    """
    from persistence import get_execution_repo

    repo = get_execution_repo()

    # 查询执行记录
    # 注意：这里假设执行记录已经保存到 repository
    # 实际实现可能需要从内存或缓存中查询正在进行的执行

    try:
        # 尝试从 repository 获取（已完成的执行）
        record = await repo.get_execution(execution_id)

        if record:
            return {
                "success": True,
                "data": {
                    "execution_id": execution_id,
                    "status": record.get("status", "unknown"),
                    "results": record.get("node_records", []),
                    "finished_at": record.get("finished_at"),
                },
            }
    except Exception:
        pass

    # 如果找不到，可能是正在执行中
    return {
        "success": True,
        "data": {
            "execution_id": execution_id,
            "status": "running",
            "message": "执行正在进行中，请稍后查询",
        },
    }


@router.get("/api-key/status")
async def get_api_key_status(api_key: str = Depends(verify_api_key_header)):
    """获取 API Key 状态。

    用于前端检查 API Key 是否已配置。

    Returns:
        API Key 状态
    """
    return {
        "success": True,
        "data": {
            "configured": True,
            "message": "API Key 已配置",
        },
    }
