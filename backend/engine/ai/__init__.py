"""AI模块 - 提供AI客户端、元素定位、干预检测功能"""

from .client import AIClient, AIClientError, get_ai_client
from .locator import (
    HybridElementLocator,
    AITargetLocator,
    LocationResult,
    AccessibleNode,
    debug_locator,
    generate_selector_key,
    locate_with_ai,
    wait_for_page_stability,
    extract_interactive_elements,
    build_ai_prompt,
    parse_ai_response,
    verify_selector,
    try_fallback_strategies,
    take_debug_screenshot,
)
from .intervention import (
    AIInterventionDetector,
    InterventionType,
    get_detector,
    detect_intervention,
)

__all__ = [
    "AIClient",
    "AIClientError",
    "get_ai_client",
    "HybridElementLocator",
    "AITargetLocator",
    "LocationResult",
    "AccessibleNode",
    "debug_locator",
    "generate_selector_key",
    "locate_with_ai",
    "wait_for_page_stability",
    "extract_interactive_elements",
    "build_ai_prompt",
    "parse_ai_response",
    "verify_selector",
    "try_fallback_strategies",
    "take_debug_screenshot",
    "AIInterventionDetector",
    "InterventionType",
    "get_detector",
    "detect_intervention",
]
