"""WebSocket 连接管理器。"""
from typing import Dict
from fastapi import WebSocket, WebSocketDisconnect


class ConnectionManager:
    """WebSocket 连接管理器。

    管理多个执行连接，处理连接和断开，实现消息发送和广播。
    """

    def __init__(self):
        """初始化连接管理器。"""
        # execution_id -> websocket
        self.exec_connections: Dict[str, WebSocket] = {}
        # execution_id -> 状态
        self.exec_statuses: Dict[str, Dict] = {}

    async def connect(self, execution_id: str, websocket: WebSocket):
        """建立连接。

        Args:
            execution_id: 执行 ID
            websocket: WebSocket 连接
        """
        await websocket.accept()
        self.exec_connections[execution_id] = websocket
        self.exec_statuses[execution_id] = {"status": "connected"}

        # 发送连接确认
        await self.send(execution_id, {
            "type": "connected",
            "execution_id": execution_id
        })

    def disconnect(self, execution_id: str):
        """断开连接。

        Args:
            execution_id: 执行 ID
        """
        if execution_id in self.exec_connections:
            del self.exec_connections[execution_id]
        if execution_id in self.exec_statuses:
            del self.exec_statuses[execution_id]

    async def send(self, execution_id: str, message: Dict):
        """发送消息到指定执行连接。

        Args:
            execution_id: 执行 ID
            message: 消息内容
        """
        if execution_id in self.exec_connections:
            try:
                await self.exec_connections[execution_id].send_json(message)
            except Exception:
                # 连接可能已断开
                self.disconnect(execution_id)

    async def broadcast(self, message: Dict):
        """广播消息到所有连接。

        Args:
            message: 消息内容
        """
        for execution_id, websocket in list(self.exec_connections.items()):
            try:
                await websocket.send_json(message)
            except Exception:
                self.disconnect(execution_id)

    def get_status(self, execution_id: str):
        """获取执行状态。

        Args:
            execution_id: 执行 ID

        Returns:
            执行状态，不存在则返回 None
        """
        return self.exec_statuses.get(execution_id)


# 全局连接管理器
manager = ConnectionManager()
