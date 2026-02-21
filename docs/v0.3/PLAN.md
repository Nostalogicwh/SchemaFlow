# V0.3 可执行计划 - 架构重构 + 功能补全 + 样式优化

## 目标

对前后端进行架构重构，补全 MVP 缺失功能，全面优化视觉样式。为后续功能扩展打好基础。

---

## 总览

| 模块 | 内容 | 优先级 |
|------|------|--------|
| A. 后端架构重构 | executor 拆分、依赖注入、async 修正、代码去重 | 高 |
| B. 前端架构重构 | Zustand 状态管理、hook 拆分、错误处理体系 | 高 |
| C. 功能补全 | Browser Use 集成、操作录制、缺失节点类型 | 中 |
| D. 样式优化 | 节点视觉升级、整体 UI 美化、交互体验 | 中 |

---

## A. 后端架构重构

### A1. 拆分 executor.py

#### 现状

`executor.py` 的 `_run_workflow` 方法 160+ 行，混合了浏览器初始化、节点执行循环、记录保存、WebSocket 通信四个关注点。

#### 目标

拆分为三个职责清晰的模块：

| 新模块 | 职责 | 从 executor.py 提取的代码 |
|--------|------|--------------------------|
| `engine/browser_manager.py` | 浏览器生命周期管理 | `_run_workflow` 第 136-169 行（CDP 连接 + 降级启动）、`_cleanup` 全部 |
| `engine/executor.py`（精简） | 工作流编排调度 | 保留拓扑排序、执行循环、变量解析 |
| `engine/execution_recorder.py` | 执行记录构建和持久化 | `_save_execution_record`、节点 record 创建和更新逻辑 |

#### 涉及文件

| 文件 | 改动 |
|------|------|
| `backend/engine/browser_manager.py`（新建） | BrowserManager 类：`async connect()`, `async cleanup()` |
| `backend/engine/execution_recorder.py`（新建） | ExecutionRecorder 类：`start_node()`, `complete_node()`, `fail_node()`, `save()` |
| `backend/engine/executor.py` | 精简为编排逻辑，依赖 BrowserManager 和 ExecutionRecorder |
| `backend/engine/__init__.py` | 导出新模块 |

#### 实施步骤

1. **创建 BrowserManager**

```python
class BrowserManager:
    """浏览器连接和生命周期管理。"""

    async def connect(self, cdp_url: str, headless: bool = True) -> tuple:
        """连接浏览器，返回 (browser, page, is_cdp, reused_page)。"""
        # 从 executor._run_workflow 第 136-169 行提取

    async def cleanup(self, context: ExecutionContext):
        """清理浏览器资源。"""
        # 从 executor._cleanup 提取
```

2. **创建 ExecutionRecorder**

```python
class ExecutionRecorder:
    """执行记录的构建和持久化。"""

    def start_node(self, node_id, node_type, node_label) -> NodeExecutionRecord:
        """创建并返回节点执行记录。"""

    def complete_node(self, record, result, context_logs):
        """标记节点完成。"""

    def fail_node(self, record, error, context_logs):
        """标记节点失败。"""

    async def save(self, context, workflow):
        """持久化到 repository。"""
        # 从 executor._save_execution_record 提取
```

3. **精简 WorkflowExecutor**

`_run_workflow` 简化为：

```python
async def _run_workflow(self, context, workflow, headless=True):
    # 1. 浏览器连接
    browser_mgr = BrowserManager()
    await browser_mgr.connect(context, headless)

    # 2. 拓扑排序
    execution_order = topological_sort(...)

    # 3. 逐节点执行
    recorder = ExecutionRecorder()
    for node_id in execution_order:
        record = recorder.start_node(...)
        try:
            result = await execute_func(context, resolved_config)
            recorder.complete_node(record, result, context.logs)
        except Exception as e:
            recorder.fail_node(record, str(e), context.logs)
            raise

    # 4. 保存记录
    await recorder.save(context, workflow)
```

---

### A2. 提取公共工具函数

#### 现状

- **元素定位逻辑** 在 `browser.py` 的 `click_action`、`input_text_action`、`paste_from_clipboard` 中重复 3 次
- **变量解析逻辑** 在 `executor.py` 和 `data.py` 中各有一份

#### 涉及文件

| 文件 | 改动 |
|------|------|
| `backend/engine/actions/utils.py`（新建） | `locate_element()` 和 `resolve_variables()` 公共函数 |
| `backend/engine/actions/browser.py` | click、input_text、paste 改为调用 `locate_element()` |
| `backend/engine/actions/data.py` | 变量解析改为调用公共函数 |
| `backend/engine/executor.py` | `_resolve_variables` 改为调用公共函数 |

#### 实施步骤

1. **创建 utils.py**

```python
async def locate_element(page, selector: str = None, ai_target: str = None):
    """统一的元素定位函数。

    优先使用 selector，若为空则使用 ai_target 语义定位。
    """
    if selector:
        return page.locator(selector)
    if ai_target:
        return await _locate_by_ai_target(page, ai_target)
    raise ValueError("必须提供 selector 或 ai_target")


async def _locate_by_ai_target(page, ai_target: str):
    """基于语义描述定位元素。"""
    # 从 browser.py 提取已有逻辑
    strategies = [
        lambda: page.get_by_role("button", name=ai_target),
        lambda: page.get_by_role("link", name=ai_target),
        lambda: page.get_by_text(ai_target, exact=False),
        lambda: page.get_by_placeholder(ai_target),
        lambda: page.locator(f"[aria-label*='{ai_target}']"),
    ]
    for strategy in strategies:
        try:
            locator = strategy()
            if await locator.count() > 0:
                return locator.first
        except Exception:
            continue
    raise ValueError(f"无法定位元素: {ai_target}")
```

2. **browser.py 中三处定位逻辑替换为**：

```python
from .utils import locate_element
element = await locate_element(context.page, config.get("selector"), config.get("ai_target"))
```

---

### A3. Storage 层 async 修正 + 原子写入

#### 现状

`storage/file_storage.py` 的 `_read_index()` 和 `_write_index()` 使用同步 `open()` 读写文件，在 async 方法中阻塞事件循环。index 文件的读写无原子性保证。

#### 涉及文件

| 文件 | 改动 |
|------|------|
| `backend/storage/file_storage.py` | `_read_index` / `_write_index` 改为 async，使用 aiofiles；写入改为 temp+rename 原子操作 |
| `backend/requirements.txt` | 添加 `aiofiles` 依赖 |

#### 实施步骤

1. 安装 `aiofiles`，添加到 requirements.txt

2. 修改 `_read_index` 和 `_write_index`：

```python
import aiofiles
import tempfile

async def _read_index(self) -> dict:
    """异步读取索引文件。"""
    if not self.index_path.exists():
        return {"workflows": []}
    async with aiofiles.open(self.index_path, 'r', encoding='utf-8') as f:
        content = await f.read()
        return json.loads(content)

async def _write_index(self, index: dict):
    """原子写入索引文件。"""
    # 写入临时文件后 rename，避免竞态条件
    tmp_fd, tmp_path = tempfile.mkstemp(dir=str(self.index_path.parent), suffix='.tmp')
    try:
        async with aiofiles.open(tmp_path, 'w', encoding='utf-8') as f:
            await f.write(json.dumps(index, ensure_ascii=False, indent=2))
        os.replace(tmp_path, str(self.index_path))
    except Exception:
        os.unlink(tmp_path)
        raise
    finally:
        os.close(tmp_fd)
```

3. 所有调用 `_read_index` / `_write_index` 的地方加上 `await`

---

### A4. 全局单例改为 FastAPI 依赖注入

#### 现状

```python
# execution.py:17
executor = WorkflowExecutor()

# workflows.py:15
storage = JSONFileStorage()

# websocket.py:85
manager = ConnectionManager()
```

全局变量无法正确控制生命周期，测试困难。

#### 涉及文件

| 文件 | 改动 |
|------|------|
| `backend/dependencies.py`（新建） | 定义 `get_executor()`、`get_storage()`、`get_ws_manager()` |
| `backend/api/execution.py` | 用 `Depends(get_executor)` 替代全局 `executor` |
| `backend/api/workflows.py` | 用 `Depends(get_storage)` 替代全局 `storage` |
| `backend/api/websocket.py` | 用 `Depends(get_ws_manager)` 替代全局 `manager` |
| `backend/main.py` | 注册 lifespan 进行初始化和清理 |

#### 实施步骤

```python
# dependencies.py
from functools import lru_cache

@lru_cache()
def get_executor():
    return WorkflowExecutor()

@lru_cache()
def get_storage():
    return JSONFileStorage()

@lru_cache()
def get_ws_manager():
    return ConnectionManager()
```

API 端点改为：

```python
@router.post("/workflows/{workflow_id}/execute")
async def execute_workflow(
    workflow_id: str,
    executor: WorkflowExecutor = Depends(get_executor),
    storage: StorageBase = Depends(get_storage),
):
    ...
```

---

### A5. 常量和枚举提取

#### 现状

超时值、节点状态、消息类型散落在各处，使用硬编码字符串。

#### 涉及文件

| 文件 | 改动 |
|------|------|
| `backend/engine/constants.py`（新建） | 定义所有常量和枚举 |
| 相关引用文件 | 替换硬编码值 |

#### 内容

```python
# constants.py
from enum import Enum

class NodeStatus(str, Enum):
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"

class WSMessageType(str, Enum):
    EXECUTION_STARTED = "execution_started"
    NODE_START = "node_start"
    NODE_COMPLETE = "node_complete"
    SCREENSHOT = "screenshot"
    LOG = "log"
    ERROR = "error"
    EXECUTION_COMPLETE = "execution_complete"
    EXECUTION_CANCELLED = "execution_cancelled"
    USER_INPUT_REQUIRED = "user_input_required"

# 默认超时（毫秒）
DEFAULT_ELEMENT_TIMEOUT_MS = 30000
DEFAULT_WAIT_TIMEOUT_S = 30
DEFAULT_USER_INPUT_TIMEOUT_S = 300
DEFAULT_LLM_TIMEOUT_S = 120

# 截图质量
SCREENSHOT_QUALITY = 60
```

---

### A6. 异常处理精细化

#### 现状

大量 `except Exception` 吞掉具体错误，调试困难。

#### 涉及文件

各 `engine/actions/*.py`、`executor.py`、`storage/file_storage.py`

#### 实施步骤

1. 定义自定义异常层级：

```python
# engine/exceptions.py
class SchemaFlowError(Exception):
    """基础异常。"""

class NodeExecutionError(SchemaFlowError):
    """节点执行错误。"""
    def __init__(self, node_id: str, node_type: str, message: str):
        self.node_id = node_id
        self.node_type = node_type
        super().__init__(f"节点 {node_id}({node_type}) 执行失败: {message}")

class BrowserConnectionError(SchemaFlowError):
    """浏览器连接错误。"""

class ElementNotFoundError(SchemaFlowError):
    """元素定位失败。"""

class WorkflowValidationError(SchemaFlowError):
    """工作流校验错误。"""
```

2. 在各处替换 `except Exception` 为具体异常类型

---

## B. 前端架构重构

### B1. 引入 Zustand 状态管理

#### 现状

所有状态集中在 `App.tsx`，通过 props 逐层传递。`App.tsx` 持有 7 个 state + 6 个 callback，组件间通信全靠 props drilling。

#### 涉及文件

| 文件 | 改动 |
|------|------|
| `frontend/src/stores/workflowStore.ts`（新建） | 工作流相关状态：当前工作流、列表 |
| `frontend/src/stores/executionStore.ts`（新建） | 执行相关状态：执行状态、WebSocket |
| `frontend/src/stores/uiStore.ts`（新建） | UI 状态：面板显隐、执行模式 |
| `frontend/src/App.tsx` | 大幅精简，只做布局 |
| 所有组件 | 从 store 直接读取状态，不再通过 props |

#### 实施步骤

1. 安装 Zustand：`npm install zustand`

2. 创建 stores：

```typescript
// stores/workflowStore.ts
import { create } from 'zustand'

interface WorkflowState {
  selectedId: string | null
  currentWorkflow: Workflow | null
  listVersion: number
  selectWorkflow: (id: string) => Promise<void>
  createWorkflow: (name: string) => Promise<void>
  saveWorkflow: (workflow: Workflow) => Promise<void>
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  selectedId: null,
  currentWorkflow: null,
  listVersion: 0,
  selectWorkflow: async (id) => { ... },
  createWorkflow: async (name) => { ... },
  saveWorkflow: async (workflow) => { ... },
}))
```

```typescript
// stores/executionStore.ts
import { create } from 'zustand'

interface ExecutionState {
  isConnected: boolean
  executionState: ExecutionState
  connect: (executionId: string, workflowId: string) => void
  startExecution: (workflowId: string, mode: string) => void
  stopExecution: () => void
  respondUserInput: (response: string) => void
  reset: () => void
}
```

3. 各组件直接使用 store：

```typescript
// 组件中直接调用，无需 props
const { currentWorkflow, saveWorkflow } = useWorkflowStore()
const { executionState } = useExecutionStore()
```

---

### B2. 拆分 useWebSocket

#### 现状

`useWebSocket.ts` 271 行，11 分支的 switch，同时管理连接、消息处理、状态更新。

#### 涉及文件

| 文件 | 改动 |
|------|------|
| `frontend/src/hooks/useWebSocket.ts` | 精简为纯连接管理 |
| `frontend/src/services/websocketService.ts`（新建） | WebSocket 连接和消息收发 |
| `frontend/src/stores/executionStore.ts` | 消息处理逻辑移入 store |

#### 实施步骤

1. 将 WebSocket 连接管理提取为独立 service class
2. 消息路由和状态更新移入 executionStore
3. useWebSocket hook 精简为调用 service 和 store 的薄层

---

### B3. 错误处理体系

#### 现状

全局使用 `alert()` / `confirm()` / `console.error()`，无错误边界。

#### 涉及文件

| 文件 | 改动 |
|------|------|
| `frontend/src/components/common/Toast.tsx`（新建） | Toast 通知组件 |
| `frontend/src/components/common/ErrorBoundary.tsx`（新建） | React Error Boundary |
| `frontend/src/components/common/ConfirmDialog.tsx`（新建） | 确认对话框替代 confirm() |
| `frontend/src/stores/uiStore.ts` | Toast 状态管理 |
| 所有使用 alert/confirm 的地方 | 替换为 Toast / ConfirmDialog |

#### 实施步骤

1. 创建 Toast 组件（支持 success/error/info 三种类型）
2. 在 uiStore 中管理 toast 队列
3. 创建 ErrorBoundary 包裹 FlowEditor 和 ExecutionPanel
4. 创建 ConfirmDialog 替代 `window.confirm()`
5. 全局替换 alert → toast.success/toast.error

---

### B4. 公共样式和常量提取

#### 现状

`statusStyles` 在 BaseNode、StartNode、EndNode 中重复定义。图标 map 在各节点组件中硬编码。

#### 涉及文件

| 文件 | 改动 |
|------|------|
| `frontend/src/constants/nodeStyles.ts`（新建） | statusStyles、categoryColors、iconMap |
| `frontend/src/components/FlowEditor/nodes/*.tsx` | 引用公共常量 |

---

## C. 功能补全

### C1. Browser Use 集成（或等效 AI 自动化能力）

#### 现状

设计文档中的 `ai_action` 节点已移除。`ai_target` 使用 Playwright 语义定位器实现了基础功能，但缺少真正的 AI 驱动浏览器自动化能力。

#### 方案选择

| 方案 | 说明 | 优劣 |
|------|------|------|
| A. 集成 browser-use | 使用 browser-use 库 | 功能强大，但依赖不稳定（PyPI 版本问题） |
| B. 集成 Playwright MCP | 用 MCP 协议调 Playwright | 生态新，文档少 |
| C. 自研 LLM+Playwright | LLM 分析截图/DOM → 生成 Playwright 操作 | 可控性强，工作量大 |

**推荐方案 C**：自研轻量方案，LLM 接收页面截图 + 简化 DOM 结构，返回操作指令。与现有架构无缝集成。

#### 涉及文件

| 文件 | 改动 |
|------|------|
| `backend/engine/actions/ai.py`（新建） | 恢复 `ai_action` 节点 |
| `backend/engine/ai_driver.py`（新建） | LLM 驱动的浏览器操作引擎 |
| `frontend/src/components/FlowEditor/nodes/AINode.tsx`（新建） | AI 节点前端组件 |

#### 核心流程

```
ai_action 节点执行：
1. 截取当前页面截图
2. 提取页面简化 DOM（可交互元素列表）
3. 发送给 LLM："根据截图和 DOM，执行用户指令: {prompt}"
4. LLM 返回操作序列：[{"action": "click", "selector": "..."}, ...]
5. 逐步执行操作，每步后截图反馈
6. 循环直到任务完成或达到最大步数
```

---

### C2. 操作录制功能

#### 现状

设计文档中规划了 `engine/recorder.py`，但未实现。

#### 涉及文件

| 文件 | 改动 |
|------|------|
| `backend/engine/recorder.py`（新建） | 操作录制器 |
| `backend/api/recording.py`（新建） | 录制 API 端点 |
| `frontend/src/components/RecordingPanel/`（新建） | 录制 UI |

#### 核心流程

```
1. 用户点击"开始录制"
2. 后端通过 CDP 监听浏览器事件（click, input, navigation）
3. 将事件转换为工作流节点
4. 通过 WebSocket 实时推送新录制的节点到前端画布
5. 用户点击"停止录制"，生成完整工作流
```

#### 实施步骤

1. 基于 Playwright 的 CDP session 监听 DOM 事件
2. 事件 → 节点的映射规则：
   - click 事件 → click 节点（自动提取 CSS selector）
   - input 事件 → input_text 节点
   - navigation 事件 → navigate 节点
3. WebSocket 实时推送录制事件
4. 前端实时添加节点到画布

---

### C3. 补全缺失节点类型

#### 现状

设计文档规划了 16 种节点，当前实现 12 种，缺 5 种。

| 节点 | 类型 | 所属分类 |
|------|------|---------|
| 切换标签页 | `switch_tab` | browser |
| 关闭标签页 | `close_tab` | browser |
| 下拉选择 | `select_option` | browser |
| 滚动 | `scroll` | browser |
| 自定义脚本 | `custom_script` | data |

#### 涉及文件

| 文件 | 改动 |
|------|------|
| `backend/engine/actions/browser.py` | 添加 switch_tab、close_tab、select_option、scroll |
| `backend/engine/actions/data.py` | 添加 custom_script |

#### 各节点实现要点

**switch_tab**：

```python
@register_action(
    name="switch_tab",
    label="切换标签页",
    category="browser",
    parameters={
        "index": {"type": "integer", "description": "标签页索引（从 0 开始）"},
        "title_match": {"type": "string", "description": "按标题匹配（模糊匹配）"},
    }
)
async def switch_tab_action(context, config):
    pages = context.browser.contexts[0].pages
    # 按 index 或 title_match 切换
```

**close_tab**：关闭当前页面，切换到上一个页面。

**select_option**：`page.locator(selector).select_option(value)`

**scroll**：`page.evaluate("window.scrollBy(0, {pixels})")`

**custom_script**：使用 `exec()` 在沙箱环境中执行用户脚本，通过 context.variables 共享变量。

---

## D. 样式优化

### D1. 整体设计语言

#### 现状

当前 UI 使用原生 Tailwind 类名堆叠，视觉上接近默认 HTML 样式：
- 按钮是纯色块，无层次感
- 节点是简单圆角矩形，分类仅靠背景色区分
- 无 loading 动画、空状态提示粗糙
- 整体配色偏灰，缺乏品牌感

#### 设计方向

采用现代化的 **浅色主题 + 蓝色主色调**，参考 n8n / Retool 等编排类产品风格：
- 圆润的卡片式布局
- 节点使用图标 + 颜色条区分分类
- 执行状态用动画而非纯色环表现
- 操作按钮有明确的视觉层级

### D2. 节点样式升级

#### 涉及文件

| 文件 | 改动 |
|------|------|
| `frontend/src/components/FlowEditor/nodes/BaseNode.tsx` | 全新节点样式 |
| `frontend/src/components/FlowEditor/nodes/StartNode.tsx` | 特殊起止节点样式 |
| `frontend/src/components/FlowEditor/nodes/EndNode.tsx` | 特殊起止节点样式 |

#### 改进点

1. **节点卡片**：添加左侧分类色条、图标更大更清晰、增加节点描述行
2. **连接点（Handle）**：增大可点击区域，hover 时高亮
3. **状态动画**：running 时节点边框流光效果，completed 时短暂绿色闪烁
4. **选中态**：明显的蓝色外框 + 轻微放大

### D3. 顶部导航优化

#### 改进点

- 添加 Logo / 品牌标识
- 工作流名称可点击编辑
- 执行按钮增加图标，区分状态（就绪 / 执行中 / 完成）
- 模式选择改为 toggle 按钮组而非 select

### D4. 侧边栏优化

#### 改进点

**左侧工作流列表**：
- 添加搜索/过滤功能
- 列表项增加最后修改时间
- 当前选中项高亮更明显
- 空列表增加引导提示

**左侧工具栏（Toolbar）**：
- 节点分组折叠/展开
- 节点拖拽时显示 ghost 预览
- AI 编排输入框样式美化

### D5. 执行面板优化

#### 改进点

- 截图区域增加缩放手势
- 节点执行记录增加时间线视图
- 日志区域支持按级别过滤
- 用户输入对话框改为 modal 样式

### D6. 空状态和加载状态

#### 涉及文件

| 文件 | 改动 |
|------|------|
| `frontend/src/components/common/EmptyState.tsx`（新建） | 空状态组件 |
| `frontend/src/components/common/LoadingSpinner.tsx`（新建） | 加载动画组件 |

#### 场景覆盖

| 场景 | 当前 | 改进 |
|------|------|------|
| 未选择工作流 | "选择或创建一个工作流开始" 纯文字 | 插图 + 引导按钮 |
| 工作流列表为空 | 无提示 | "还没有工作流，创建第一个吧" + 按钮 |
| AI 编排生成中 | "生成中..." 文字 | 带动画的 loading 指示器 |
| 执行面板无数据 | 空白 | "点击执行按钮开始" 提示 |
| 节点属性未选中节点 | "选择一个节点查看属性" | 带图标的提示 |

### D7. 响应式布局

- 侧边栏可折叠/展开
- 小屏时自动隐藏 MiniMap
- 移动端基础适配（只读模式）

---

## 实施顺序

| 阶段 | 任务 | 依赖 |
|------|------|------|
| **P0** | A5 常量枚举提取 + A6 异常类定义 | 无（基础设施，后续步骤依赖） |
| **P1** | A1 拆分 executor | P0 |
| **P2** | A2 公共工具函数 | P1 |
| **P3** | A3 Storage async 修正 | 无 |
| **P4** | A4 依赖注入 | P1 |
| **P5** | B1 Zustand 状态管理 | 无 |
| **P6** | B2 拆分 useWebSocket | P5 |
| **P7** | B3 错误处理体系 | P5 |
| **P8** | B4 公共样式常量 | 无 |
| **P9** | D1-D7 样式优化 | P5, P7, P8（需要新组件体系就绪） |
| **P10** | C3 补全缺失节点 | P0, P2 |
| **P11** | C1 Browser Use 集成 | P1, P2 |
| **P12** | C2 操作录制 | P1, P5 |

后端重构（P0-P4）和前端重构（P5-P8）可并行推进。样式优化（P9）在前端重构完成后进行。功能补全（P10-P12）在架构稳定后进行。

---

## V0.4 待办（不在本版本范围）

- 单元测试框架搭建
- 前端组件测试
- E2E 测试
- 集成测试
