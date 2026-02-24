"""自定义异常层级。"""


class SchemaFlowError(Exception):
    """SchemaFlow 基础异常。"""
    pass


class NodeExecutionError(SchemaFlowError):
    """节点执行错误。"""

    def __init__(self, node_id: str, node_type: str, message: str):
        self.node_id = node_id
        self.node_type = node_type
        super().__init__(f"节点 {node_id}({node_type}) 执行失败: {message}")


class BrowserConnectionError(SchemaFlowError):
    """浏览器连接错误。"""
    pass


class ElementNotFoundError(SchemaFlowError):
    """元素定位失败。"""

    def __init__(self, selector: str = None, ai_target: str = None):
        self.selector = selector
        self.ai_target = ai_target
        desc = selector or ai_target or "未知元素"
        super().__init__(f"无法定位元素: {desc}")


class WorkflowValidationError(SchemaFlowError):
    """工作流校验错误。"""
    pass


class VariableResolutionError(SchemaFlowError):
    """变量解析错误。"""

    def __init__(self, variable_name: str):
        self.variable_name = variable_name
        super().__init__(f"变量未定义: {variable_name}")
