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