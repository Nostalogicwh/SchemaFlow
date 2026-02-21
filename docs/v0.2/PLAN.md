# V0.2 可执行计划

## 存在问题

1. 每次执行工作流，会打开两个新的浏览器窗口，需要排查；而且新打开的窗口没有原本的登录信息，导致部分需要登录的工作流无法执行
2. python执行需要使用venv虚拟环境
3. 工作流执行区分两种模式，一种是纯后台，只通过websocket传输执行截图和结果，一种是浏览器前台打开查看
4. 工作流执行情况需要按节点结构化记录展示
5. 工作流执行记录需要保存最近一条
6. AI节点移除，但是添加基于自然语言理解，新增、编排现有节点功能

---

## 问题 1：浏览器双开 & 登录态丢失

### 根因分析

- `WorkflowExecutor` 单例每次执行都调用 `async_playwright().start()` + `chromium.launch()`，创建全新浏览器进程
- `chromium.launch()` 启动无状态浏览器，无 Cookie/LocalStorage，登录态丢失

### 解决方案

通过 CDP（Chrome DevTools Protocol）连接用户本地已运行的浏览器，浏览器数据完全保留在客户端。

- 用户启动 Chrome 时附带 `--remote-debugging-port=9222`
- 后端通过 `playwright.chromium.connect_over_cdp()` 连接
- 降级：CDP 连接失败时回退为 `chromium.launch(headless=headless)`

### 涉及文件

| 文件 | 改动 |
|---|---|
| `backend/engine/executor.py` | 浏览器启动逻辑改为 CDP 优先 |
| `backend/engine/context.py` | browser 类型适配 |
| `backend/api/execution.py` | 可选 cdp_url 参数 |

### 实施步骤

1. `_run_workflow()` 中 CDP 优先连接，失败降级启动独立浏览器
2. `_cleanup()` 区分 CDP/独立模式：CDP 只关页面不关浏览器
3. WS 消息提示当前连接模式

---

## 问题 2：Python 虚拟环境

### 涉及文件

| 文件 | 改动 |
|---|---|
| `backend/setup.sh`（新建） | 创建 venv、安装依赖 |
| `backend/start.sh`（新建） | 激活 venv 启动后端 |
| `.gitignore` | 添加 `.venv/` |

---

## 问题 3：双模式执行（后台/前台）

### 解决方案

API 和 WS 协议增加 `mode` 参数：`headless`（后台）/ `headed`（前台）。

### 涉及文件

| 文件 | 改动 |
|---|---|
| `backend/api/execution.py` | mode 参数 |
| `backend/engine/executor.py` | headless 参数透传 |
| `frontend/src/api/index.ts` | mode 参数 |
| `frontend/src/App.tsx` | 模式切换 UI |

---

## 问题 4 & 5：结构化执行记录 & 持久化

### 解决方案

模仿数据库设计，创建独立 Repository 抽象层。当前 JSON 文件实现，预留数据库切换能力。

### 数据模型

**execution 主表** — `data/db/executions/{workflow_id}.json`（每个工作流只保留最新一条）

```json
{
    "execution_id": "exec_xxx",
    "workflow_id": "wf_xxx",
    "status": "completed",
    "mode": "headless",
    "started_at": "...",
    "finished_at": "...",
    "duration_ms": 30000,
    "node_records": [...]
}
```

**node_record**（内嵌在 execution 中）

```json
{
    "node_id": "node_1",
    "node_type": "navigate",
    "node_label": "打开百度",
    "status": "completed",
    "started_at": "...",
    "finished_at": "...",
    "duration_ms": 2000,
    "result": {},
    "error": null,
    "screenshot_base64": "...",
    "logs": [{"timestamp": "...", "level": "info", "message": "..."}]
}
```

### 涉及文件

| 文件 | 改动 |
|---|---|
| `backend/repository/base.py`（新建） | ExecutionRepository 抽象基类 |
| `backend/repository/json_repository.py`（新建） | JSON 文件实现 |
| `backend/repository/__init__.py`（新建） | 导出 + 工厂函数 |
| `backend/engine/context.py` | 新增 NodeExecutionRecord dataclass |
| `backend/engine/executor.py` | 节点执行记录填充 + 调用 repository 保存 |
| `backend/api/workflows.py` | `GET /api/workflows/{id}/last-execution` |
| `frontend/src/api/index.ts` | 获取最近执行记录 API |
| `frontend/src/components/ExecutionPanel/` | 按节点维度展示 |

---

## 问题 6：移除 AI 节点 + 自然语言编排

### 第一步：移除 AI 节点

| 文件 | 改动 |
|---|---|
| `backend/engine/actions/ai.py` | 删除或清空 |
| `frontend/src/components/FlowEditor/nodes/AINode.tsx` | 删除 |
| `frontend/src/components/FlowEditor/nodes/index.ts` | 移除 AINode 引用 |

### 第二步：自然语言编排

| 文件 | 改动 |
|---|---|
| `backend/api/ai_generate.py`（新建） | `POST /api/ai/generate-workflow` |
| `backend/engine/actions/registry.py` | `get_all_schemas()` 导出所有 action schema |
| `frontend/src/components/FlowEditor/panels/Toolbar.tsx` | AI 编排输入框 |
| `frontend/src/api/index.ts` | 对接新接口 |

---

## 实施顺序

| 阶段 | 任务 | 依赖 |
|---|---|---|
| P0 | 问题 2：venv 环境脚本 | 无 |
| P1 | 问题 1：CDP 浏览器连接 | 无 |
| P2 | 问题 3：双模式执行 | P1 |
| P3 | 问题 4+5：Repository + 结构化记录 + 持久化 | 无 |
| P4 | 问题 6a：移除 AI 节点 | 无 |
| P5 | 问题 6b：自然语言编排 | P4 |

按 P0 → P1 → P2 → P3 → P4 → P5 顺序执行，每阶段完成后运行提交前验证。

---

## 实施进度

分支：`dev/v0.2`，基于 `main` 创建。

| 阶段 | 状态 | 提交 | 说明 |
|---|---|---|---|
| P0 | ✅ 完成 | `ed69d56` | `backend/setup.sh`、`start.sh` 创建完成 |
| P1 | ✅ 完成 | `397754d` | `executor.py` 改为 CDP 优先连接，降级启动独立浏览器；`_cleanup()` 区分 CDP/独立模式 |
| P2 | ✅ 完成 | `0b78545` | 后端 `execute()` 增加 `headless` 参数，WS `start_execution` 携带 `mode`，前端增加模式切换下拉框 |
| P3 | ✅ 完成 | `2c3e2c7` | 新建 `backend/repository/`（抽象基类 + JSON 实现），`NodeExecutionRecord` dataclass，executor 执行后持久化到 `data/db/executions/`，新增 `GET /api/workflows/{id}/last-execution`，前端 ExecutionPanel 增加 Tab 切换（截图/节点记录/日志） |
| P4 | ✅ 完成 | `7ab08c5` | 删除 `ai.py`、`AINode.tsx`，清理 `nodeTypes`/`nodeCategoryMap`/`NodeCategory` 中的 ai 引用，更新 CLAUDE.md 验证脚本 |
| P5 | ✅ 完成 | `43aff98` | 新建 `backend/api/ai_generate.py`（`POST /api/ai/generate-workflow`），registry 增加 `get_all_schemas()`，Toolbar 增加 AI 编排输入框，FlowEditor 接收生成结果渲染到画布 |

### 待验证事项（明天检查）

1. 启动带 `--remote-debugging-port=9222` 的 Chrome，执行工作流，确认 CDP 连接成功且登录态保留
2. 切换后台/前台模式执行，确认行为符合预期
3. 执行完成后检查 `data/db/executions/` 下 JSON 文件生成且内容完整
4. 刷新页面选中工作流，确认 ExecutionPanel 能展示上次执行记录
5. 配置 `LLM_API_KEY` 和 `LLM_BASE_URL` 环境变量，测试 AI 编排输入框生成工作流
6. `bash backend/setup.sh` 在干净环境下能正常初始化 venv
