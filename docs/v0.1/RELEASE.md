# V0.1 版本说明

发布日期：2026-02-21

## 概述

完成基础架构搭建，包括后端工作流引擎和前端可视化编辑器。

## 后端 (Python/FastAPI)

### 已完成
- **存储层**
  - `StorageBase` 抽象接口
  - `JSONFileStorage` 本地文件存储实现

- **工作流引擎**
  - `WorkflowExecutor` 执行器
  - `ExecutionContext` 执行上下文
  - 拓扑排序算法
  - 变量引用解析 `{{variable}}`

- **节点系统**
  - `ActionRegistry` 动作注册表
  - 装饰器注册机制
  - 基础节点: `start`, `end`
  - 浏览器节点: `open_tab`, `navigate`, `click`, `input_text`, `screenshot`
  - 数据节点: `extract_text`, `copy_to_clipboard`, `paste_from_clipboard`, `set_variable`
  - 控制节点: `wait`, `wait_for_element`, `user_input`
  - AI 节点: `ai_action` (占位实现)

- **API**
  - REST API: 工作流 CRUD、执行控制
  - WebSocket: 实时状态推送
  - `ConnectionManager` 连接管理

## 前端 (React/TypeScript)

### 已完成
- **项目配置**
  - Vite + React + TypeScript
  - Tailwind CSS
  - 路径别名 `@/`
  - API 代理配置

- **类型定义**
  - `types/workflow.ts`: 完整类型定义

- **API 封装**
  - `api/index.ts`: axios 封装
  - 工作流 CRUD 方法
  - 执行控制方法

- **WebSocket Hook**
  - `useWebSocket.ts`: 连接管理、消息处理、自动重连

- **节点组件**
  - `BaseNode`: 通用节点样式
  - `StartNode`, `EndNode`: 开始/结束节点
  - `BrowserNode`, `DataNode`, `ControlNode`, `AINode`: 分类节点
  - 节点状态显示 (idle/running/completed/failed)

- **编辑器组件**
  - `FlowEditor`: ReactFlow 集成
  - `Toolbar`: 节点工具栏（拖拽添加）
  - `NodePanel`: 属性面板（动态表单）

- **其他组件**
  - `WorkflowList`: 工作流列表
  - `ExecutionPanel`: 执行监控面板
  - `App.tsx`: 主应用布局

- **测试工具**
  - `public/test.html`: 独立测试页面
  - `backend/test_backend.py`: 后端测试脚本

## 已知问题

- WebSocket 实时截图推送未正常工作
- 工作流执行状态未实时同步到前端节点
- `ai_action` 节点为占位实现，未集成 Browser Use

## 文件结构

```
SchemaFlow/
├── backend/
│   ├── main.py                 # FastAPI 入口
│   ├── api/
│   │   ├── workflows.py        # 工作流 API
│   │   ├── actions.py          # 节点元数据 API
│   │   ├── execution.py        # 执行控制 API
│   │   └── websocket.py        # WebSocket 管理
│   ├── engine/
│   │   ├── executor.py         # 工作流执行器
│   │   ├── context.py          # 执行上下文
│   │   └── actions/            # 节点实现
│   ├── storage/
│   │   ├── base.py             # 存储接口
│   │   └── file_storage.py     # 文件存储
│   ├── requirements.txt
│   └── test_backend.py         # 测试脚本
├── frontend/
│   ├── src/
│   │   ├── api/index.ts        # API 封装
│   │   ├── hooks/useWebSocket.ts
│   │   ├── types/workflow.ts   # 类型定义
│   │   ├── components/
│   │   │   ├── FlowEditor/     # 编辑器
│   │   │   ├── WorkflowList/   # 工作流列表
│   │   │   └── ExecutionPanel/ # 执行面板
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/test.html        # 测试页面
│   ├── vite.config.ts
│   └── package.json
├── docs/
│   ├── v0.1/                   # V0.1 文档
│   ├── v0.2/                   # V0.2 文档
│   ├── TODO.md
│   └── plans/
└── README.md
```

## 启动方式

```bash
# 后端
cd backend && python main.py

# 前端
cd frontend && npm run dev
```

访问 `http://localhost:3000` 使用主应用，或 `http://localhost:3000/test.html` 使用测试页面。
