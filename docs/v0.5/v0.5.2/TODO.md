# v0.5.2 待办清单与执行方案

> 基于核心功能测试反馈，按优先级排列。每个条目包含：问题描述、根因分析、修复方案、涉及文件。

---

## 一、功能修复（P0 - 阻断性问题）

### BUG-01：工作流执行无法停止 ✅

**问题**：点击停止按钮无反应，需要强制取消，存在两个按钮。

**根因**：
1. 后端 `stop()` 仅设置 `context.status = CANCELLED` 标志位，无法中断正在阻塞的 Playwright 异步操作（如 `page.goto()`、`page.click(timeout=30000)`），必须等当前操作自然超时后才能在下一个检查点退出
2. 前端 `executionStore.ts` 的 `handleMessage` 未处理 `execution_cancelled` 消息类型，停止后 `isRunning` 状态不复位，UI 不更新
3. 前端仅通过 WebSocket 发送停止消息，未调用 REST API `POST /api/executions/{id}/stop` 作为冗余通道

**修复方案**：
- [x] **后端**：`executor.stop()` 中，除了设置标志位，还需调用 `context.page.close()` 或 `context._context.close()` 强制中断当前 Playwright 操作，在执行循环中捕获 `TargetClosedError` 并视为取消
- [x] **后端**：在 `stop()` 中增加对 `asyncio.Task` 的 `cancel()` 调用，确保协程级别也能被中断
- [x] **前端**：`executionStore.ts` 的 `handleMessage` 中增加 `case 'execution_cancelled'`，将 `isRunning` 设为 `false`
- [x] **前端**：`useExecution.ts` 的 `stopExecution` 同时调用 WebSocket 消息和 REST API 双通道，确保至少一个通道生效
- [x] **前端**：统一为一个停止按钮，移除多余按钮

**涉及文件**：
- `backend/engine/executor.py` — `stop()` 方法，执行循环 try/except
- `frontend/src/stores/executionStore.ts` — `handleMessage`
- `frontend/src/hooks/useExecution.ts` — `stopExecution`
- `frontend/src/components/ExecutionPanel/index.tsx` — 按钮 UI

---

### BUG-02：进入页面重复调用 workflow 接口 ✅

**问题**：进入页面会调用两次相同的 `GET /api/workflows` 接口。

**根因**：`WorkflowList` 组件在 `useEffect` 中依赖 `refreshKey`（来自 `workflowStore.listVersion`）加载列表，同时组件挂载时也会触发一次。创建工作流后既更新了本地 state 又调用了 `refreshList()` 导致额外请求。React 严格模式（StrictMode）在开发环境下也会双重触发 `useEffect`。

**修复方案**：
- [x] `WorkflowList` 中去除本地 `workflows` state，统一由 `workflowStore` 管理列表数据，避免双重数据源
- [x] 创建工作流后只更新 store 列表，不再额外调用 refreshList
- [x] 同理修复 `actionApi.list()` 重复调用，新增 `actionStore` 统一管理

**涉及文件**：
- `frontend/src/components/WorkflowList/index.tsx` — 移除本地 state，使用 store
- `frontend/src/stores/workflowStore.ts` — 新增 workflows 列表状态管理
- `frontend/src/stores/actionStore.ts` — 新增 actions 列表状态管理
- `frontend/src/components/FlowEditor/index.tsx` — 使用 actionStore
- `frontend/src/App.tsx` — 移除 refreshKey 依赖
- `frontend/src/components/Header.tsx` — 使用 updateWorkflowInList 替代 refreshList

---

### BUG-03：用户干预节点功能异常 ✅

**问题**：前台模式弹窗遮挡操作；点击继续后只在监控栏出现提示无实际效果；后台模式无提示。

**根因**：
1. `is_headed_mode` 判断逻辑有误：`not getattr(context, "_is_cdp", False) and context.page is not None`，headless 独立浏览器也满足此条件，会在不可见的 headless 浏览器中注入 DOM 弹窗
2. 前台模式使用浏览器内 JS 注入弹窗（`page.evaluate`），这个弹窗会阻挡用户对被测页面的操作
3. "继续"按钮的响应链路可能断裂：前端发送的 `user_input_response` 消息格式与后端 `request_user_input` 期望的回调不匹配

**修复方案**：
- [x] **后端**：修正 `is_headed_mode` 判断，使用 `_headless` 属性判断前台模式
- [x] **后端**：前台模式在浏览器顶部显示非阻塞通知栏，页面跳转时自动继续执行下一节点
- [x] **前端**：统一前台/后台模式的用户干预交互，都通过 ExecutionPanel 中的 `UserInputDialog` 处理
- [x] **前端**：将 WebSocket 连接移到 Zustand store 中共享，修复消息发送链路断裂问题
- [x] **前端**：用户干预弹窗改为固定顶部非遮罩样式

**涉及文件**：
- `backend/engine/actions/control.py` — `user_input_action`，`is_headed_mode` 判断
- `backend/engine/context.py` — `request_user_input`
- `frontend/src/components/ExecutionPanel/index.tsx` — `UserInputDialog`
- `frontend/src/components/ExecutionPanel/AIInterventionPrompt.tsx`

---

### BUG-04：拖拽功能异常，影响其他区域 ✅

**问题**：拖动日志栏会影响实时截图区的上部，期望各区域独立拖拽调整。

**根因**：`ExecutionPanel` 中使用 `re-resizable` 的 `Resizable` 组件，截图区和日志区各自的 `height` 状态独立，但它们在 flex 容器中纵向排列，一个区域高度变化会挤压另一个区域。`enable={{ top: true, bottom: true }}` 同时开启了上下两个方向的拖拽手柄，导致交互混乱。

**修复方案**：
- [x] 移除 `re-resizable` 依赖，改用自定义分割线拖拽
- [x] 分割线移到区域之间，每个分割线只控制相邻两个区域
- [x] 简化拖拽逻辑，在 handleMouseDown 内部创建 onMove 和 onUp 闭包

**涉及文件**：
- `frontend/src/components/ExecutionPanel/index.tsx` — 重写 `CompactModeLayout`，移除 `ResizableSection`

---

### BUG-05：登录信息无法留存 ✅

**问题**：前一个已登录的工作流，下次运行仍需重新登录。

**根因**：
1. 凭证保存链路：执行结束 → 后端提取 `storage_state` → WS 推送 `storage_state_update` → 前端存入 IndexedDB → 下次执行时注入。任何一环断裂都会导致登录态丢失
2. 需排查：后端是否正确提取了包含 cookies 的 `storage_state`；前端是否正确接收并持久化；下次执行时是否正确注入到 `start_execution` 消息
3. CDP 模式下，如果每次创建新 context 而非复用已有 context，登录态无法继承

**修复方案**：
- [x] 在后端 `storage_state` 提取处增加日志，确认 cookies 和 localStorage 是否完整提取
- [x] 在前端 `credentialStore` 增加日志，确认 IndexedDB 存取是否正常
- [x] 在 `start_execution` 处增加日志，确认 `storage_state` 是否正确注入到浏览器 context
- [x] 在 `browser_manager.py` 中增加 storage_state 注入日志
- [x] 增加前端 UI 提示，显示当前工作流是否已缓存登录凭证（已保存网站状态）

**实现细节**：
- 新增 `StorageStateIndicator` 组件，显示在画布左上角
- 使用 `Database` 图标，文案改为"已保存网站状态"
- 提供清除按钮，可手动清除缓存的网站状态
- 每秒检查一次状态变化

**涉及文件**：
- `backend/engine/executor.py` — 执行结束后的 `storage_state` 提取
- `backend/engine/browser_manager.py` — `connect()` 中 `storage_state` 注入
- `frontend/src/stores/credentialStore.ts` — IndexedDB 存取
- `frontend/src/hooks/useExecution.ts` — `startExecution` 中凭证注入

---

## 二、优化（P1 - 体验改善）

### OPT-01：AI 定位策略精简 + CSS 回填 ✅

**问题**：去除新增的 AI 智能定位相关功能，保留 CSS 失效时启用 AI 定位的策略；AI 成功定位后需回填 CSS 选择器到工作流。

**修复方案**：
- [x] 保留 `HybridElementLocator` 混合定位逻辑，CSS 失效时启用 AI 后备
- [x] AI 定位成功后，将选中的 CSS 选择器通过 WS 消息（`selector_update` 类型）回传给前端
- [x] 前端收到 `selector_update` 后，自动更新对应节点的 `selector` 配置字段并**自动保存**到后端
- [x] 移除 NodePanel 中的 AI 智能定位调试区域，只保留"CSS 失效时启用 AI 定位"开关
- [x] 修复 `supportsAiFallback` 判断，支持 `click`、`input_text`、`select_option`、`wait_for_element`

**实现细节**：
1. **后端** (`backend/engine/actions/utils.py`)：`locate_element()` 返回 `(locator, effective_selector)` 元组
2. **后端** (`backend/engine/executor.py`)：节点执行后检查 `effective_selector`，发送 `selector_update` WS 消息
3. **后端** (`backend/engine/actions/browser.py`)：`click`、`input_text`、`select_option` 返回 `effective_selector`
4. **后端** (`backend/engine/actions/control.py`)：`wait_for_element` 返回 `effective_selector`
5. **前端** (`frontend/src/types/workflow.ts`)：添加 `selector_update` 消息类型
6. **前端** (`frontend/src/stores/executionStore.ts`)：处理 `selector_update`，调用 `workflowApi.update()` 自动保存
7. **前端** (`frontend/src/components/FlowEditor/index.tsx`)：监听 `workflow.nodes` 变化，确保画布实时更新

**涉及文件**：
- `backend/engine/ai/locator.py` — `HybridElementLocator` 混合定位逻辑
- `backend/engine/actions/utils.py` — `locate_element` 返回选择器信息
- `backend/engine/actions/browser.py` — `click`、`input_text`、`select_option` 使用 locate_element
- `backend/engine/actions/control.py` — `wait_for_element` 使用 locate_element
- `backend/engine/executor.py` — 发送选择器更新消息
- `frontend/src/types/workflow.ts` — 新增消息类型
- `frontend/src/stores/executionStore.ts` — 处理 selector_update 并自动保存
- `frontend/src/components/FlowEditor/index.tsx` — 监听 nodes 变化

---

### OPT-02：属性面板边框样式不统一 ✅

**问题**：属性面板下输入框边框为黑线，与整体风格不统一。

**修复方案**：
- [x] 将各处 `border` 统一为 `border-gray-200`
- [x] 涉及的文件：App.tsx、DebugLocatorModal.tsx、FlowEditor/index.tsx、Header.tsx、ConfirmDialog.tsx

**涉及文件**：
- `frontend/src/App.tsx`
- `frontend/src/components/FlowEditor/DebugLocatorModal.tsx`
- `frontend/src/components/FlowEditor/index.tsx`
- `frontend/src/components/Header.tsx`
- `frontend/src/components/common/ConfirmDialog.tsx`

---

### OPT-03：弹窗提醒样式超出浏览器范围 ✅

**问题**：Toast 弹窗使用 `top-4 right-4` 定位，在窄屏或特定浏览器中可能超出显示范围。

**修复方案**：
- [x] Toast 弹窗改为顶部居中定位：`top-4 left-1/2 -translate-x-1/2`
- [x] 已添加 `max-w-[90vw]` 限制最大宽度

**涉及文件**：
- `frontend/src/components/common/Toast.tsx`

---

### OPT-04：节点右侧无法拖出连接线 ✅

**问题**：当前节点样式下无法从右侧拖出连接线。

**根因**：`BaseNode.tsx` 中 source handle 的 CSS 设置了 `!right-[-7px]`（向外偏移 7px），可能被节点的 `overflow: hidden` 裁剪。

**修复方案**：
- [x] 移除 `BaseNode.tsx` 中的 `overflow-hidden`，改为默认可见
- [x] Handle 样式保持不变，`!right-[-7px]` 偏移已能正常显示

**涉及文件**：
- `frontend/src/components/FlowEditor/nodes/BaseNode.tsx` — 移除 `overflow-hidden`

---

### OPT-05：去除冗余的回退策略

**问题**：AI 定位中存在多余的回退策略代码。

**修复方案**：
- [ ] 审查 `locator.py` 中 `try_fallback_strategies()` 的各个策略，保留 CSS → AI 主链路，移除 `get_by_role`、`get_by_text` 等冗余回退
- [ ] 简化 `locate_with_ai()` 内部的重试逻辑，减少不必要的 AI 调用次数
- [ ] 移除 `_get_accessibility_snapshot()` 与 `extract_interactive_elements()` 的重复代码

**涉及文件**：
- `backend/engine/ai/locator.py`

---

### OPT-06：保存时弹出两个成功提示 ✅

**问题**：点击保存弹出两条 Toast。

**根因**：`FlowEditor/index.tsx` 的 `handleSave` 和 `App.tsx` 的 `handleSaveWorkflow` 各自调用了一次 `toast.success()`。

**修复方案**：
- [x] 移除 `FlowEditor/index.tsx` 中 `handleSave` 的 `toast.success('工作流已保存')`，只保留 `App.tsx` 中的提示

**涉及文件**：
- `frontend/src/components/FlowEditor/index.tsx` — `handleSave`

---

### OPT-07：等待秒数输入不能删为 0 ✅

**问题**：等待节点的秒数最小只能为 1，按删除键无法清空为 0；输入数字时会出现前导 0（如 "01"）。

**修复方案**：
- [x] 前端数字输入的 value 改为字符串类型，避免显示前导 0
- [x] 输入框为空时视为 0，onChange 时正确转换数字
- [x] 后端 `wait` action 对 `seconds <= 0` 直接跳过等待即可，无需报错

**涉及文件**：
- `frontend/src/components/FlowEditor/panels/NodePanel.tsx` — 数字字段渲染
- `backend/engine/actions/control.py` — `wait` action

---

### OPT-08：截图节点文件存储与查看

**问题**：截图保存的文件无法被专门存储和查看。

**修复方案**：
- [ ] 后端截图保存后，将文件相对路径记录在执行记录中
- [ ] 新增 API `GET /api/screenshots/{filename}` 提供静态文件访问
- [ ] 前端在执行记录的节点详情中展示截图缩略图，支持点击查看大图和下载
- [ ] 截图文件按工作流 ID + 执行 ID 分目录存储，便于管理和清理

**涉及文件**：
- `backend/engine/actions/browser.py` — `screenshot_action` 返回文件路径
- `backend/main.py` — 挂载静态文件路由
- `frontend/src/components/ExecutionPanel/` — 截图展示组件

---

### OPT-09：页面加载不全（滚动加载场景）

**问题**：疑似滚动加载（lazy-load）导致页面内容未完全加载。

**修复方案**：
- [ ] `scroll` action 增加 `wait_after_scroll` 参数，滚动后等待指定时间让懒加载内容渲染
- [ ] 新增 `scroll_to_load_all` action 或在 `scroll` 中增加模式：循环滚动到底部，每次滚动后等待新内容出现，直到页面高度不再变化
- [ ] `navigate` action 增加 `wait_until` 参数选项：`load` / `domcontentloaded` / `networkidle`，默认改为 `networkidle` 以等待异步请求完成

**涉及文件**：
- `backend/engine/actions/browser.py` — `scroll_action` 和 `navigate_action`

---

## 三、新增功能（P2）

### NEW-01：工作流触发 API + 服务级鉴权

**问题**：需要将工作流暴露为可外部调用的 API，支持 API Key 鉴权，并提供 Skill 调用方式。

**设计方案**：

#### 1. API 触发端点
```
POST /api/trigger/{workflow_id}
Headers: X-API-Key: <key>
Body: { "variables": { ... }, "headless": true }
Response: { "execution_id": "xxx", "status": "started" }
```

#### 2. 鉴权机制
- 新增 API Key 管理：生成、吊销、列表
- API Key 存储在本地 JSON 文件（`data/api_keys.json`），包含 key hash、创建时间、权限范围
- FastAPI 中间件拦截 `/api/trigger/*` 路由，校验 `X-API-Key` 请求头
- 内部 API（`/api/workflows`、`/api/executions`）暂不加鉴权，仅触发端点需要

#### 3. 执行结果获取
```
GET /api/trigger/{execution_id}/result
Headers: X-API-Key: <key>
Response: { "status": "completed", "results": { ... } }
```

#### 4. Skill 调用方式
- 提供 Claude Code Skill 文件模板，调用方通过 `curl` 或 SDK 触发工作流
- Skill 文件中封装触发 API 的调用方式和参数说明

**修复方案**：
- [ ] 新增 `backend/api/trigger.py` — 触发端点和结果查询端点
- [ ] 新增 `backend/auth/` — API Key 生成、存储、校验
- [ ] `backend/main.py` — 注册触发路由和鉴权中间件
- [ ] `backend/engine/executor.py` — 支持无 WebSocket 的纯 REST 执行模式（结果写入文件/内存，通过轮询获取）
- [ ] 新增 `docs/api/trigger.md` — 触发 API 文档
- [ ] 新增 Skill 模板文件

---

## 四、执行优先级与建议排期

| 优先级 | 编号 | 标题 | 难度 | 建议顺序 | 状态 |
|--------|------|------|------|----------|------|
| P0 | BUG-01 | 执行停止功能 | 中 | 1 | ✅ 已完成 |
| P0 | BUG-03 | 用户干预节点 | 高 | 2 | ✅ 已完成 |
| P0 | BUG-05 | 登录信息留存 | 中 | 3 | ✅ 已完成 |
| P0 | BUG-02 | 接口重复调用 | 低 | 4 | ✅ 已完成 |
| P0 | BUG-04 | 拖拽功能异常 | 中 | 5 | ✅ 已完成 |
| P1 | OPT-06 | 保存双重提示 | 低 | 6 | ✅ 已完成 |
| P1 | OPT-07 | 等待秒数限制 | 低 | 7 | ✅ 已完成 |
| P1 | OPT-01 | AI 定位精简+回填 | 高 | 8 | ✅ 已完成 |
| P1 | OPT-04 | 节点连线拖拽 | 低 | 9 | ✅ 已完成 |
| P1 | OPT-02 | 属性面板样式 | 低 | 10 | ✅ 已完成 |
| P1 | OPT-03 | 弹窗样式超出 | 低 | 11 | ✅ 已完成 |
| P1 | OPT-05 | 冗余回退策略 | 中 | 12 | 待处理 |
| P1 | OPT-08 | 截图存储查看 | 中 | 13 | 待处理 |
| P1 | OPT-09 | 滚动加载处理 | 中 | 14 | 待处理 |
| P2 | NEW-01 | 触发 API+鉴权 | 高 | 15 | 待处理 |

**建议**：
- ✅ P0 阻断性问题已全部完成
- ✅ OPT-01、OPT-02、OPT-03、OPT-04、OPT-06、OPT-07 优化已完成
- OPT-05、OPT-08、OPT-09 和 NEW-01（触发 API）待处理
