# V0.1.1 补丁说明

发布日期：2026-02-21

## 概述

修复 V0.1 中端到端执行流程的多个 bug，使工作流可以正常运行。

## 修复内容

### Bug 1：BackgroundTasks 在 WebSocket 中不可靠
- 文件：`backend/api/execution.py`
- 问题：使用 FastAPI `BackgroundTasks` 启动执行，在 WebSocket handler 中行为不可预测
- 修复：改用 `asyncio.create_task()`

### Bug 2：execution_id 不一致
- 文件：`backend/engine/executor.py`、`backend/api/execution.py`
- 问题：REST 端点生成的 execution_id 与执行器内部生成的不一致，前端无法关联
- 修复：`execute()` 接受外部传入的 execution_id

### Bug 3：日志未通过 WebSocket 推送
- 文件：`backend/engine/context.py`
- 问题：`log()` 只追加到本地列表，未推送到前端
- 修复：`log()` 改为 async，同时通过 WebSocket 发送 `log` 类型消息

### Bug 4：截图 MIME 类型不匹配
- 文件：`frontend/src/components/ExecutionPanel/index.tsx`
- 问题：后端发送 JPEG 格式，前端用 `image/png` 渲染
- 修复：改为 `image/jpeg`

### Bug 5：screenshot 节点编码错误
- 文件：`backend/engine/actions/browser.py`
- 问题：使用 `.hex()` 编码截图数据，前端无法解析
- 修复：改用 `base64.b64encode().decode()`

### Bug 6：用户输入消息格式不匹配
- 文件：`backend/api/execution.py`、`frontend/src/hooks/useWebSocket.ts`
- 问题：前端发送 `action` 字段，后端读取 `response` 字段
- 修复：后端改为读取 `action` 字段，cancel 时调用 stop，continue 时调用 respond

### Bug 7：外部传入 browser 时未创建 page
- 文件：`backend/engine/executor.py`
- 问题：当外部传入 browser 但没有 page 时，执行器跳过了页面创建
- 修复：增加 `elif` 分支处理此情况

### Bug 8：React 事件对象导致 JSON 序列化失败
- 文件：`frontend/src/hooks/useWebSocket.ts`
- 问题：`startExecution` 从 `onClick` 直接调用时，React 事件对象被当作 workflowId
- 修复：增加 `typeof workflowId === 'string'` 类型守卫

## 涉及文件

| 文件 | 改动 |
|------|------|
| `backend/engine/context.py` | log() 改为 async，推送 WS 消息 |
| `backend/engine/executor.py` | 接受外部 execution_id；修复 page 创建 |
| `backend/api/execution.py` | asyncio.create_task；修复 user_input 处理 |
| `backend/engine/actions/browser.py` | hex→base64；await log |
| `backend/engine/actions/base.py` | await log |
| `backend/engine/actions/data.py` | await log |
| `backend/engine/actions/control.py` | await log |
| `backend/engine/actions/ai.py` | await log |
| `frontend/src/components/ExecutionPanel/index.tsx` | MIME png→jpeg |
| `frontend/src/hooks/useWebSocket.ts` | startExecution 类型守卫 |

## 验证

通过端到端测试验证：start → open_tab(baidu.com) → wait(2s) → screenshot → end
- 节点状态实时变化
- 实时截图正常显示
- 日志面板有输出
- execution_id 前后端一致
