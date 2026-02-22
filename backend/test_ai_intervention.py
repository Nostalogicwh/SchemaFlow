"""
AI干预功能验证脚本

验证内容:
1. 所有非base节点都包含enable_ai_intervention配置
2. AI干预检测器能正确导入和初始化
3. WebSocket消息类型包含AI_INTERVENTION_REQUIRED
4. 执行器能正确导入并包含_check_ai_intervention方法
"""

import sys
import asyncio
from pathlib import Path

# 添加backend到路径
sys.path.insert(0, str(Path(__file__).parent))


def test_node_schemas():
    """测试所有非base节点都包含AI干预配置"""
    print("测试1: 验证节点Schema包含AI干预配置...")

    # 导入所有action模块触发注册
    from engine.actions import base
    from engine.actions import browser
    from engine.actions import control
    from engine.actions import ai
    from engine.actions import data
    from engine.actions import registry

    schemas = registry.get_all_schemas()
    all_ok = True

    for schema in schemas:
        props = schema.get("parameters", {}).get("properties", {})
        if "enable_ai_intervention" not in props:
            print(f"  ✗ 节点 {schema['name']} 缺少AI干预配置")
            all_ok = False

    if all_ok:
        print(f"  ✓ 所有 {len(schemas)} 个非base节点都包含AI干预配置")

    return all_ok


def test_ai_intervention_detector():
    """测试AI干预检测器模块"""
    print("\n测试2: 验证AI干预检测器...")

    from engine.ai_intervention_detector import (
        AIInterventionDetector,
        InterventionType,
        detect_intervention,
        get_detector,
    )

    # 测试类和方法存在
    assert hasattr(AIInterventionDetector, "detect")
    assert hasattr(AIInterventionDetector, "_call_llm_for_detection")
    assert hasattr(AIInterventionDetector, "_parse_detection_result")

    # 测试干预类型常量
    assert InterventionType.LOGIN == "登录表单"
    assert InterventionType.CAPTCHA == "验证码"
    assert InterventionType.POPUP == "弹窗"
    assert InterventionType.SECURITY == "安全确认"
    assert InterventionType.UNKNOWN == "未知"
    assert InterventionType.NONE is None

    print("  ✓ AI干预检测器类和方法存在")
    print("  ✓ 干预类型常量定义正确")

    return True


def test_websocket_message_type():
    """测试WebSocket消息类型"""
    print("\n测试3: 验证WebSocket消息类型...")

    from engine.constants import WSMessageType

    assert hasattr(WSMessageType, "AI_INTERVENTION_REQUIRED")
    assert WSMessageType.AI_INTERVENTION_REQUIRED.value == "ai_intervention_required"

    print(
        f"  ✓ AI_INTERVENTION_REQUIRED 消息类型: {WSMessageType.AI_INTERVENTION_REQUIRED.value}"
    )

    return True


def test_executor():
    """测试执行器包含AI干预检查方法"""
    print("\n测试4: 验证执行器...")

    from engine.executor import WorkflowExecutor

    assert hasattr(WorkflowExecutor, "_check_ai_intervention")

    print("  ✓ WorkflowExecutor 包含 _check_ai_intervention 方法")

    return True


def test_registry():
    """测试注册表包含AI干预Schema"""
    print("\n测试5: 验证注册表...")

    from engine.actions.registry import AI_INTERVENTION_SCHEMA

    assert "enable_ai_intervention" in AI_INTERVENTION_SCHEMA
    schema = AI_INTERVENTION_SCHEMA["enable_ai_intervention"]
    assert schema["type"] == "boolean"
    assert "AI自动干预检测" in schema["description"]
    assert schema["default"] == False

    print("  ✓ AI_INTERVENTION_SCHEMA 定义正确")
    print(f"    - 字段: enable_ai_intervention")
    print(f"    - 类型: {schema['type']}")
    print(f"    - 默认值: {schema['default']}")
    print(f"    - 描述: {schema['description']}")

    return True


def main():
    """运行所有测试"""
    print("=" * 60)
    print("SchemaFlow AI干预功能验证")
    print("=" * 60)

    tests = [
        test_node_schemas,
        test_ai_intervention_detector,
        test_websocket_message_type,
        test_executor,
        test_registry,
    ]

    results = []
    for test in tests:
        try:
            result = test()
            results.append(result)
        except Exception as e:
            print(f"  ✗ 测试失败: {e}")
            results.append(False)

    print("\n" + "=" * 60)
    print(f"测试结果: {sum(results)}/{len(results)} 通过")
    print("=" * 60)

    if all(results):
        print("✓ 所有测试通过！")
        return 0
    else:
        print("✗ 部分测试失败")
        return 1


if __name__ == "__main__":
    exit(main())
