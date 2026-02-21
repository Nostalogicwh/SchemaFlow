"""AI 工作流生成 API - 基于自然语言描述生成工作流节点和连线。"""
import json
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import httpx

from engine.actions import registry
from config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["ai"])


class GenerateRequest(BaseModel):
    """工作流生成请求。"""
    prompt: str                          # 自然语言描述
    model: Optional[str] = None          # 模型（None 时使用配置文件中的值）
    existing_nodes: Optional[List[Dict[str, Any]]] = None  # 已有节点（用于追加编排）


class GenerateResponse(BaseModel):
    """工作流生成响应。"""
    nodes: List[Dict[str, Any]]          # 生成的节点列表
    edges: List[Dict[str, Any]]          # 生成的连线列表


def build_system_prompt(action_schemas: List[Dict[str, Any]]) -> str:
    """构造 system prompt，包含所有可用节点的描述和参数。"""
    return f"""你是一个工作流编排助手。根据用户的自然语言描述，生成工作流的节点列表和连线关系。

可用节点类型（JSON Schema 格式）：
{json.dumps(action_schemas, ensure_ascii=False, indent=2)}

规则：
1. 每个节点必须有唯一的 id（格式：node_类型_序号，如 node_navigate_1）
2. 节点的 config 必须符合该节点 parameters 中定义的字段
3. 连线的 source 和 target 必须是已定义的节点 id
4. 节点按执行顺序排列，连线表示执行依赖
5. 不要生成 start 和 end 节点，系统会自动添加
6. config 中的值如果需要引用上游节点的变量，使用 {{{{variable_name}}}} 语法

输出严格的 JSON 格式（不要包含 markdown 代码块标记）：
{{
  "nodes": [
    {{ "id": "node_xxx_1", "type": "action_name", "label": "节点显示名称", "config": {{...}} }}
  ],
  "edges": [
    {{ "source": "node_xxx_1", "target": "node_xxx_2" }}
  ]
}}"""


@router.post("/generate-workflow", response_model=GenerateResponse)
async def generate_workflow(request: GenerateRequest):
    """根据自然语言描述生成工作流。

    Args:
        request: 生成请求

    Returns:
        生成的节点和连线
    """
    # 获取所有可用 action 的 schema
    action_schemas = registry.get_all_schemas()
    if not action_schemas:
        raise HTTPException(status_code=500, detail="没有可用的节点类型")

    system_prompt = build_system_prompt(action_schemas)

    # 调用大模型
    try:
        logger.info("AI 生成工作流 - prompt: %s, model: %s", request.prompt, request.model)
        result = await call_llm(system_prompt, request.prompt, request.model)
        logger.info("LLM 响应长度: %d", len(result))
    except (httpx.HTTPStatusError, httpx.ConnectError, httpx.TimeoutException) as e:
        logger.exception("调用大模型失败")
        raise HTTPException(status_code=500, detail=f"调用大模型失败: {e}")

    # 解析响应
    try:
        workflow_data = parse_llm_response(result)
        logger.info("解析成功 - 节点: %d, 连线: %d",
                     len(workflow_data.get("nodes", [])),
                     len(workflow_data.get("edges", [])))
    except json.JSONDecodeError as e:
        logger.error("解析 LLM 响应失败 - 原始内容: %s", result[:500])
        raise HTTPException(status_code=500, detail=f"解析生成结果失败: {e}")

    # 校验并注入 start/end 节点
    workflow_data = validate_workflow_data(workflow_data)
    workflow_data = inject_start_end_nodes(workflow_data)

    return GenerateResponse(
        nodes=workflow_data.get("nodes", []),
        edges=workflow_data.get("edges", []),
    )


async def call_llm(system_prompt: str, user_prompt: str, model: str = None) -> str:
    """调用大模型 API（兼容 OpenAI 格式）。

    配置优先级：settings.toml < settings.local.toml < 环境变量
    """
    llm_cfg = get_settings()["llm"]
    api_key = llm_cfg.get("api_key", "")
    base_url = llm_cfg.get("base_url", "https://api.deepseek.com/v1")
    model = model or llm_cfg.get("model", "deepseek-chat")
    temperature = llm_cfg.get("temperature", 0.1)
    timeout = llm_cfg.get("timeout", 120)

    if not api_key:
        raise ValueError("未配置 LLM API Key（设置 LLM_API_KEY 环境变量或 settings.toml）")

    logger.info("调用 LLM - base_url: %s, model: %s", base_url, model)

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            f"{base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": temperature,
            },
        )
        logger.info("LLM HTTP 状态: %d", response.status_code)
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]


def parse_llm_response(content: str) -> Dict[str, Any]:
    """解析大模型返回的 JSON 内容。"""
    # 去除可能的 markdown 代码块标记
    text = content.strip()
    if text.startswith("```"):
        # 移除首行 ```json 和末尾 ```
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    return json.loads(text)


def validate_workflow_data(workflow_data: Dict[str, Any]) -> Dict[str, Any]:
    """校验并清理 LLM 生成的工作流数据。

    - 过滤掉缺少 id/type 的节点
    - 过滤掉 type 未注册的节点（start/end 除外）
    - 过滤掉引用了不存在节点的 edge
    """
    registered_types = {s["name"] for s in registry.get_all_schemas()}
    registered_types.update({"start", "end"})

    nodes = workflow_data.get("nodes", [])
    edges = workflow_data.get("edges", [])

    valid_nodes = []
    for node in nodes:
        if not node.get("id") or not node.get("type"):
            logger.warning("过滤无效节点（缺少 id 或 type）: %s", node)
            continue
        if node["type"] not in registered_types:
            logger.warning("过滤未注册节点类型: %s", node["type"])
            continue
        valid_nodes.append(node)

    valid_node_ids = {n["id"] for n in valid_nodes}
    valid_edges = []
    for edge in edges:
        if edge.get("source") in valid_node_ids and edge.get("target") in valid_node_ids:
            valid_edges.append(edge)
        else:
            logger.warning("过滤无效连线: %s -> %s", edge.get("source"), edge.get("target"))

    return {"nodes": valid_nodes, "edges": valid_edges}


def inject_start_end_nodes(workflow_data: Dict[str, Any]) -> Dict[str, Any]:
    """注入 start/end 节点及首尾连线。"""
    nodes = workflow_data.get("nodes", [])
    edges = workflow_data.get("edges", [])

    if not nodes:
        return workflow_data

    start_node = {"id": "start_1", "type": "start", "label": "开始", "config": {}}
    end_node = {"id": "end_1", "type": "end", "label": "结束", "config": {}}

    first_node_id = nodes[0]["id"]
    last_node_id = nodes[-1]["id"]

    nodes.insert(0, start_node)
    nodes.append(end_node)

    edges.insert(0, {"source": "start_1", "target": first_node_id})
    edges.append({"source": last_node_id, "target": "end_1"})

    return {"nodes": nodes, "edges": edges}
