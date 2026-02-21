# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ 关键约束

- **Python 版本为 3.9**：后端运行在 Python 3.9 环境下，禁止使用 3.10+ 语法（如 `X | Y` 类型联合，必须用 `Optional[X]` 或 `Union[X, Y]`；禁止 `match/case`）
- **验证必须使用 venv Python**：提交前验证必须使用 `backend/.venv/bin/python`，不得使用系统 Python（系统 Python 版本可能更高，会掩盖兼容性问题）
- **验证必须覆盖所有改动文件**：语法检查和导入测试必须包含本次改动涉及的所有 `.py` 文件，不能只跑固定列表

## 项目概述

SchemaFlow 是一个 Web 自动化编排平台，支持双模式驱动：前端拖拽连线的 RPA 模式，以及大模型通过 Function Calling 自动组装的 Agent 模式。后端运行 Playwright 浏览器实例，通过 WebSocket 将执行状态和实时截图推送到前端。

## 语言与风格

这是一个中文项目。所有代码注释、文档字符串必须使用中文。变量名和函数名使用英文（TypeScript 用 camelCase，Python 用 snake_case）。详见 `.agents.yaml`。

## 常用命令

### 后端
```bash
cd backend
source .venv/bin/activate         # 激活虚拟环境（Python 3.9）
pip install -r requirements.txt
playwright install chromium
python main.py                    # 启动 FastAPI，端口 8000，热重载
```

### 前端
```bash
cd frontend
npm install
npm run dev                       # Vite 开发服务器，端口 3000，/api 代理到 :8000
npm run build                     # tsc -b && vite build
npm run lint                      # eslint
```

### 测试
```bash
# 后端集成测试（需先启动后端）
cd backend && python test_backend.py
```

## 架构

### 后端（Python / FastAPI）

- **入口**：`backend/main.py` — 创建 FastAPI 应用，注册 CORS 和所有路由
- **配置**：`backend/config.py` — 单例配置加载器，读取 `settings.toml`，叠加 `settings.local.toml`（gitignored），环境变量可覆盖
- **API 层**（`backend/api/`）：工作流 CRUD（`workflows.py`）、节点 Schema 查询（`actions.py`）、执行启停（`execution.py`）、WebSocket 端点（`websocket.py`）、AI 工作流生成（`ai_generate.py`）
- **引擎**（`backend/engine/`）：
  - `executor.py` — `WorkflowExecutor` 对工作流 DAG 做拓扑排序后顺序执行节点，管理 Playwright 浏览器生命周期
  - `context.py` — `ExecutionContext` 持有单次执行的状态：浏览器/页面、变量、剪贴板、日志、截图，以及通过 `asyncio.Event` 实现的用户输入同步
  - `actions/registry.py` — `ActionRegistry` 单例 + `@register_action` 装饰器；每个动作定义元数据（JSON Schema 参数、端口）和异步执行函数
  - `actions/` — 按分类实现节点：`base.py`（start/end）、`browser.py`（open_tab、navigate、click、input_text、screenshot）、`data.py`（extract_text、剪贴板操作、set_variable）、`control.py`（wait、wait_for_element、user_input）
- **存储层**（`backend/storage/`）：`StorageBase` 抽象基类 + `JSONFileStorage`（`file_storage.py`），将工作流和执行日志以 JSON 文件存储在 `data/` 目录下
- **执行记录仓储**（`backend/repository/`）：`ExecutionRepository` 抽象基类 + `JSONExecutionRepository`，结构化节点执行记录持久化

### 前端（React + TypeScript + Vite）

- **入口**：`frontend/src/main.tsx` → `App.tsx` — 三栏布局：工作流列表（左）、流程编辑器（中）、执行监控（右）
- **FlowEditor**（`components/FlowEditor/`）：基于 `@xyflow/react`（ReactFlow），`nodes/` 下按分类实现自定义节点组件，`panels/NodePanel.tsx` 为属性面板，`panels/Toolbar.tsx` 为工具栏
- **ExecutionPanel**（`components/ExecutionPanel/`）：展示实时截图、执行日志和用户输入提示
- **WebSocket Hook**（`hooks/useWebSocket.ts`）：管理 WS 连接、消息分发、自动重连
- **API 客户端**（`api/index.ts`）：axios 封装，工作流 CRUD 和 AI 生成接口
- **路径别名**：`@` 映射到 `frontend/src/`（在 `vite.config.ts` 和 `tsconfig.app.json` 中配置）
- **样式**：Tailwind CSS v4，通过 `@tailwindcss/vite` 插件集成

### 数据流

1. 用户在 FlowEditor 中创建/编辑工作流 → 通过 REST API 保存 → JSON 文件存储在 `data/workflows/`
2. 用户点击执行 → REST 调用创建执行 → 前端通过 WebSocket 连接 `/api/ws/execution/{id}`
3. 后端 `WorkflowExecutor` 启动 Playwright，按拓扑顺序执行节点，通过 WS 推送 `node_start`/`node_complete`/`screenshot`/`log` 消息
4. 节点配置中可使用 `{{variable_name}}` 模板语法引用上游节点产生的变量

### 添加新节点类型

1. 在 `backend/engine/actions/` 对应文件中创建异步函数
2. 使用 `@register_action(name, label, description, category, parameters)` 装饰器，自动注册到全局 `ActionRegistry`
3. 前端通过 `GET /api/actions` 自动发现可用节点并渲染到工具栏
4. 如需特殊渲染，在 `frontend/src/components/FlowEditor/nodes/` 下添加自定义 React 节点组件

## 分支管理

每个版本使用独立的开发分支，完成后合并回 main：

```bash
# 开始新版本开发
git checkout main
git pull
git checkout -b dev/v{版本号}    # 例如 dev/v0.2

# 开发过程中按阶段提交
git add . && git commit -m "feat: ..."

# 版本完成后合并
git checkout main
git merge dev/v{版本号}
git tag v{版本号}
```

## 提交规范

`feat:` / `fix:` / `docs:` / `style:` / `refactor:` / `test:` / `chore:`

## 提交前验证

完成任务后必须执行以下验证，全部通过后方可提交：

```bash
# 1. 后端语法检查（必须使用 venv Python）
cd backend && .venv/bin/python -c "
import py_compile, glob
for f in glob.glob('**/*.py', recursive=True):
    if '.venv' in f:
        continue
    py_compile.compile(f, doraise=True)
    print(f'OK: {f}')
"

# 2. 后端模块导入测试（必须使用 venv Python）
cd backend && .venv/bin/python -c "
import sys; sys.path.insert(0,'.')
from config import get_settings
from engine.actions import base, browser, data, control
from engine.executor import WorkflowExecutor
from api.websocket import manager
from repository import get_execution_repo
print('所有模块导入成功')
"

# 3. 前端类型检查
cd frontend && npx tsc --noEmit

# 4. 前端 lint
cd frontend && npm run lint
```

注意事项：
- `context.log()` 是异步方法，所有调用必须使用 `await context.log(...)`
- WebSocket 中启动后台任务使用 `asyncio.create_task()`，不要用 `BackgroundTasks`
- 截图格式为 JPEG，前端渲染使用 `data:image/jpeg;base64,`
- `useWebSocket.ts` 中 `startExecution` 的参数可能收到 React 事件对象，需做类型守卫
