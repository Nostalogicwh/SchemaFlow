"""pytest配置和共享fixtures"""

import pytest
import pytest_asyncio
import sys
from pathlib import Path
from httpx import AsyncClient, ASGITransport

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


@pytest.fixture
def sample_workflow():
    """示例工作流数据"""
    return {"id": "test-workflow", "name": "测试工作流", "nodes": [], "edges": []}


@pytest.fixture
def test_workflow():
    """用于测试的工作流数据"""
    return {
        "id": "test-trigger-workflow",
        "name": "触发测试工作流",
        "nodes": [
            {"id": "start_1", "type": "start", "config": {}},
            {"id": "end_1", "type": "end", "config": {}},
        ],
        "edges": [{"source": "start_1", "target": "end_1"}],
    }


@pytest.fixture(autouse=True, scope="function")
def setup_test_config(tmp_path):
    """设置测试配置和数据目录"""
    test_data_dir = tmp_path / "data"
    test_data_dir.mkdir(parents=True, exist_ok=True)

    from config import reload_config

    original_get_config = None

    def mock_get_config():
        from config import load_config

        config = load_config()
        config["storage"] = {"data_dir": str(test_data_dir)}
        return config

    import config

    original_get_config = config.get_config
    config.get_config = mock_get_config
    config.get_settings = mock_get_config

    reload_config()

    yield test_data_dir

    config.get_config = original_get_config
    config.get_settings = original_get_config
    reload_config()


@pytest.fixture
def api_key(setup_test_config):
    """获取有效的 API Key"""
    from api.auth import create_api_key, load_api_keys

    keys = load_api_keys()
    if keys:
        for key_hash, data in keys.items():
            if data.get("is_active", True):
                return key_hash

    key = create_api_key("test_key")
    return key


@pytest_asyncio.fixture
async def async_client():
    """异步 HTTP 客户端 fixture"""
    from main import app

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        yield client
