# SchemaFlow 设计文档

## 概述

SchemaFlow 是一个 Web 端浏览器自动化平台，结合 AI 智能编排和可视化工作流编辑，让用户既能通过自然语言描述任务自动生成工作流，也能手动拖拽节点精细控制。

**核心特点：**
- 基于 Browser Use 的 AI 能力，支持自然语言驱动自动化
- 可视化工作流编辑器，操作过程透明可控
- 有头浏览器执行，支持用户干预（如输入验证码）
- AI 执行过程可录制为可复用节点

## MVP 目标

实现以下具体场景：

```
跳转到 DeepSeek 问答页面
    ↓
提问："browser use是什么"
    ↓
等待回答生成完成
    ↓
复制回答内容
    ↓
跳转到 Notion 页面
    ↓
粘贴内容到页面
```

## 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                    Web Frontend (React)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ 工作流编辑器 │  │  执行监控   │  │   任务管理      │  │
│  │ (拖拽节点)  │  │ (实时状态)  │  │  (历史/调度)    │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└───────────────────────┬─────────────────────────────────┘
                        │ WebSocket + REST API
┌───────────────────────▼──────────��──────────────────────┐
│                 Python Backend (FastAPI)                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ 工作流引擎  │  │  AI 编排器  │  │   用户干预管理  │  │
│  │ (解析/执行) │  │(Browser Use)│  │  (暂停/输入)    │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│              Browser Use + Playwright                    │
│         (有头浏览器，用户可见操作过程)                    │
└─────────────────────────────────────────────────────────┘
```

**技术栈：**
- 前端：React + ReactFlow（流程图）+ TypeScript
- 后端：FastAPI + Python
- 执行层：Browser Use + Playwright
- 存储：本地 JSON/CSV 文件（MVP 阶段，预留数据库扩展接口）

## 节点类型

### 基础节点

| 节点 | 类型 | 说明 |
|------|------|------|
| 开始 | `start` | 流程起点 |
| 结束 | `end` | 流程结束 |

### 浏览器操作节点

| 节点 | 类型 | 说明 |
|------|------|------|
| 打开标签页 | `open_tab` | 打开新标签页，可指定 URL |
| 切换标签页 | `switch_tab` | 切换到指定标签页（按索引或标题匹配） |
| 关闭标签页 | `close_tab` | 关闭当前/指定标签页 |
| 页面跳转 | `navigate` | 当前标签页跳转 URL |
| 点击 | `click` | 点击元素（CSS 选择器 / AI 描述） |
| 输入文本 | `input_text` | 输入文本到表单字段 |
| 下拉选择 | `select_option` | 下拉框选择 |
| 滚动 | `scroll` | 滚动页面 |
| 截图 | `screenshot` | 截图保存 |

### 数据操作节点

| 节点 | 类型 | 说明 |
|------|------|------|
| 提取文本 | `extract_text` | 提取元素文本到变量 |
| 复制 | `copy_to_clipboard` | 复制内容到剪贴板 |
| 粘贴 | `paste_from_clipboard` | 从剪贴板粘贴 |
| 设置变量 | `set_variable` | 设置变量值 |

### 控制节点

| 节点 | 类型 | 说明 |
|------|------|------|
| 等待时间 | `wait` | 等待指定时间 |
| 等待元素 | `wait_for_element` | 等待元素出现 |
| 用户干预 | `user_input` | 暂停等待用户操作（登录/验证码） |

### AI 节点

| 节点 | 类型 | 说明 |
|------|------|------|
| AI 执行 | `ai_action` | 自然语言描述任务，Browser Use 执行 |

### 自定义节点

| 节点 | 类型 | 说明 |
|------|------|------|
| 自定义脚本 | `custom_script` | 执行自定义 Python/JS 代码片段 |

## 节点定义格式

### 基础结构

```json
{
  "id": "node_1",
  "type": "input_text",
  "config": {
    "selector": "textarea[placeholder='输入消息']",
    "ai_target": "输入框",
    "value": "browser use是什么",
    "clear_before": true
  },
  "meta": {
    "generated_by": "manual",
    "original_prompt": null,
    "recorded_from": null
  }
}
```

### 元素定位方式

节点支持两种元素定位方式，可同时配置（优先使用 selector）：

- `selector`: CSS 选择器，精确定位
- `ai_target`: 自然语言描述，AI 辅助定位

### 变量引用

配置中支持 `{{variable_name}}` 语法引用上下文变量：

```json
{
  "type": "input_text",
  "config": {
    "value": "{{extracted_answer}}"
  }
}
```

### 自定义脚本节点

```json
{
  "type": "custom_script",
  "config": {
    "language": "python",
    "code": "result = context['extracted_text'].upper()",
    "output_var": "processed_text"
  }
}
```

## 工作流定义格式

```json
{
  "id": "workflow_001",
  "name": "DeepSeek 问答 → Notion 记录",
  "description": "从 DeepSeek 获取回答并保存到 Notion",
  "version": "1.0.0",
  "created_at": "2026-02-20T10:00:00Z",
  "updated_at": "2026-02-20T10:00:00Z",
  "nodes": [
    { "id": "start_1", "type": "start", "config": {} },
    { "id": "open_1", "type": "open_tab", "config": { "url": "https://chat.deepseek.com" } },
    { "id": "user_1", "type": "user_input", "config": { "prompt": "请完成登录后点击继续", "timeout": 300 } },
    { "id": "ai_1", "type": "ai_action", "config": { "prompt": "在输入框输入'browser use是什么'并发送" } },
    { "id": "wait_1", "type": "wait_for_element", "config": { "ai_target": "AI 回答内容区域", "timeout": 60 } },
    { "id": "extract_1", "type": "extract_text", "config": { "ai_target": "AI 的回答内容", "output_var": "answer" } },
    { "id": "open_2", "type": "open_tab", "config": { "url": "https://notion.so/your-page" } },
    { "id": "user_2", "type": "user_input", "config": { "prompt": "请完成登录后点击继续", "timeout": 300 } },
    { "id": "ai_2", "type": "ai_action", "config": { "prompt": "将以下内容粘贴到页面中：{{answer}}" } },
    { "id": "end_1", "type": "end", "config": {} }
  ],
  "edges": [
    { "source": "start_1", "target": "open_1" },
    { "source": "open_1", "target": "user_1" },
    { "source": "user_1", "target": "ai_1" },
    { "source": "ai_1", "target": "wait_1" },
    { "source": "wait_1", "target": "extract_1" },
    { "source": "extract_1", "target": "open_2" },
    { "source": "open_2", "target": "user_2" },
    { "source": "user_2", "target": "ai_2" },
    { "source": "ai_2", "target": "end_1" }
  ]
}
```

## AI 自动生成工作流

### 工作模式

| 模式 | 说明 |
|------|------|
| 手动编排 | 用户拖拽节点构建工作流 |
| AI 生成 | 用户描述任务，AI 自动生成工作流节点 |
| AI 执行 + 录制 | AI 执行任务时，实时将操作录制为节点 |

### AI 生成流程

```
用户输入: "去 DeepSeek 问 browser use 是什么，把回答保存到 Notion"
                    ↓
            LLM 解析意图
                    ↓
        生成工作流 JSON（节点序列）
                    ↓
        前端可视化渲染，用户可调整
                    ↓
              确认后执行
```

### 执行录制

Browser Use 执行 `ai_action` 时，将实际操作拆解为具体节点：

```
ai_action: "在输入框输入问题并发送"
              ↓ 录制
         ┌─────────────┐
         │ click       │ → 点击输入框
         │ input_text  │ → 输入文本
         │ click       │ → 点击发送按钮
         └─────────────┘
```

录制的节点可保存，下次直接复用（无需 AI 重新规划）。

### 节点元数据

```json
{
  "meta": {
    "generated_by": "ai",
    "original_prompt": "在输入框输入问题",
    "recorded_from": "ai_action_3"
  }
}
```

- `generated_by`: 节点来源（manual / ai / recorded）
- `original_prompt`: AI 生成时的原始描述
- `recorded_from`: 录制来源节点 ID

## 项目结构

```
SchemaFlow/
├── backend/
│   ├── main.py                 # FastAPI 入口
│   ├── api/
│   │   ├── workflows.py        # 工作流 CRUD API
│   │   ├── execution.py        # 执行控制 API
│   │   └── websocket.py        # WebSocket 处理
│   ├── engine/
│   │   ├── executor.py         # 工作流执行器
│   │   ├── nodes/              # 节点处理器
│   │   │   ├── base.py         # 节点基类
│   │   │   ├── browser.py      # 浏览器操作节点
│   │   │   ├── data.py         # 数据操作节点
│   │   │   ├── control.py      # 控制节点
│   │   │   ├── ai.py           # AI 节点
│   │   │   └── custom.py       # 自定义节点
│   │   ├── recorder.py         # 操作录制器
│   │   └── context.py          # 执行上下文
│   ├── ai/
│   │   ├── generator.py        # 工作流生成器
│   │   └── browser_use.py      # Browser Use 集成
│   ├── storage/
│   │   ├── base.py             # 存储接口（预留扩展）
│   │   └── file_storage.py     # 本地文件存储
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── FlowEditor/     # 可视化编辑器
│   │   │   │   ├── index.tsx
│   │   │   │   ├── nodes/      # 节点组件
│   │   │   │   └── panels/     # 属性面板
│   │   │   ├── ExecutionPanel/ # 执行监控
│   │   │   └── WorkflowList/   # 工作流列表
│   │   ├── hooks/
│   │   ├── api/
│   │   └── types/
│   ├── package.json
│   └── vite.config.ts
├── data/
│   ├── workflows/              # 工作流 JSON 存储
│   └── logs/                   # 执行日志
├── docs/
│   └── plans/
└── README.md
```

## 存储设计

MVP 阶段使用本地文件存储，通过抽象接口预留数据库扩展：

### 存储接口

```python
class StorageBase(ABC):
    @abstractmethod
    async def save_workflow(self, workflow: dict) -> str: ...
    
    @abstractmethod
    async def get_workflow(self, workflow_id: str) -> dict: ...
    
    @abstractmethod
    async def list_workflows(self) -> list[dict]: ...
    
    @abstractmethod
    async def delete_workflow(self, workflow_id: str) -> bool: ...
    
    @abstractmethod
    async def save_execution_log(self, log: dict) -> str: ...
    
    @abstractmethod
    async def get_execution_logs(self, workflow_id: str) -> list[dict]: ...
```

### 文件存储实现

- 工作流：`data/workflows/{workflow_id}.json`
- 执行日志：`data/logs/{execution_id}.json`
- 索引文件：`data/workflows/index.json`（工作流列表缓存）

## API 设计

### REST API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/workflows` | 获取工作流列表 |
| POST | `/api/workflows` | 创建工作流 |
| GET | `/api/workflows/{id}` | 获取工作流详情 |
| PUT | `/api/workflows/{id}` | 更新工作流 |
| DELETE | `/api/workflows/{id}` | 删除工作流 |
| POST | `/api/workflows/{id}/execute` | 执行工作流 |
| POST | `/api/workflows/{id}/stop` | 停止执行 |
| POST | `/api/ai/generate` | AI 生成工作流 |

### WebSocket

连接：`ws://localhost:8000/ws/execution/{execution_id}`

消息类型：

```json
// 服务端 → 客户端：状态更新
{
  "type": "status",
  "node_id": "ai_1",
  "status": "running",
  "message": "正在执行 AI 操作..."
}

// 服务端 → 客户端：用户干预请求
{
  "type": "user_input_required",
  "node_id": "user_1",
  "prompt": "请完成登录后点击继续",
  "timeout": 300
}

// 客户端 → 服务端：用户干预响应
{
  "type": "user_input_response",
  "node_id": "user_1",
  "action": "continue"
}

// 服务端 → 客户端：截图
{
  "type": "screenshot",
  "data": "base64...",
  "timestamp": "2026-02-20T10:00:00Z"
}

// 服务端 → 客户端：执行完成
{
  "type": "completed",
  "success": true,
  "duration": 45.2
}
```

## MVP 范围

### 包含

- 基础工作流编辑器（节点拖拽、连线）
- 核心节点类型实现
- 工作流执行引擎
- Browser Use 集成
- 用户干预机制
- 实时执行状态展示
- 本地文件存储

### 不包含（后续迭代）

- 定时调度
- 复杂条件分支/循环
- 用户管理/权限
- 工作流版本管理
- 节点市场/模板库
- 数据库存储
- 多浏览器实例并行

## 后续扩展方向

1. **存储升级**：接入 SQLite/PostgreSQL
2. **调度系统**：支持 Cron 定时执行
3. **节点市场**：用户分享/下载节点模板
4. **多实例**：并行执行多个工作流
5. **云端部署**：支持远程浏览器执行
