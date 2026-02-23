# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 关键约束

- **版本开发必须在分支进行**：任何小版本开发前，先创建 `dev/v{版本号}` 分支（如 `dev/v0.2.3`），完成后合并回 main
- **Python 3.12**：后端运行在 Python 3.12 环境下。
- **验证必须使用 venv Python**：`backend/.venv/bin/python`，不得使用系统 Python
- **验证必须覆盖所有改动文件**：语法检查和导入测试必须包含本次改动涉及的所有 `.py` 文件
- **中文项目**：所有代码注释、文档字符串使用中文。变量名和函数名使用英文（TypeScript camelCase，Python snake_case）

## 项目概述

SchemaFlow 是一个 Web 自动化编排平台，支持两种模式：
- **RPA 模式**：前端拖拽连线构建工作流
- **Agent 模式**：大模型通过自然语言描述自动生成工作流

后端运行 Playwright 浏览器实例，通过 WebSocket 将执行状态和实时截图推送到前端。

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | React 19 + TypeScript + Vite + Tailwind CSS v4 + @xyflow/react |
| 后端 | FastAPI + Python 3.12 + Playwright + asyncio |
| AI | OpenAI 兼容 API（DeepSeek / Kimi 等） |
| 存储 | JSON 文件（抽象接口预留数据库扩展） |
| 通信 | REST API + WebSocket |