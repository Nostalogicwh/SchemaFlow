# V0.2.3 可执行计划 - Bug 修复

## 目标

修复 4 个阻碍 MVP 场景跑通的 bug，让 AI 编排 → 执行 → 查看结果的完整链路可用。

---

## 问题清单

| # | 问题 | 严重度 | 根因 |
|---|------|--------|------|
| 1 | LLM API 超时过短 | 中 | `ai_generate.py` 默认 60s，大模型响应慢时直接超时 |
| 2 | AI 编排缺少 start/end 节点 | 高 | Prompt 告诉 LLM "系统自动添加"，但后端没有注入逻辑 |
| 3 | 生成的工作流执行报错 | 高 | 缺少结构校验 + 前端未处理异常节点类型 |
| 4 | CDP 连接后登录态丢失 | 中 | CDP 页面复用逻辑可能未正确复用已有 context |

---

## 问题 1：LLM API 超时过短

### 根因分析

`backend/api/ai_generate.py:108` 从 `settings.toml` 读取 `timeout`，默认 60 秒。大模型（特别是 Kimi、DeepSeek 长输出场景）生成工作流 JSON 时响应较慢，60 秒内可能无法完成。

```python
# ai_generate.py:108
timeout = llm_cfg.get("timeout", 60)
```

### 解决方案

将默认超时调整为 120 秒。

### 涉及文件

| 文件 | 改动 |
|------|------|
| `backend/settings.toml` | `timeout = 60` → `timeout = 120` |
| `backend/api/ai_generate.py` | 默认兜底值也改为 120 |

### 实施步骤

1. 修改 `backend/settings.toml`:

```toml
[llm]
timeout = 120
```

2. 修改 `backend/api/ai_generate.py:108`:

```python
# 修改前
timeout = llm_cfg.get("timeout", 60)

# 修改后
timeout = llm_cfg.get("timeout", 120)
```

### 验证

- 配置一个响应较慢的模型，发送 AI 编排请求，确认不会在 60s 时超时断开

---

## 问题 2：AI 编排缺少 start/end 节点

### 根因分析

`backend/api/ai_generate.py:42` 的 system prompt 明确告诉 LLM：

```
5. 不要生成 start 和 end 节点，系统会自动添加
```

但 `generate_workflow` 函数（第 92-95 行）直接返回 LLM 生成的原始 nodes/edges，**没有任何注入 start/end 的逻辑**。

导致 AI 生成的工作流缺少起止节点，用户无法直接执行。

### 解决方案

在后端 `generate_workflow` 返回前，自动注入 start/end 节点及首尾 edge：

- 在 nodes 头部插入 `{"id": "start_1", "type": "start", "label": "开始", "config": {}}`
- 在 nodes 尾部插入 `{"id": "end_1", "type": "end", "label": "结束", "config": {}}`
- 在 edges 头部插入 `{"source": "start_1", "target": "<第一个节点的 id>"}`
- 在 edges 尾部插入 `{"source": "<最后一个节点的 id>", "target": "end_1"}`

### 涉及文件

| 文件 | 改动 |
|------|------|
| `backend/api/ai_generate.py` | `generate_workflow` 中添加 start/end 注入逻辑 |

### 实施步骤

在 `ai_generate.py` 的 `generate_workflow` 函数中，第 91 行解析成功后、第 92 行 return 前，添加注入逻辑：

```python
# 解析成功后，注入 start/end 节点
nodes = workflow_data.get("nodes", [])
edges = workflow_data.get("edges", [])

if nodes:
    # 注入 start 节点
    start_node = {"id": "start_1", "type": "start", "label": "开始", "config": {}}
    end_node = {"id": "end_1", "type": "end", "label": "结束", "config": {}}

    first_node_id = nodes[0]["id"]
    last_node_id = nodes[-1]["id"]

    nodes.insert(0, start_node)
    nodes.append(end_node)

    edges.insert(0, {"source": "start_1", "target": first_node_id})
    edges.append({"source": last_node_id, "target": "end_1"})

    workflow_data["nodes"] = nodes
    workflow_data["edges"] = edges
```

### 验证

- 通过 AI 编排生成工作流，检查画布上是否出现 start/end 节点
- 检查 start 节点连接到第一个业务节点，最后一个业务节点连接到 end

---

## 问题 3：生成的工作流执行报错

### 根因分析

多个环节缺少校验，导致无效的工作流数据进入执行引擎：

1. **LLM 可能生成未注册的节点类型** — `executor.py:226` 遇到未知 type 时 raise ValueError
2. **LLM 生成的节点 config 字段可能与 schema 不匹配** — 多余或缺失字段
3. **前端 `handleAIGenerate` 不做任何校验** — 直接把 LLM 返回的 nodes 添加到画布
4. **LLM 返回的 JSON 格式可能不完全符合预期** — 比如 `id` 或 `type` 字段缺失

### 解决方案

在后端 `generate_workflow` 返回前增加结构校验：
- 校验每个节点的 `id` 和 `type` 字段存在
- 校验节点 `type` 在 ActionRegistry 中已注册
- 过滤掉无效节点及其关联 edge
- 校验 edge 的 source/target 引用的节点存在

### 涉及文件

| 文件 | 改动 |
|------|------|
| `backend/api/ai_generate.py` | 添加 `validate_workflow_data()` 校验函数 |

### 实施步骤

1. 在 `ai_generate.py` 中添加校验函数：

```python
def validate_workflow_data(workflow_data: Dict[str, Any]) -> Dict[str, Any]:
    """校验并清理 LLM 生成的工作流数据。

    - 过滤掉缺少 id/type 的节点
    - 过滤掉 type 未注册的节点（start/end 除外）
    - 过滤掉引用了不存在节点的 edge
    """
    registered_types = {s["name"] for s in registry.get_all_schemas()}
    # start/end 不在 action schema 中但合法
    registered_types.update({"start", "end"})

    nodes = workflow_data.get("nodes", [])
    edges = workflow_data.get("edges", [])

    # 过滤有效节点
    valid_nodes = []
    for node in nodes:
        if not node.get("id") or not node.get("type"):
            logger.warning("过滤无效节点（缺少 id 或 type）: %s", node)
            continue
        if node["type"] not in registered_types:
            logger.warning("过滤未注册节点类型: %s", node["type"])
            continue
        valid_nodes.append(node)

    # 过滤有效 edge
    valid_node_ids = {n["id"] for n in valid_nodes}
    valid_edges = []
    for edge in edges:
        if edge.get("source") in valid_node_ids and edge.get("target") in valid_node_ids:
            valid_edges.append(edge)
        else:
            logger.warning("过滤无效连线: %s -> %s", edge.get("source"), edge.get("target"))

    return {"nodes": valid_nodes, "edges": valid_edges}
```

2. 在 `generate_workflow` 中，注入 start/end 之后调用：

```python
workflow_data = validate_workflow_data(workflow_data)
```

### 验证

- 模拟 LLM 返回包含未知节点类型的响应，确认被过滤而非报错
- 确认过滤后 edge 的一致性（不引用已被过滤的节点）
- 正常 AI 编排生成后能直接执行成功

---

## 问题 4：CDP 连接后登录态丢失

### 根因分析

`executor.py:139-161` 的 CDP 连接逻辑：

```python
context.browser = await self.playwright.chromium.connect_over_cdp(cdp_url)
default_context = context.browser.contexts[0]
existing_pages = default_context.pages
```

可能的问题：
1. `connect_over_cdp` 返回的 `contexts[0]` 可能不是用户的默认浏览器 context
2. 用户启动 Chrome 时未指定 `--user-data-dir`，导致用空白 profile 启动
3. 页面复用逻辑找到的 page 可能已导航离开登录态页面
4. `open_tab_action` 中创建新页面时可能不在同一个 context 下

### 排查步骤

需要逐步排查确认具体原因：

**步骤 A：确认 Chrome 启动参数**

用户启动 Chrome 时必须同时指定 debugging port 和 user data dir：

```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/Library/Application Support/Google/Chrome"
```

如果不指定 `--user-data-dir`，Chrome 会以临时 profile 启动，不包含任何登录态。

**步骤 B：添加调试日志**

在 `executor.py` CDP 连接后添加详细日志：

```python
context.browser = await self.playwright.chromium.connect_over_cdp(cdp_url)
await context.log("info", f"CDP contexts 数量: {len(context.browser.contexts)}")
default_context = context.browser.contexts[0]
existing_pages = default_context.pages
await context.log("info", f"已有页面数量: {len(existing_pages)}")
for i, p in enumerate(existing_pages):
    await context.log("info", f"  页面 {i}: {p.url}")
```

**步骤 C：确认 open_tab 行为**

检查 `browser.py` 中 `open_tab_action` 是否在正确的 context 下操作页面。如果它调用了 `context.browser.new_page()`（浏览器级别）而非 `default_context.new_page()`（context 级别），可能导致新页面在不同 context 中，丢失 cookie。

### 涉及文件

| 文件 | 改动 |
|------|------|
| `backend/engine/executor.py` | 添加 CDP 调试日志 |
| 文档（README 或 CLAUDE.md） | 补充 Chrome CDP 启动参数说明 |

### 实施步骤

1. 在 `executor.py:143` CDP 连接成功后，添加调试日志（见步骤 B）
2. 在文档中补充 Chrome 正确启动方式
3. 根据实际排查结果修复（可能是启动参数问题，可能是 context 混用问题）

### 验证

1. 用正确参数启动 Chrome 并登录目标网站
2. 执行工作流，检查日志中 CDP contexts 和 pages 信息
3. 确认工作流在已登录的页面上操作

---

## 实施顺序

| 阶段 | 任务 | 依赖 |
|------|------|------|
| P0 | 问题 1：LLM 超时调整 | 无 |
| P1 | 问题 2：注入 start/end 节点 | 无 |
| P2 | 问题 3：工作流结构校验 | P1（校验需在注入之后） |
| P3 | 问题 4：CDP 登录态排查 | 无 |

每阶段完成后运行提交前验证。

---

## 验证清单

1. AI 编排生成工作流，画布上自动出现 start/end 节点及正确连线
2. 生成的工作流点击执行不报错，能正常走完全部节点
3. 使用慢速模型（或大 prompt）生成工作流，60-120 秒内不超时
4. CDP 连接后能复用已登录的页面
5. 运行提交前验证脚本全部通过
