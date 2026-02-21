# V0.2.2 可执行计划

## 原始问题清单

1. 打开新标签页、跳转页面是打开新窗口，还是需要重新登录
2. 进入 backend 没有自动激活虚拟环境
3. 编辑工作流新增节点时，容易直接替换掉原节点
4. CSS 选择器对用户不友好
5. ai_target 需要集成 browser-use，建议给所有节点加上 AI 定位
6. 新增工作流后不会刷新列表
7. 工作流编辑保存后，画布排版会乱
8. 拖拽节点不会放置在光标位置
9. 自动生成工作流功能异常，接口报 500，缺乏有效日志

---

## 问题 1：open_tab 打开新窗口导致登录态丢失

### 根因分析

`browser.py:43` 中 `open_tab_action` 在 `context.page is None` 时调用 `context.browser.new_page()`，但正常情况下 page 已存在，直接在当前页面 `goto`。实际上 `open_tab` 和 `navigate` 行为几乎一样——都是在当前 page 上 `goto`。如果用户期望 open_tab 打开新标签页，则需要在同一 BrowserContext 下 `new_page()`，但这会丢失 sessionStorage。

V0.2.1 已实现 CDP 页面复用，当前 open_tab 在 page 存在时直接 goto 不会开新窗口。问题可能已解决。

### 解决方案

确认 open_tab 在 CDP 模式下的行为：当 page 已存在时，直接在当前页面导航（与 navigate 一致）。不再创建新页面。这与 V0.2.1 的页面复用策略一致。

### 涉及文件

无需改动。V0.2.1 的 CDP 页面复用已覆盖此场景。验证即可。

---

## 问题 2：进入 backend 没有自动激活虚拟环境

### 根因分析

V0.2.1 创建了 `.venv`，但没有配置自动激活。

### 解决方案

在项目根目录创建 `.envrc`（direnv）或在 VSCode 的 workspace settings 中配置 Python 解释器路径。最通用的方案是添加 `.envrc`。

### 涉及文件

| 文件 | 改动 |
|---|---|
| `backend/.envrc`（新建） | direnv 自动激活 |
| `.gitignore` | 添加 `.envrc`（可选，看团队偏好） |

### 实施步骤

1. 创建 `backend/.envrc`，内容：`source .venv/bin/activate`
2. 用户需安装 direnv 并执行 `direnv allow`

> 备选方案：在 `.vscode/settings.json` 中设置 `python.defaultInterpreterPath`。

---

## 问题 3：新增节点时替换掉原节点

### 根因分析

`FlowEditor/index.tsx:189` 中 `nodeIdCounter` 基于 `flowNodes.length + 1` 初始化。如果已有节点 ID 格式为 `node_1`、`node_2`，新拖入的节点可能生成重复 ID `node_3`（如果已有 3 个节点），导致 ReactFlow 用新节点替换同 ID 的旧节点。

### 解决方案

使用时间戳 + 随机数生成唯一 ID，避免与已有节点 ID 冲突。

### 涉及文件

| 文件 | 改动 |
|---|---|
| `frontend/src/components/FlowEditor/index.tsx` | 修改节点 ID 生成逻辑 |

### 实施步骤

1. 将 `nodeIdCounter` 替换为基于时间戳的 ID 生成：`node_${action.name}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
2. 删除 `nodeIdCounter` ref 及其相关的初始化和递增逻辑

---

## 问题 4：CSS 选择器对用户不友好

### 根因分析

click、input_text 等节点需要用户手动填写 CSS 选择器，普通用户不知道如何获取。

### 解决方案

在 NodePanel 的 selector 输入框旁添加提示文案，说明如何获取 CSS 选择器（浏览器 DevTools → 右键元素 → Copy selector）。同时在 placeholder 中给出示例。

这是一个 UX 改进，不涉及核心逻辑变更。更深层的解决方案（如元素拾取器）属于后续版本。

### 涉及文件

| 文件 | 改动 |
|---|---|
| `frontend/src/components/FlowEditor/panels/NodePanel.tsx` | selector 字段添加帮助提示 |

### 实施步骤

1. 在 NodePanel 中检测字段名为 `selector` 时，渲染额外的帮助文案
2. 设置 placeholder 为示例选择器，如 `#login-btn 或 .submit-button`
3. 添加一行小字提示：「在浏览器中右键元素 → 检查 → 右键 → Copy selector」

---

## 问题 5：ai_target 集成 browser-use

### 根因分析

`browser.py:124-129` 中 ai_target 分支直接 `raise NotImplementedError`。`browser-use` 包在 PyPI 上版本不匹配（0.1.0 找不到）。

### 解决方案

暂不集成 browser-use（依赖问题未解决）。改为使用 Playwright 内置的 `page.get_by_text()` / `page.get_by_role()` 等语义定位器实现基础的 AI 定位能力，不依赖外部包。

给 click 和 input_text 的 ai_target 实现一个简单的文本匹配定位：
- 先尝试 `page.get_by_text(ai_target)`
- 再尝试 `page.get_by_role("button", name=ai_target)` 等
- 最后尝试 `page.locator(f"[aria-label='{ai_target}']")`

### 涉及文件

| 文件 | 改动 |
|---|---|
| `backend/engine/actions/browser.py` | click 和 input_text 的 ai_target 实现 |

### 实施步骤

1. 新增辅助函数 `async def _locate_by_ai_target(page, ai_target)` 按优先级尝试多种定位策略
2. click_action 中 ai_target 分支调用该函数
3. input_text_action 中也支持 ai_target（当前只支持 selector）

---

## 问题 6：新增工作流后不刷新列表

### 根因分析

`App.tsx:41-60` 中 `handleCreateWorkflow` 创建成功后只设置了 `currentWorkflow`，没有通知 `WorkflowList` 刷新。`WorkflowList` 只在 mount 时加载一次（`useEffect([], [])`）。

### 解决方案

给 WorkflowList 暴露一个刷新回调，或通过 prop 传递一个 `refreshKey` 触发重新加载。最简单的方案：App 维护一个 `listVersion` state，创建/删除后递增，WorkflowList 监听该值变化时重新加载。

### 涉及文件

| 文件 | 改动 |
|---|---|
| `frontend/src/App.tsx` | 添加 listVersion state，创建后递增 |
| `frontend/src/components/WorkflowList/index.tsx` | 接收 refreshKey prop，监听变化时重新加载 |

### 实施步骤

1. App.tsx 添加 `const [listVersion, setListVersion] = useState(0)`
2. `handleCreateWorkflow` 成功后 `setListVersion(v => v + 1)`
3. WorkflowList props 添加 `refreshKey?: number`
4. WorkflowList 中 `useEffect` 依赖加上 `refreshKey`

---

## 问题 7：保存后画布排版会乱

### 根因分析

`FlowEditor/index.tsx:44-55` 中 `workflowToFlow` 将节点位置硬编码为 `{ x: 100 + index * 200, y: 100 + (index % 2) * 100 }`，完全忽略了用户拖拽后的实际位置。保存时 `flowToWorkflow:73-77` 也没有保存 position。

每次加载工作流都会重新计算位置，丢失用户的布局。

### 解决方案

在 WorkflowNode 中持久化 position，保存和加载时都携带位置信息。

### 涉及文件

| 文件 | 改动 |
|---|---|
| `frontend/src/types/workflow.ts` | WorkflowNode 添加 position 可选字段 |
| `frontend/src/components/FlowEditor/index.tsx` | workflowToFlow 读取 position；flowToWorkflow 保存 position |

### 实施步骤

1. `WorkflowNode` 类型添加 `position?: { x: number; y: number }`
2. `workflowToFlow` 中优先使用 `node.position`，无则使用默认布局
3. `flowToWorkflow` 中将 `node.position` 写入 WorkflowNode

---

## 问题 8：拖拽节点不在光标位置

### 根因分析

`FlowEditor/index.tsx:183-186` 中计算 drop 位置时使用了 `event.clientX - bounds.left`，但没有考虑 ReactFlow 的视口变换（缩放和平移）。需要使用 ReactFlow 的 `screenToFlowPosition` 将屏幕坐标转为画布坐标。

### 解决方案

使用 `useReactFlow()` hook 获取 `screenToFlowPosition` 方法，在 onDrop 中转换坐标。

### 涉及文件

| 文件 | 改动 |
|---|---|
| `frontend/src/components/FlowEditor/index.tsx` | onDrop 中使用 screenToFlowPosition |

### 实施步骤

1. 导入 `useReactFlow` hook
2. 在 onDrop 中用 `screenToFlowPosition({ x: event.clientX, y: event.clientY })` 替换手动计算
3. 删除 `reactFlowWrapper` ref（不再需要）

---

## 问题 9：AI 生成工作流接口报 500，缺乏日志

### 根因分析

`ai_generate.py` 中 `call_llm` 和 `parse_llm_response` 的异常被 `generate_workflow` 捕获后只返回了简单的错误信息，没有记录详细日志。前端也只显示 "AI 编排失败"。

### 解决方案

1. 后端添加 `logging` 模块，在关键路径记录请求参数、响应内容、解析错误
2. 前端显示后端返回的具体错误信息

### 涉及文件

| 文件 | 改动 |
|---|---|
| `backend/api/ai_generate.py` | 添加 logging，记录 LLM 请求/响应/错误详情 |
| `frontend/src/components/FlowEditor/panels/Toolbar.tsx` | 显示后端返回的具体错误信息 |

### 实施步骤

1. `ai_generate.py` 顶部添加 `import logging; logger = logging.getLogger(__name__)`
2. `call_llm` 中记录请求参数（不含 api_key）和响应状态
3. `parse_llm_response` 中记录原始内容和解析错误
4. `generate_workflow` 中记录完整异常栈
5. Toolbar.tsx 中从 error response 提取 detail 信息显示

---

## 实施顺序

| 阶段 | 任务 | 复杂度 | 依赖 |
|---|---|---|---|
| P0 | 问题 7：持久化节点位置 | 中 | 无 |
| P1 | 问题 8：修复拖拽节点位置 | 低 | 无 |
| P2 | 问题 3：修复节点 ID 冲突 | 低 | 无 |
| P3 | 问题 6：创建后刷新列表 | 低 | 无 |
| P4 | 问题 9：AI 生成日志补充 | 中 | 无 |
| P5 | 问题 5：ai_target 基础实现 | 中 | 无 |
| P6 | 问题 4：selector 帮助提示 | 低 | 无 |
| P7 | 问题 2：venv 自动激活 | 低 | 无 |
| P8 | 问题 1：验证 open_tab 行为 | 无 | V0.2.1 |

P0-P3 优先，解决最影响编辑体验的问题。P4-P6 次之。P7-P8 最后。

---

## 验证清单

1. 保存工作流后重新加载，节点位置与保存前一致
2. 拖拽节点到画布，节点出现在光标释放位置
3. 连续添加多个同类型节点，不会替换已有节点
4. 创建新工作流后，左侧列表立即显示
5. AI 生成工作流失败时，后端日志有详细错误信息，前端显示具体原因
6. click 节点填写 ai_target（如"登录按钮"），能正确定位并点击
7. selector 输入框有帮助提示
8. 运行提交前验证脚本全部通过
