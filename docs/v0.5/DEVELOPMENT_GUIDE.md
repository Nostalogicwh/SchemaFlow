# v0.5 可执行开发指南

> **创建日期：** 2026-02-22
> **基于：** PLAN.md + 存在问题.md + 代码库现状分析
> **分支：** `dev/v0.5`（从 `dev/v0.4` 创建）

---

## 目录

- [问题汇总与优先级](#问题汇总与优先级)
- [Phase 1: 基础设施改造](#phase-1-基础设施改造)
- [Phase 2: 浏览器登录态方案（Client-Side Vault）](#phase-2-浏览器登录态方案client-side-vault)
- [Phase 3: 执行模式分离（编辑调试 vs 日常执行）](#phase-3-执行模式分离编辑调试-vs-日常执行)
- [Phase 4: 前端样式优化](#phase-4-前端样式优化)
- [验证清单](#验证清单)

---

## 问题汇总与优先级

| # | 问题 | 来源 | 优先级 | Phase |
|---|------|------|--------|-------|
| 1 | CDP 调试端口强制要求已废弃，需重新设计浏览器连接策略 | 存在问题#1 | P0 | 2 |
| 2 | 浏览器登录态无法继承 | PLAN CRITICAL-1 | P0 | 2 |
| 3 | 编辑调试与日常执行需分离 | 存在问题#3 | P1 | 3 |
| 4 | Python 后端改用 uv 管理 | 存在问题#4 | P1 | 1 |
| 5 | 侧边栏黑边 | PLAN STYLE-1 | P2 | 4 |
| 6 | 按钮缺少交互效果 | PLAN STYLE-3 | P2 | 4 |
| 7 | 运行与执行功能重复 | PLAN STYLE-4 | P2 | 4 |
| 8 | 创建工作流弹窗样式 | PLAN STYLE-5 | P2 | 4 |

> **注意：** 存在问题#2（节点左右连线）——`BaseNode.tsx` 已有左右 Handle，`showTargetHandle`/`showSourceHandle` 控制显隐，但前端样式上看不到右连线，用户无法编辑

---

## Phase 1: 基础设施改造

### 1.1 Python 后端改用 uv 管理

**目标：** 将 `requirements.txt` + `pip` + `venv` 迁移为 `uv` + `pyproject.toml`。

**操作步骤：**

#### Step 1: 创建 pyproject.toml

在 `backend/` 目录下创建 `pyproject.toml`：

```toml
[project]
name = "schemaflow-backend"
version = "0.5.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi==0.109.0",
    "uvicorn[standard]==0.27.0",
    "websockets==12.0",
    "playwright==1.58.0",
    "openai==1.10.0",
    "httpx==0.27.0",
    "pydantic==2.5.0",
    "aiofiles==23.2.1",
    "python-dotenv==1.0.0",
    "tomli==2.0.1",
]

[tool.uv]
python = "3.12"
```

> **注意：** 移除 `browser-use==0.1.0`——代码库中未实际使用该包。

#### Step 2: 迁移环境

```bash
cd backend
# 备份旧环境
mv .venv .venv.bak

# 用 uv 初始化
uv venv --python 3.12
uv pip install -e .
uv run playwright install chromium

# 验证
uv run python -c "import fastapi; print(fastapi.__version__)"
uv run python main.py  # 确认服务启动正常
```

#### Step 3: 更新 CLAUDE.md 中的命令

将所有 `pip install -r requirements.txt` 替换为 `uv pip install -e .`，
将 `source .venv/bin/activate && python` 替换为 `uv run python`。

#### Step 4: 更新 .gitignore

确认 `backend/.venv/` 已在 `.gitignore` 中；新增 `backend/uv.lock`（可选，如需锁定则提交）。

**涉及文件：**
- 新建：`backend/pyproject.toml`
- 删除：`backend/requirements.txt`（迁移完成后）
- 修改：`CLAUDE.md`、`backend/.gitignore`

**验证：**
```bash
cd backend && uv run python -c "
import sys; sys.path.insert(0,'.')
from config import get_settings
from engine.actions import base, browser, data, control
from engine.executor import WorkflowExecutor
print('uv 环境所有模块导入成功')
"
```

---

## Phase 2: 浏览器登录态方案（Client-Side Vault）

### 2.0 废弃 CDP 端口扫描方案

**当前问题：** `BrowserManager.connect()` 会扫描 `[9222, 9223, 9224, 9225, 9333]` 端口尝试 CDP 连接，但：
- 用户日常 Chrome 不开启调试端口
- 即使连上也是 Chrome for Testing，没有登录态
- 该方案已明确废弃

**操作：** 简化 `BrowserManager`，移除自动端口扫描逻辑，默认使用 headless 模式启动独立浏览器。CDP 连接仅作为高级用户的手动配置选项保留。

**涉及文件：**
- `backend/engine/browser_manager.py` — 重构 `connect()` 方法

**重构后的 connect 逻辑：**
```python
async def connect(self, context, headless: bool = True, storage_state=None):
    """
    启动浏览器。默认 headless 模式。
    storage_state: 可选，前端传入的凭证 JSON，直接注入 context。
    """
    self._playwright = await async_playwright().start()

    # 仅当用户在 settings 中明确配置了 cdp_url 时才尝试 CDP
    cdp_url = get_settings().get("browser", {}).get("cdp_url_manual")
    if cdp_url:
        try:
            browser = await self._playwright.chromium.connect_over_cdp(cdp_url)
            # ... CDP 逻辑保留但不自动扫描
        except Exception:
            await context.log(f"CDP 连接失败，回退到独立浏览器", "warning")

    # 默认路径：启动独立浏览器
    browser = await self._playwright.chromium.launch(headless=headless)

    if storage_state:
        self._context = await browser.new_context(storage_state=storage_state)
    else:
        self._context = await browser.new_context()

    self._page = await self._context.new_page()
```

---

### 2.1 后端改造

#### Step 1: 修改执行请求模型

**文件：** `backend/api/execution.py`

在执行请求中增加 `injected_storage_state` 字段：

```python
# 在 start_execution 的 WebSocket 消息处理中，扩展 start_execution 消息体
# 原消息格式: { "type": "start_execution", "workflow_id": "...", "mode": "..." }
# 新增字段:  { ..., "injected_storage_state": { cookies: [...], origins: [...] } | null }
```

#### Step 2: 将 storage_state 传入 BrowserManager

**文件：** `backend/engine/executor.py`

在 `_run_workflow()` 中，将前端传入的 `storage_state` 传递给 `browser_mgr.connect()`：

```python
# executor.py _run_workflow() 中：
storage_state = self._execution_params.get("injected_storage_state")
await browser_mgr.connect(context, headless=headless, storage_state=storage_state)
```

#### Step 3: 执行完毕后提取并下发凭证

**文件：** `backend/engine/executor.py`

在工作流执行完成后（cleanup 之前），提取 `storage_state` 并通过 WebSocket 下发：

```python
# 在 _run_workflow() 的 finally 块之前
if browser_mgr and browser_mgr._context:
    try:
        latest_state = await browser_mgr._context.storage_state()
        await self._send_ws_message({
            "type": "storage_state_update",
            "data": latest_state
        })
    except Exception:
        pass  # 非关键路径，不阻塞执行
```

#### Step 4: 登录态失效检测与人机协同

**文件：** 新建 `backend/engine/auth_detector.py`

```python
async def check_login_status(page, url: str) -> bool:
    """
    检测页面是否处于已登录状态。
    通过以下信号判断：
    1. URL 是否跳转到了 login/signin 页面
    2. 页面是否存在明显的登录表单
    """
    current_url = page.url.lower()
    login_keywords = ["login", "signin", "sign-in", "auth", "passport"]
    if any(kw in current_url for kw in login_keywords):
        return False

    # 检查是否有明显的登录表单
    login_form = await page.query_selector(
        'form[action*="login"], form[action*="signin"], '
        'input[type="password"]:visible'
    )
    return login_form is None
```

当检测到登录失效时，通过 WebSocket 发送人机协同请求：

```python
# executor.py 中，navigate 后检测
is_logged_in = await check_login_status(page, target_url)
if not is_logged_in:
    await self._send_ws_message({
        "type": "require_manual_login",
        "reason": "TOKEN_EXPIRED" if had_storage_state else "NO_CREDENTIALS",
        "url": target_url
    })
    # 等待前端确认登录完成（通过 WS 消息）
    await self._wait_for_login_confirmation()
```

---

### 2.2 前端改造

#### Step 1: 安装 localforage

```bash
cd frontend && npm install localforage
```

#### Step 2: 创建凭证存储服务

**文件：** 新建 `frontend/src/services/credentialStore.ts`

```typescript
import localforage from 'localforage'

const store = localforage.createInstance({
  name: 'schemaflow',
  storeName: 'credentials'
})

export interface StorageState {
  cookies: Array<{
    name: string
    value: string
    domain: string
    path: string
    expires: number
    httpOnly: boolean
    secure: boolean
    sameSite: string
  }>
  origins: Array<{
    origin: string
    localStorage: Array<{ name: string; value: string }>
  }>
}

// 按工作流 ID 存取凭证
export const credentialStore = {
  async get(workflowId: string): Promise<StorageState | null> {
    return store.getItem<StorageState>(`cred_${workflowId}`)
  },

  async save(workflowId: string, state: StorageState): Promise<void> {
    await store.setItem(`cred_${workflowId}`, state)
  },

  async remove(workflowId: string): Promise<void> {
    await store.removeItem(`cred_${workflowId}`)
  },

  async has(workflowId: string): Promise<boolean> {
    const val = await store.getItem(`cred_${workflowId}`)
    return val !== null
  },

  async clearAll(): Promise<void> {
    await store.clear()
  }
}
```

#### Step 3: 执行时注入凭证

**文件：** `frontend/src/hooks/useExecution.ts`

在 `send({ type: 'start_execution' })` 时附带凭证：

```typescript
// useExecution.ts 的 startExecution 中
const credentials = await credentialStore.get(workflowId)
send({
  type: 'start_execution',
  workflow_id: workflowId,
  mode: executionMode,
  injected_storage_state: credentials  // 可能为 null
})
```

#### Step 4: 接收并保存凭证更新

**文件：** `frontend/src/stores/executionStore.ts`

在 `handleMessage()` 中增加处理：

```typescript
case 'storage_state_update':
  // 保存后端下发的最新凭证
  if (message.data && currentWorkflowId) {
    credentialStore.save(currentWorkflowId, message.data)
  }
  break

case 'require_manual_login':
  // 设置状态，触发 UI 显示人机协同面板
  set({
    loginRequired: true,
    loginReason: message.reason,
    loginUrl: message.url
  })
  break
```

#### Step 5: 凭证管理 UI

**文件：** 新建 `frontend/src/components/CredentialManager.tsx`

在执行面板或工作流设置中展示凭证状态：

```
┌─────────────────────────────────┐
│ 🔐 登录凭证                      │
│                                   │
│  ○ chat.deepseek.com (无凭证)    │
│  ● github.com (已保存)  [清除]   │
│                                   │
│  [ ] 记住登录状态                 │
│  (凭证仅保存在浏览器本地缓存中)    │
└─────────────────────────────────┘
```

---

### 2.3 人机协同登录流程 UI

**文件：** 新建 `frontend/src/components/ExecutionPanel/LoginAssistPanel.tsx`

当 `executionStore.loginRequired === true` 时，在 ExecutionPanel 中显示：

```
┌─────────────────────────────────────────┐
│ ⚠️ 需要手动登录                          │
│                                           │
│ 目标网站需要登录，请在下方截图中完成登录    │
│ 操作。系统将自动检测登录完成并继续执行。    │
│                                           │
│ ┌─────────────────────────────────────┐  │
│ │          (实时截图区域)              │  │
│ │     显示后端推流的浏览器画面          │  │
│ └─────────────────────────────────────┘  │
│                                           │
│   [已完成登录]    [跳过]    [取消执行]    │
└─────────────────────────────────────────┘
```

用户点击「已完成登录」后，前端发送 WebSocket 消息：
```json
{ "type": "login_confirmed" }
```

后端收到后继续执行工作流。

---

## Phase 3: 执行模式分离（编辑调试 vs 日常执行）

### 3.0 设计思路

**当前状态：** App.tsx 三栏布局（工作流列表 | 画布编辑器 | 执行监控），所有操作在同一视图。

**目标：** 区分两种使用场景：

| 场景 | 需要的信息 | 不需要的信息 |
|------|-----------|-------------|
| 编辑调试 | 画布、节点属性、实时截图、日志 | — |
| 日常执行 | 工作流概要、执行状态、节点记录、日志 | 画布拖拽编辑 |

### 3.1 方案：执行面板增加「简洁模式」

不做大规模布局重构，而是在现有执行面板中增加模式切换：

#### Step 1: 执行面板模式扩展

**文件：** `frontend/src/components/ExecutionPanel/index.tsx`

增加一个 `viewMode` 状态：`'debug'`（调试模式，当前样式）和 `'compact'`（简洁模式）。

**简洁模式下的 ExecutionPanel 布局：**

```
┌────────────────────────────────────┐
│ 工作流名称           [调试] [简洁] │
├────────────────────────────────────┤
│ 📋 节点列表（纵向排列）            │
│                                     │
│  1. ✅ 开始                         │
│  2. ✅ 打开页面 - deepseek.com     │
│  3. 🔄 点击输入框                   │
│  4. ⏳ 输入文本                     │
│  5. ○  截图                         │
│  6. ○  结束                         │
│                                     │
├────────────────────────────────────┤
│ 📸 实时截图（大图展示）             │
│ ┌────────────────────────────────┐ │
│ │                                │ │
│ │        浏览器截图              │ │
│ │                                │ │
│ └────────────────────────────────┘ │
├────────────────────────────────────┤
│ 📝 日志                            │
│ [10:30:01] 正在打开页面...          │
│ [10:30:03] 页面加载完成             │
│ [10:30:04] 正在查找元素...          │
└────────────────────────────────────┘
```

#### Step 2: Header 中增加执行入口

**文件：** `frontend/src/components/Header.tsx`

在执行按钮旁增加模式选择。当用户从「简洁模式」发起执行时，画布区域可以收起或不渲染，节省资源。

#### Step 3: 工作流列表增加快捷执行

**文件：** `frontend/src/components/WorkflowList/index.tsx`

在列表项 hover 时显示「▶ 快速执行」按钮，点击直接以简洁模式执行：

```typescript
// WorkflowList 列表项增加执行按钮
<button
  onClick={(e) => {
    e.stopPropagation()
    onQuickExecute(workflow.id)  // 选中 + 切换到简洁执行模式 + 开始执行
  }}
  title="快速执行"
>
  <Play size={14} />
</button>
```

**涉及文件：**
- `frontend/src/components/ExecutionPanel/index.tsx` — 增加 viewMode 切换
- `frontend/src/components/Header.tsx` — 增加模式切换 UI
- `frontend/src/components/WorkflowList/index.tsx` — 增加快捷执行按钮
- `frontend/src/stores/executionStore.ts` — 增加 viewMode 状态

---

## Phase 4: 前端样式优化

### 4.1 STYLE-1: 侧边栏黑边

**问题：** 侧边栏组件存在黑色边框，视觉违和。

**文件与修改：**
- `frontend/src/components/FlowEditor/panels/Toolbar.tsx` — 查找 `border-black` 或类似深色边框类
- `frontend/src/components/FlowEditor/panels/NodePanel.tsx` — 同上
- `frontend/src/components/ExecutionPanel/index.tsx` — 同上

**统一方案：** 使用 designTokens 中定义的语义化边框色：
```
替换：border-black, border-gray-800, border-gray-700 等
为：  border-gray-200（浅色主题）
或：  shadow-sm 替代边框
```

参考 `designTokens.ts` 中 `twSemanticColors.border`。

### 4.2 STYLE-3: 按钮交互效果

**问题：** 部分按钮缺少 hover/active 状态反馈。

**当前状态：** `Button.tsx` 已有基础交互效果（v0.4 增强过），但非 Button 组件的按钮（如 FlowEditor 中的保存按钮、WorkflowList 中的操作按钮）缺失。

**操作：**
1. 全局搜索 `<button` 标签（非 `<Button` 组件），逐一替换为 `Button` 组件或添加交互类
2. 重点检查：
   - `FlowEditor/index.tsx:304-308` — 保存按钮是原生 `<button>`，应换成 `Button` 组件
   - `WorkflowList/index.tsx` — 删除按钮
   - `Header.tsx` — 检查所有操作按钮

**统一交互类模板：**
```
transition-all duration-150
hover:bg-gray-100
active:scale-[0.97]
focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1
```

### 4.3 STYLE-4: 运行与执行功能重复

**问题：** Header 中同时存在"运行"和"执行"术语，造成用户困惑。

**当前状态分析：**
- Header.tsx 中 `ExecuteButton` 显示的文字为 "运行"/"停止"/"再次运行"/"重试"
- Toolbar.tsx 中「AI 编排」有"生成工作流"按钮，无执行按钮
- WorkflowList 无执行按钮

**实际情况：** 经代码分析，当前不存在两个独立的执行入口。如果用户感到困惑，可能是 UI 术语不统一。

**操作：**
1. 统一全部使用「执行」术语（更专业）
2. 如果 Header 中 ExecuteButton 使用了"运行"，统一改为"执行"/"停止"/"重新执行"
3. 搜索全部中文文案，统一替换

### 4.4 STYLE-5: 创建工作流弹窗样式

**问题：** 创建工作流的 Modal 样式粗糙。

**文件：** `frontend/src/components/WorkflowList/index.tsx` 中的创建弹窗。

**操作：**
1. 确认使用的是 `ui/Modal.tsx` 组件（而非原生 DOM）
2. 优化 Modal 内部表单布局：
   - 使用 `FormField` 组件包裹输入框
   - 添加合理的 padding（参考 designTokens spacing）
   - 确认 Modal 的 `size` prop 合适（建议 `md`）
3. 表单字段优化：
   - 工作流名称输入框使用 `Input` 组件
   - 描述字段使用 `Textarea` 组件
   - 底部按钮使用 `Button` 组件的 `primary` 和 `secondary` 变体

---

## 验证清单

### Phase 1 验证
```bash
# uv 环境验证
cd backend && uv run python -c "
import sys; sys.path.insert(0,'.')
from config import get_settings
from engine.actions import base, browser, data, control
from engine.executor import WorkflowExecutor
from api.websocket import manager
from repository import get_execution_repo
print('所有模块导入成功')
"

# 后端启动验证
cd backend && uv run python main.py  # 确认启动无报错
```

### Phase 2 验证
```bash
# 后端语法检查（涉及文件）
cd backend && .venv/bin/python -c "
import py_compile
files = [
    'engine/browser_manager.py',
    'engine/executor.py',
    'engine/auth_detector.py',
    'api/execution.py',
]
for f in files:
    py_compile.compile(f, doraise=True)
    print(f'OK: {f}')
"

# 前端类型检查
cd frontend && npx tsc --noEmit

# 前端 lint
cd frontend && npm run lint
```

**功能验证：**
1. 不传凭证 → 应使用 headless 浏览器正常执行
2. 手动登录后 → 前端 IndexedDB 中应保存凭证
3. 再次执行同工作流 → 应自动注入凭证，跳过登录
4. 清除凭证后 → 应重新要求登录
5. 使用过期凭证 → 应检测到并触发人机协同登录

### Phase 3 验证
- 简洁模式下能看到节点列表、截图、日志
- 调试模式下保持原有画布编辑功能
- 快捷执行能正确选中工作流并开始执行

### Phase 4 验证
- 所有侧边栏无黑边
- 所有按钮有 hover/active 反馈
- 全局无"运行"/"执行"术语混用
- 创建工作流弹窗样式统一

### 最终验证
```bash
# 后端全量语法检查
cd backend && uv run python -c "
import py_compile, glob
for f in glob.glob('**/*.py', recursive=True):
    if '.venv' in f: continue
    py_compile.compile(f, doraise=True)
    print(f'OK: {f}')
"

# 前端完整构建
cd frontend && npm run build

# 集成测试
cd backend && uv run python test_backend.py
```

---

## 开发顺序建议

```
Phase 1 (基础设施) ──→ Phase 2 (登录态) ──→ Phase 3 (模式分离) ──→ Phase 4 (样式)
       │                    │                     │                     │
       │                    ├── 2.0 废弃CDP扫描   ├── 3.1 面板模式      ├── 4.1 黑边
       │                    ├── 2.1 后端改造       ├── 3.2 Header切换    ├── 4.2 按钮
       └── 1.1 uv迁移      ├── 2.2 前端凭证存储   └── 3.3 快捷执行      ├── 4.3 术语
                            └── 2.3 人机协同UI                           └── 4.4 弹窗
```

Phase 4 的各子任务之间无依赖，可并行开发。Phase 2 和 Phase 3 有部分重叠（执行面板改造），建议 Phase 2 先完成后端部分，再与 Phase 3 一起做前端改造。
