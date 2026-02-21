# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 关键约束

- **Python 3.9**：后端运行在 Python 3.9 环境下。禁止 `X | Y` 类型联合（用 `Optional[X]` 或 `Union[X, Y]`），禁止 `match/case`
- **验证必须使用 venv Python**：`backend/.venv/bin/python`，不得使用系统 Python
- **验证必须覆盖所有改动文件**：语法检查和导入测试必须包含本次改动涉及的所有 `.py` 文件
- **中文项目**：所有代码注释、文档字符串使用中文。变量名和函数名使用英文（TypeScript camelCase，Python snake_case）

## 项目概述

SchemaFlow 是一个 Web 自动化编排平台，支持两种模式：
- **RPA 模式**：前端拖拽连线构建工作流
- **Agent 模式**：大模型通过自然语言描述自动生成工作流

后端运行 Playwright 浏览器实例，通过 WebSocket 将执行状态和实时截图推送到前端。支持 CDP 连接用户本地浏览器（保留登录态）和独立 headless 浏览器两种执行方式。

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | React 19 + TypeScript + Vite + Tailwind CSS v4 + @xyflow/react |
| 后端 | FastAPI + Python 3.9 + Playwright + asyncio |
| AI | OpenAI 兼容 API（DeepSeek / Kimi 等） |
| 存储 | JSON 文件（抽象接口预留数据库扩展） |
| 通信 | REST API + WebSocket |

## 常用命令

```bash
# 后端
cd backend && source .venv/bin/activate
pip install -r requirements.txt && playwright install chromium
python main.py                    # FastAPI :8000，热重载

# 前端
cd frontend && npm install
npm run dev                       # Vite :3000，/api 代理到 :8000
npm run build                     # tsc -b && vite build
npm run lint                      # eslint

# 集成测试（需先启动后端）
cd backend && python test_backend.py
```

## 架构

### 后端

```
backend/
├── main.py                 # FastAPI 入口，注册 CORS 和所有路由
├── config.py               # 单例配置加载器（settings.toml + settings.local.toml + 环境变量）
├── api/
│   ├── workflows.py        # 工作流 CRUD
│   ├── actions.py          # 节点 Schema 查询 GET /api/actions
│   ├── execution.py        # 执行启停 + WebSocket 端点
│   ├── websocket.py        # ConnectionManager WebSocket 管理
│   └── ai_generate.py      # POST /api/ai/generate-workflow 自然语言生成工作流
├── engine/
│   ├── executor.py          # WorkflowExecutor：DAG 拓扑排序 + 顺序执行
│   ├── context.py           # ExecutionContext：单次执行的状态容器
│   └── actions/
│       ├── registry.py      # ActionRegistry + @register_action 装饰器
│       ├── base.py          # start / end
│       ├── browser.py       # open_tab / navigate / click / input_text / screenshot
│       ├── data.py          # extract_text / clipboard / set_variable
│       └── control.py       # wait / wait_for_element / user_input
├── storage/                 # StorageBase 抽象 + JSONFileStorage
└── repository/              # ExecutionRepository 抽象 + JSON 实现
```

### 前端

```
frontend/src/
├── App.tsx                  # 三栏布局：工作流列表 / 编辑器 / 执行监控
├── api/index.ts             # axios 封装
├── hooks/useWebSocket.ts    # WebSocket 连接、消息分发、自动重连
├── types/workflow.ts        # 全部 TypeScript 类型定义
├── components/
│   ├── FlowEditor/
│   │   ├── index.tsx        # ReactFlow 画布 + 数据转换
│   │   ├── nodes/           # 自定义节点组件（BaseNode + 5 种分类节点）
│   │   └── panels/          # Toolbar（节点面板 + AI 编排）+ NodePanel（属性编辑）
│   ├── ExecutionPanel/      # 实时截图 / 节点记录 / 日志 Tab
│   └── WorkflowList/        # 工作流列表 CRUD
```

### 数据流

1. 用户编辑工作流 → REST API 保存 → `data/workflows/*.json`
2. 用户执行 → REST 创建执行 → WebSocket 连接 `/api/ws/execution/{id}`
3. `WorkflowExecutor` 启动 Playwright → 拓扑排序 → 逐节点执行 → WS 推送状态/截图/日志
4. 节点配置中 `{{variable_name}}` 模板语法引用上游变量

### 添加新节点

1. 在 `backend/engine/actions/` 中创建 async 函数
2. 用 `@register_action(name, label, description, category, parameters)` 装饰
3. 前端通过 `GET /api/actions` 自动发现，渲染到工具栏
4. 如需特殊 UI，在 `frontend/src/components/FlowEditor/nodes/` 添加自定义组件

## 关键实现细节

- `context.log()` 是异步方法，**必须 `await`**
- WebSocket 后台任务使用 `asyncio.create_task()`，不要用 `BackgroundTasks`
- 截图格式 JPEG，前端用 `data:image/jpeg;base64,`
- `useWebSocket.ts` 中 `startExecution` 参数可能收到 React 事件对象，需做类型守卫
- CDP 模式下复用已有页面不关闭，新建的页面才在 cleanup 时关闭
- `@` 路径别名映射到 `frontend/src/`（vite.config.ts + tsconfig.app.json）

## 配置

```
settings.toml            # 默认配置（提交到 git）
settings.local.toml      # 本地覆盖（gitignored）
```

优先级：环境变量 > settings.local.toml > settings.toml

关键配置项：
- `[browser] cdp_url` — Chrome CDP 调试端口
- `[llm] api_key / base_url / model / timeout` — LLM API 配置

## 分支管理

```
main                      # 发布分支
dev/v{版本号}              # 版本开发分支（如 dev/v0.2）
```

开发完成后合并回 main，打 tag。

## 提交规范

`feat:` / `fix:` / `docs:` / `style:` / `refactor:` / `test:` / `chore:`

## 提交前验证

```bash
# 1. 后端语法检查
cd backend && .venv/bin/python -c "
import py_compile, glob
for f in glob.glob('**/*.py', recursive=True):
    if '.venv' in f: continue
    py_compile.compile(f, doraise=True)
    print(f'OK: {f}')
"

# 2. 后端模块导入测试
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

## 当前版本状态

- **已发布**：v0.1.0
- **当前开发**：v0.2.x（`dev/v0.2` 分支）
- **V0.2.2 已完成**：CDP 连接、双模式执行、结构化记录、AI 编排、venv 自动激活
- **V0.2.3 计划**：修复 LLM 超时、AI 编排缺 start/end 节点、生成工作流执行报错、CDP 登录态
- **V0.3 计划**：架构重构 + 功能补全 + 样式优化
- **V0.4 待办**：测试体系搭建

详细计划见 `docs/v0.2/v0.2.3/PLAN.md` 和 `docs/v0.3/PLAN.md`。
