"""执行控制 API。"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import Dict, Any
import asyncio
import uuid
import sys
from pathlib import Path

# 添加父目录到路径以导入模块
sys.path.append(str(Path(__file__).parent.parent))

from engine.executor import WorkflowExecutor
from api.websocket import manager

router = APIRouter(prefix="/api", tags=["execution"])

# 全局执行器实例
executor = None


def get_executor() -> WorkflowExecutor:
    """获取执行器实例（依赖注入）。

    Returns:
        WorkflowExecutor 实例
    """
    global executor
    if executor is None:
        executor = WorkflowExecutor()
    return executor


@router.websocket("/ws/execution/{execution_id}")
async def execution_websocket(
    execution_id: str,
    websocket: WebSocket,
):
    """执行 WebSocket 连接。

    Args:
        execution_id: 执行 ID
        websocket: WebSocket 连接
    """
    await manager.connect(execution_id, websocket)

    try:
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type")

            if message_type == "start_execution":
                # 启动工作流执行
                workflow_id = data.get("workflow_id")
                mode = data.get("mode", "headless")  # headless | headed
                headless = mode != "headed"
                if workflow_id:
                    from storage.file_storage import JSONFileStorage
                    storage = JSONFileStorage()
                    workflow = await storage.get_workflow(workflow_id)

                    if workflow:
                        bg_executor = get_executor()
                        # 使用 asyncio.create_task 替代 BackgroundTasks
                        asyncio.create_task(
                            bg_executor.execute(
                                workflow,
                                websocket,
                                execution_id=execution_id,
                                headless=headless
                            )
                        )
                    else:
                        await websocket.send_json({
                            "type": "error",
                            "message": f"工作流 {workflow_id} 不存在"
                        })

            elif message_type == "user_input_response":
                # 用户输入响应
                action = data.get("action", "continue")
                bg_executor = get_executor()
                if action == "cancel":
                    await bg_executor.stop(execution_id)
                else:
                    await bg_executor.respond_user_input(execution_id, action)

            elif message_type == "stop_execution":
                # 停止执行
                bg_executor = get_executor()
                await bg_executor.stop(execution_id)

    except WebSocketDisconnect:
        manager.disconnect(execution_id)
    except Exception as e:
        try:
            await websocket.send_json({
                "type": "error",
                "message": str(e)
            })
        except Exception:
            pass
    finally:
        manager.disconnect(execution_id)


@router.post("/workflows/{workflow_id}/execute")
async def execute_workflow(
    workflow_id: str,
    executor: WorkflowExecutor = Depends(get_executor)
):
    """启动工作流执行（返回 execution_id）。

    Args:
        workflow_id: 工作流 ID
        executor: 执行器实例

    Returns:
        包含 execution_id 的响应
    """
    execution_id = str(uuid.uuid4())

    return {
        "execution_id": execution_id,
        "workflow_id": workflow_id,
        "status": "pending",
        "ws_url": f"ws://localhost:8000/api/ws/execution/{execution_id}"
    }


@router.post("/executions/{execution_id}/stop")
async def stop_execution(
    execution_id: str,
    executor: WorkflowExecutor = Depends(get_executor)
):
    """停止执行。

    Args:
        execution_id: 执行 ID
        executor: 执行器实例

    Returns:
        停止结果
    """
    await executor.stop(execution_id)
    return {"success": True, "execution_id": execution_id}


@router.get("/executions/{execution_id}/status")
async def get_execution_status(
    execution_id: str,
    executor: WorkflowExecutor = Depends(get_executor)
):
    """获取执行状态。

    Args:
        execution_id: 执行 ID
        executor: 执行器实例

    Returns:
        执行状态
    """
    context = executor.get_context(execution_id)
    if context is None:
        return {"execution_id": execution_id, "status": "not_found"}

    return {
        "execution_id": execution_id,
        "workflow_id": context.workflow_id,
        "status": context.status.value,
        "current_node_id": context.current_node_id,
        "start_time": context.start_time.isoformat() if context.start_time else None,
        "end_time": context.end_time.isoformat() if context.end_time else None,
        "error": context.error
    }
