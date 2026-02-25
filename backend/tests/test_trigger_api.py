"""API 触发端点测试"""

import pytest
from httpx import AsyncClient


class TestTriggerAPI:
    """API 触发端点测试"""

    async def test_trigger_workflow_missing_api_key(
        self, async_client: AsyncClient, test_workflow
    ):
        """缺少 API Key 应返回 401"""
        response = await async_client.post(
            f"/api/trigger/{test_workflow['id']}",
            json={"variables": {}, "headless": True},
        )
        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "UNAUTHORIZED"

    async def test_trigger_workflow_invalid_api_key(
        self, async_client: AsyncClient, test_workflow
    ):
        """无效 API Key 应返回 401"""
        response = await async_client.post(
            f"/api/trigger/{test_workflow['id']}",
            headers={"X-API-Key": "invalid_key"},
            json={"variables": {}, "headless": True},
        )
        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "INVALID_API_KEY"

    async def test_trigger_workflow_not_found(
        self, async_client: AsyncClient, api_key: str
    ):
        """工作流不存在应返回 404"""
        response = await async_client.post(
            "/api/trigger/non-existent-id",
            headers={"X-API-Key": api_key},
            json={"variables": {}, "headless": True},
        )
        assert response.status_code == 404
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "WORKFLOW_NOT_FOUND"

    async def test_get_result_running_status(
        self, async_client: AsyncClient, api_key: str
    ):
        """执行 ID 不存在应返回 running 状态（正在执行或未找到）"""
        response = await async_client.get(
            "/api/trigger/non-existent-execution/result",
            headers={"X-API-Key": api_key},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["status"] in ["running", "unknown"]

    async def test_api_key_status_valid(self, async_client: AsyncClient, api_key: str):
        """有效 API Key 状态检查"""
        response = await async_client.get(
            "/api/trigger/api-key/status", headers={"X-API-Key": api_key}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["configured"] is True

    async def test_api_key_status_invalid(self, async_client: AsyncClient):
        """无效 API Key 状态检查应返回 401"""
        response = await async_client.get(
            "/api/trigger/api-key/status", headers={"X-API-Key": "invalid_key"}
        )
        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False
