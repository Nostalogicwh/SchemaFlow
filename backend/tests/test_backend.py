#!/usr/bin/env python3
"""后端测试脚本 - 验证工作流执行流程。"""

import asyncio
import json
import httpx
import websockets


BASE_URL = "http://localhost:8000"
WS_URL = "ws://localhost:8000"


async def test_api():
    """测试 REST API。"""
    async with httpx.AsyncClient() as client:
        print("=" * 50)
        print("测试 REST API")
        print("=" * 50)

        # 1. 获取节点列表
        print("\n1. 获取节点列表...")
        resp = await client.get(f"{BASE_URL}/api/actions")
        actions = resp.json()
        print(f"   可用节点数: {len(actions)}")
        for action in actions[:3]:
            print(f"   - {action['name']}: {action['label']}")

        # 2. 创建测试工作流
        print("\n2. 创建测试工作流...")
        test_workflow = {
            "name": "测试工作流",
            "description": "简单的导航测试",
            "nodes": [
                {"id": "start_1", "type": "start", "config": {}},
                {
                    "id": "open_1",
                    "type": "open_tab",
                    "config": {"url": "https://www.baidu.com"},
                },
                {"id": "wait_1", "type": "wait", "config": {"seconds": 2}},
                {"id": "screenshot_1", "type": "screenshot", "config": {}},
                {"id": "end_1", "type": "end", "config": {}},
            ],
            "edges": [
                {"source": "start_1", "target": "open_1"},
                {"source": "open_1", "target": "wait_1"},
                {"source": "wait_1", "target": "screenshot_1"},
                {"source": "screenshot_1", "target": "end_1"},
            ],
        }
        resp = await client.post(f"{BASE_URL}/api/workflows", json=test_workflow)
        workflow = resp.json()
        workflow_id = workflow["id"]
        print(f"   创建成功，ID: {workflow_id}")

        # 3. 获取工作流列表
        print("\n3. 获取工作流列表...")
        resp = await client.get(f"{BASE_URL}/api/workflows")
        workflows = resp.json()
        print(f"   工作流数量: {len(workflows)}")

        # 4. 启动执行
        print("\n4. 启动执行...")
        resp = await client.post(f"{BASE_URL}/api/workflows/{workflow_id}/execute")
        exec_info = resp.json()
        execution_id = exec_info["execution_id"]
        print(f"   执行 ID: {execution_id}")
        print(f"   WebSocket URL: {exec_info['ws_url']}")

        return workflow_id, execution_id


async def test_websocket(workflow_id: str, execution_id: str):
    """测试 WebSocket 执行。"""
    print("\n" + "=" * 50)
    print("测试 WebSocket 执行")
    print("=" * 50)

    ws_url = f"{WS_URL}/api/ws/execution/{execution_id}"
    print(f"\n连接 WebSocket: {ws_url}")

    try:
        async with websockets.connect(ws_url) as ws:
            # 等待连接确认
            msg = await asyncio.wait_for(ws.recv(), timeout=5)
            data = json.loads(msg)
            print(f"收到: {data['type']}")

            # 发送开始执行命令
            print("\n发送 start_execution 命令...")
            await ws.send(
                json.dumps({"type": "start_execution", "workflow_id": workflow_id})
            )

            # 接收执行消息
            print("\n等待执行消息...")
            while True:
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=60)
                    data = json.loads(msg)
                    msg_type = data.get("type")

                    if msg_type == "execution_started":
                        print(f"✓ 执行开始，节点顺序: {data.get('node_order')}")
                    elif msg_type == "node_start":
                        print(
                            f"→ 节点开始: {data.get('node_id')} ({data.get('node_type')})"
                        )
                    elif msg_type == "node_complete":
                        print(f"✓ 节点完成: {data.get('node_id')}")
                    elif msg_type == "screenshot":
                        screenshot_len = len(data.get("data", ""))
                        print(f"📷 收到截图，大小: {screenshot_len} bytes")
                    elif msg_type == "log":
                        print(f"📝 日志: [{data.get('level')}] {data.get('message')}")
                    elif msg_type == "execution_complete":
                        print(f"\n✓ 执行完成！")
                        print(f"  成功: {data.get('success')}")
                        print(f"  耗时: {data.get('duration'):.2f}s")
                        break
                    elif msg_type == "error":
                        print(f"\n✗ 错误: {data.get('message')}")
                        break
                    else:
                        print(f"? 未知消息: {msg_type}")

                except asyncio.TimeoutError:
                    print("超时，停止等待")
                    break

    except Exception as e:
        print(f"WebSocket 错误: {e}")


async def cleanup(workflow_id: str):
    """清理测试数据。"""
    print("\n" + "=" * 50)
    print("清理测试数据")
    print("=" * 50)

    async with httpx.AsyncClient() as client:
        resp = await client.delete(f"{BASE_URL}/api/workflows/{workflow_id}")
        print(f"删除工作流 {workflow_id}: {resp.status_code}")


async def main():
    """主测试流程。"""
    print("\n" + "=" * 50)
    print("SchemaFlow 后端测试")
    print("=" * 50)
    print("\n请确保后端已启动: cd backend && python main.py\n")

    try:
        # 测试 API
        workflow_id, execution_id = await test_api()

        # 测试 WebSocket 执行
        await test_websocket(workflow_id, execution_id)

        # 清理
        await cleanup(workflow_id)

        print("\n" + "=" * 50)
        print("测试完成！")
        print("=" * 50)

    except httpx.ConnectError:
        print("\n✗ 无法连接到后端，请确保服务已启动")
    except Exception as e:
        print(f"\n✗ 测试失败: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
