# SchemaFlow

Web 自动化双引擎编排系统 - 结合 AI 智能编排和可视化工作流编辑。

## 项目概述

SchemaFlow 是一个轻量级的 Web 自动化平台，具有以下核心特性：

- **双模式驱动**：既支持前端手动拖拽连线（RPA 模式），也支持大模型通过 Function Calling 自动推导组装（Agent 模式）
- **实时观测**：服务端负责运行浏览器内核，通过 WebSocket 将执行日志和实时画面推送到前端
- **极简架构**：使用本地 JSON 文件存储，无需数据库和消息队列
- **纯 PC 应用**：专为桌面端浏览器设计，不支持移动端

## 技术栈

| 组件 | 技术 |
|------|------|
| 前端 | React + ReactFlow + TypeScript（纯 PC 应用） |
| 后端 | FastAPI + Python 3.10+ |
| 执行层 | Playwright |
| 存储 | 本地 JSON 文件（预留数据库接口） |
| 通信 | WebSocket |
| AI | OpenAI 格式 API（兼容 DeepSeek 等） |

## 项目结构

```
SchemaFlow/
├── backend/               # 后端
│   ├── main.py           # FastAPI 入口
│   ├── api/              # API 路由
│   ├── engine/           # 工作流引擎
│   │   ├── executor.py   # 执行器
│   │   ├── context.py    # 执行上下文
│   │   └── actions/     # 节点处理器
│   └── storage/          # 存储层
├── frontend/             # 前端
│   └── test.html        # 测试页面
├── data/                 # 数据目录
│   ├── workflows/       # 工作流存储
│   └── logs/           # 执行日志
└── docs/                # 文档
```

## 快速开始

### 后端

```bash
cd backend

# 初始化环境（创建虚拟环境并安装依赖）
bash setup.sh

# 启动服务
bash start.sh
```

服务将在 `http://localhost:8000` 启动。

**或者手动执行：**

```bash
cd backend

# 创建虚拟环境（仅首次需要）
python3 -m venv .venv

# 激活虚拟环境
source .venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 安装 Playwright 浏览器
playwright install chromium

# 启动服务
python main.py
```

### 前端

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端将在 `http://localhost:3000` 启动。

**注意**：本应用为纯 PC 应用，建议在桌面端浏览器（Chrome、Firefox、Edge 等）中使用，不支持移动端。

## API 接口

### REST API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/workflows` | 获取工作流列表 |
| POST | `/api/workflows` | 创建工作流 |
| GET | `/api/workflows/{id}` | 获取工作流详情 |
| PUT | `/api/workflows/{id}` | 更新工作流 |
| DELETE | `/api/workflows/{id}` | 删除工作流 |
| GET | `/api/actions` | 获取所有节点 Schema |
| POST | `/api/workflows/{id}/execute` | 执行工作流 |
| POST | `/executions/{id}/stop` | 停止执行 |

### WebSocket

连接：`ws://localhost:8000/api/ws/execution/{execution_id}`

消息类型：
- `start_execution` - 开始执行
- `stop_execution` - 停止执行
- `user_input_response` - 用户输入响应
- `execution_started` - 执行开始（服务端推送）
- `node_start` - 节点开始（服务端推送）
- `node_complete` - 节点完成（服务端推送）
- `screenshot` - 截图数据（服务端推送）
- `execution_complete` - 执行完成（服务端推送）

## 节点类型

### 基础节点
- `start` - 开始
- `end` - 结束

### 浏览器操作
- `open_tab` - 打开标签页
- `navigate` - 页面跳转
- `click` - 点击元素
- `input_text` - 输入文本
- `screenshot` - 截图

### 数据操作
- `extract_text` - 提取文本
- `copy_to_clipboard` - 复制到剪贴板
- `paste_from_clipboard` - 从剪贴板粘贴
- `set_variable` - 设置变量

### 控制节点
- `wait` - 等待时间
- `wait_for_element` - 等待元素
- `user_input` - 用户干预

### AI 节点
- `ai_action` - AI 执行

## 变量引用

在节点配置中可以使用 `{{variable_name}}` 语法引用上下文变量：

```json
{
  "type": "input_text",
  "config": {
    "value": "{{extracted_answer}}"
  }
}
```

## MVP 场景

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

## 开发规范

这是一个中文项目，请遵循以下规范：

- 所有代码注释使用中文
- 变量名和函数名使用英文（驼峰命名）
- 文档字符串使用中文
- 详见 `.agents.yaml`

## 许可证

MIT
