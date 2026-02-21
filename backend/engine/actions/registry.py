"""动作注册表 - 管理所有工作流节点。"""
from typing import Dict, Callable, Any, List
from pydantic import BaseModel


class ActionMetadata(BaseModel):
    """节点元数据模型。"""

    name: str                    # 节点唯一标识
    label: str                   # 前端显示标签
    description: str             # 功能描述
    category: str                # 分类: browser, data, control, ai, base
    parameters: Dict[str, Any]   # JSON Schema 定义参数
    inputs: List[str] = []      # 输入端口定义
    outputs: List[str] = []     # 输出端口定义


class ActionRegistry:
    """动作注册中心。

    管理所有可用的节点类型，提供注册、查询和执行函数获取功能。
    """

    def __init__(self):
        """初始化注册表。"""
        self._actions: Dict[str, Dict[str, Any]] = {}

    def register(self, metadata: ActionMetadata, execute_func: Callable):
        """注册一个动作。

        Args:
            metadata: 节点元数据
            execute_func: 执行函数
        """
        self._actions[metadata.name] = {
            "metadata": metadata,
            "execute": execute_func
        }

    def get(self, name: str) -> Dict[str, Any] | None:
        """获取动作定义。

        Args:
            name: 节点类型名称

        Returns:
            动作定义字典，不存在则返回 None
        """
        return self._actions.get(name)

    def list_all(self) -> List[Dict[str, Any]]:
        """获取所有动作的元数据（供前端渲染工具栏）。

        Returns:
            元数据列表
        """
        return [action["metadata"].model_dump() for action in self._actions.values()]

    def get_all_schemas(self) -> List[Dict[str, Any]]:
        """导出所有 action 的精简 schema（供 LLM 生成工作流使用）。

        Returns:
            包含 name、label、description、category、parameters 的列表
        """
        return [
            {
                "name": action["metadata"].name,
                "label": action["metadata"].label,
                "description": action["metadata"].description,
                "category": action["metadata"].category,
                "parameters": action["metadata"].parameters,
            }
            for action in self._actions.values()
            if action["metadata"].category != "base"  # 排除 start/end
        ]

    def get_execute_func(self, name: str) -> Callable:
        """获取执行函数。

        Args:
            name: 节点类型名称

        Returns:
            执行函数

        Raises:
            ValueError: 节点不存在
        """
        action = self._actions.get(name)
        if action:
            return action["execute"]
        raise ValueError(f"动作类型 {name} 未注册")


# 全局注册实例
registry = ActionRegistry()


def register_action(
    name: str,
    label: str,
    description: str,
    category: str,
    parameters: Dict[str, Any],
    inputs: List[str] = None,
    outputs: List[str] = None
):
    """动作注册装饰器。

    Args:
        name: 节点唯一标识
        label: 前端显示标签
        description: 功能描述
        category: 分类
        parameters: 参数 JSON Schema
        inputs: 输入端口定义
        outputs: 输出端口定义

    Returns:
        装饰器函数
    """
    metadata = ActionMetadata(
        name=name,
        label=label,
        description=description,
        category=category,
        parameters=parameters,
        inputs=inputs or [],
        outputs=outputs or []
    )

    def decorator(func):
        """装饰器函数。"""
        registry.register(metadata, func)
        return func

    return decorator
