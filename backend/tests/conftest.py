"""pytest配置和共享fixtures"""

import pytest
import sys
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


@pytest.fixture
def sample_workflow():
    """示例工作流数据"""
    return {"id": "test-workflow", "name": "测试工作流", "nodes": [], "edges": []}
