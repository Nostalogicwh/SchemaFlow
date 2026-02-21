# V0.4 可执行计划 - 前端样式体系重构 + 测试基础

## 目标

建立统一的前端 UI 组件体系和设计语言，解决当前样式散乱、组件重复、视觉不一致的问题。同时搭建测试框架基础。

---

## 总览

| 模块 | 内容 | 优先级 |
|------|------|--------|
| A. 基础 UI 组件库 | Button、Input、Modal 等通用组件 | 高 |
| B. 设计语言统一 | 色彩规范、排版层级、间距标准 | 高 |
| C. 面板样式重构 | Header、侧边栏、执行面板、节点面板 | 中 |
| D. 交互体验增强 | 加载态、空状态、表单校验、动效 | 中 |
| E. 无障碍 & 质量 | ARIA 标注、键盘导航、对比度、测试框架 | 低 |

---

## 现状分析

### 核心问题

1. **无基础组件库**：按钮样式在 40+ 处重复定义，Input/Select/Textarea 各处自行编写
2. **色彩体系不一致**：Header 用 slate，ExecutionPanel 用 gray-900，其余用白底；designTokens.ts 定义了规范但未全面使用
3. **排版无层级**：字号散落（text-xs / text-sm / text-base / text-lg），无标题/正文/辅助文字的统一规范
4. **模态框不统一**：ConfirmDialog 用 `bg-black/50`，ScreenshotModal 用 `bg-black/90`，无统一 Modal 组件
5. **按钮风格混乱**：至少 3 种写法，颜色/尺寸/状态各处不同

---

## A. 基础 UI 组件库

### A1. Button 组件

#### 现状

按钮样式散布在 Header.tsx、ExecutionPanel/index.tsx、WorkflowList/index.tsx、Toolbar.tsx、NodePanel.tsx 等多个文件中，写法不统一：

```tsx
// Header.tsx - 模式 1：变量拼接
const baseClasses = 'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded ...'
className={`${baseClasses} bg-blue-500 hover:bg-blue-600 text-white`}

// ExecutionPanel - 模式 2：三元条件
className={`... ${isRunning ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}

// WorkflowList - 模式 3：硬编码
className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
```

#### 目标

创建统一 Button 组件，覆盖以下变体：

| 属性 | 可选值 |
|------|--------|
| variant | `primary` / `secondary` / `danger` / `ghost` |
| size | `sm` / `md` / `lg` |
| 状态 | `disabled` / `loading` |
| 图标 | `icon` 前缀图标 / `iconOnly` 纯图标按钮 |

#### 涉及文件

| 文件 | 改动 |
|------|------|
| `frontend/src/components/ui/Button.tsx`（新建） | Button 组件实现 |
| `frontend/src/components/Header.tsx` | 替换所有内联按钮 |
| `frontend/src/components/ExecutionPanel/index.tsx` | 替换所有内联按钮 |
| `frontend/src/components/WorkflowList/index.tsx` | 替换所有内联按钮 |
| `frontend/src/components/FlowEditor/panels/Toolbar.tsx` | 替换所有内联按钮 |

#### 实施步骤

1. 在 `frontend/src/components/ui/` 下创建 `Button.tsx`
2. 定义 variant / size / disabled / loading / icon 等 props
3. 基于 designTokens 中的颜色定义各变体样式
4. 逐文件替换现有按钮，确保视觉一致

---

### A2. 表单组件（Input / Select / Textarea）

#### 现状

表单元素在以下位置各自定义样式：
- `NodePanel.tsx` 第 102-189 行：select、number、text、textarea 4 种字段
- `WorkflowList/index.tsx` 第 99-105 行：搜索输入框
- `Toolbar.tsx` 第 122-135 行：AI 编排文本框

问题：
- 聚焦状态不一致：有的用 `focus:border-blue-400`，有的用 `focus:ring-2 focus:ring-blue-500`
- 边框颜色混用：`border-gray-200` / `border-gray-300`
- Textarea resize 行为不统一

#### 目标

| 组件 | 功能 |
|------|------|
| `Input` | 文本/数字/密码输入，支持前缀图标、清除按钮、错误态 |
| `Select` | 下拉选择，统一箭头样式和选项样式 |
| `Textarea` | 多行输入，统一 resize 行为 |
| `FormField` | Label + 输入组件 + 错误提示的容器，关联 htmlFor |

#### 涉及文件

| 文件 | 改动 |
|------|------|
| `frontend/src/components/ui/Input.tsx`（新建） | Input 组件 |
| `frontend/src/components/ui/Select.tsx`（新建） | Select 组件 |
| `frontend/src/components/ui/Textarea.tsx`（新建） | Textarea 组件 |
| `frontend/src/components/ui/FormField.tsx`（新建） | 表单字段容器 |
| `frontend/src/components/FlowEditor/panels/NodePanel.tsx` | 替换 FieldRenderer 中的表单元素 |
| `frontend/src/components/WorkflowList/index.tsx` | 替换搜索框 |
| `frontend/src/components/FlowEditor/panels/Toolbar.tsx` | 替换 AI 输入框 |

---

### A3. Modal 组件

#### 现状

- `ConfirmDialog.tsx`：固定布局，`bg-black/50` 遮罩，无 focus trap
- `ExecutionPanel/index.tsx` 第 200-275 行（ScreenshotModal）：`bg-black/90` 遮罩，tabIndex={0} 但无焦点管理
- `ErrorBoundary.tsx`：错误展示面板，无模态框

#### 目标

创建统一 Modal 组件：
- 统一遮罩样式和透明度
- 支持 Escape 关闭
- 支持 focus trap（焦点不跑出模态框）
- 支持不同尺寸（sm / md / lg / fullscreen）

#### 涉及文件

| 文件 | 改动 |
|------|------|
| `frontend/src/components/ui/Modal.tsx`（新建） | Modal 基础组件 |
| `frontend/src/components/common/ConfirmDialog.tsx` | 基于 Modal 重写 |
| `frontend/src/components/ExecutionPanel/index.tsx` | ScreenshotModal 基于 Modal 重写 |

---

### A4. Badge / Tag 组件

#### 现状

节点状态标识在 `BaseNode.tsx` 第 36-65 行内联实现，使用 absolute 定位 + 不同颜色圆点。分类标识也是在各处硬编码。

#### 目标

| 组件 | 用途 |
|------|------|
| `Badge` | 节点状态标识（running / completed / failed / pending） |
| `Tag` | 分类标签（browser / data / control / ai） |

#### 涉及文件

| 文件 | 改动 |
|------|------|
| `frontend/src/components/ui/Badge.tsx`（新建） | Badge 组件 |
| `frontend/src/components/ui/Tag.tsx`（新建） | Tag 组件 |
| `frontend/src/components/FlowEditor/nodes/BaseNode.tsx` | 使用 Badge 替换内联状态标识 |

---

## B. 设计语言统一

### B1. 色彩规范落地

#### 现状

`designTokens.ts` 定义了分类颜色（browser/data/control/ai/base）和中性色，但实际代码中：
- Header 使用 `from-slate-800 to-slate-700`（不在色彩体系中）
- ExecutionPanel 使用 `bg-gray-900` / `bg-gray-950`（不在色彩体系中）
- 文字颜色散落：`text-gray-500` / `text-gray-600` / `text-gray-700` 混用

#### 目标

扩展 designTokens，定义完整色阶，全局替换硬编码颜色：

```typescript
export const colors = {
  // 主色
  primary: { 50: '...', 100: '...', ..., 900: '...' },
  // 中性色
  neutral: { 50: '...', 100: '...', ..., 900: '...' },
  // 语义色
  success: '...',
  error: '...',
  warning: '...',
  info: '...',
}

// 语义化映射
export const semanticColors = {
  text: { primary: '...', secondary: '...', tertiary: '...', disabled: '...' },
  bg: { page: '...', surface: '...', elevated: '...', sunken: '...' },
  border: { default: '...', hover: '...', focus: '...' },
  button: {
    primary: { bg: '...', hover: '...', text: '...' },
    secondary: { bg: '...', hover: '...', text: '...' },
    danger: { bg: '...', hover: '...', text: '...' },
    ghost: { bg: '...', hover: '...', text: '...' },
  },
}
```

#### 涉及文件

| 文件 | 改动 |
|------|------|
| `frontend/src/constants/designTokens.ts` | 扩展色彩定义 |
| 所有组件文件 | 替换硬编码颜色为 designTokens 引用 |

#### 关键决策

**ExecutionPanel 暗色主题**：当前 ExecutionPanel 是深色背景，其余面板是浅色。两个选择：

- **方案 A**：全局统一浅色主题，ExecutionPanel 改为浅色（推荐，降低复杂度）
- **方案 B**：保持 ExecutionPanel 暗色，但将暗色色阶纳入 designTokens

---

### B2. 排版层级

#### 现状

字号使用无规律：
- Header：`text-sm md:text-base`
- NodePanel 标题：`text-lg`
- 工作流列表：`text-sm`
- ExecutionPanel：`text-xs`
- 节点描述：`text-xs`

#### 目标

定义排版规范并全局应用：

```typescript
export const typography = {
  h1: 'text-xl font-semibold leading-7',      // 页面标题
  h2: 'text-lg font-semibold leading-6',       // 面板标题
  h3: 'text-base font-medium leading-5',       // 区域标题
  body: 'text-sm leading-5',                    // 正文
  caption: 'text-xs leading-4 text-gray-500',   // 辅助说明
  label: 'text-sm font-medium leading-5',       // 表单标签
  code: 'text-xs font-mono',                    // 代码/日志
}
```

#### 涉及文件

| 文件 | 改动 |
|------|------|
| `frontend/src/constants/designTokens.ts` | 添加 typography 定义 |
| 所有组件文件 | 替换散落的字号/字重为 typography 引用 |

---

### B3. 间距标准化

#### 现状

padding/margin/gap 使用随意：同一层级的面板，有的用 `p-3`，有的用 `p-4`，有的用 `px-3 py-2`。

#### 目标

基于 4px 倍数建立间距规范：

```typescript
export const spacing = {
  panel: 'p-4',           // 面板内边距
  section: 'p-3',         // 区域内边距
  card: 'p-3',            // 卡片内边距
  inlineGap: 'gap-2',     // 行内元素间距
  sectionGap: 'gap-4',    // 区域间间距
  stackGap: 'gap-3',      // 堆叠元素间距
}
```

---

## C. 面板样式重构

### C1. Header 重构

#### 现状

- `from-slate-800 to-slate-700` 渐变与整体色调脱节
- 按钮颜色各异（blue/emerald/red/amber），无视觉层级
- 模式选择用 `<select>`，不够直观

#### 改进点

1. Header 背景改为与主色调一致的样式（白底 + 底部边框，或浅色渐变）
2. 按钮使用 A1 的 Button 组件统一
3. 执行模式选择改为 toggle 按钮组
4. 执行按钮增加明确的状态区分（就绪 / 执行中 / 已完成）

#### 涉及文件

| 文件 | 改动 |
|------|------|
| `frontend/src/components/Header.tsx` | 整体样式重构 |

---

### C2. 侧边栏优化

#### 现状

- 工作流列表项样式简单，选中态不够明显
- 节点工具栏（Toolbar）分组视觉弱
- AI 编排输入区域与其他内容缺乏视觉分隔

#### 改进点

**工作流列表**：
- 列表项增加修改时间显示
- 选中项高亮更明显（左侧色条 + 背景色）
- 空列表增加引导性提示

**节点工具栏**：
- 分类折叠/展开交互优化
- 节点拖拽时增加 ghost 预览效果
- AI 编排区域样式美化（卡片化）

#### 涉及文件

| 文件 | 改动 |
|------|------|
| `frontend/src/components/WorkflowList/index.tsx` | 列表样式优化 |
| `frontend/src/components/FlowEditor/panels/Toolbar.tsx` | 工具栏样式优化 |

---

### C3. 节点样式升级

#### 现状

- 左侧分类色条 `w-1.5` 太窄，缩小后不易辨识
- 状态 badge 使用 absolute `-top-1 -right-1`，节点较小时会溢出重叠
- 连接点（Handle）默认尺寸小（`w-3 h-3`），不易点击
- running 状态的 `animate-pulse` 效果过于简单

#### 改进点

1. 色条宽度增加至 `w-2` 或 `w-2.5`
2. 状态 badge 改为节点内部右上角，避免溢出
3. Handle hover 时放大 + 高亮
4. running 状态改为边框流光效果（shimmer animation）
5. completed 状态增加短暂的绿色闪烁反馈
6. 选中态增加蓝色外框 + 轻微阴影提升

#### 涉及文件

| 文件 | 改动 |
|------|------|
| `frontend/src/components/FlowEditor/nodes/BaseNode.tsx` | 节点卡片样式升级 |
| `frontend/src/components/FlowEditor/nodes/StartNode.tsx` | 起始节点特殊样式 |
| `frontend/src/components/FlowEditor/nodes/EndNode.tsx` | 结束节点特殊样式 |
| `frontend/src/index.css` | 新增流光 / 闪烁动画关键帧 |

---

### C4. 执行面板优化

#### 现状

- 深色背景（gray-900/950）与全局浅色主题不协调
- 部分文字对比度不足（gray-400 文字在 gray-800/50 背景上）
- Tab 切换样式简单
- 截图查看器无明显缩放提示

#### 改进点

1. 统一为浅色主题（或暗色方案纳入 designTokens）
2. 确保所有文字对比度达到 WCAG AA 标准（4.5:1）
3. Tab 切换增加下划线指示器 + 过渡动画
4. 截图区域增加缩放百分比显示和操作按钮
5. 节点执行记录增加时间线视觉效果
6. 日志区域按级别颜色区分，增加过滤按钮

#### 涉及文件

| 文件 | 改动 |
|------|------|
| `frontend/src/components/ExecutionPanel/index.tsx` | 整体样式重构 |
| `frontend/src/components/ExecutionPanel/NodeRecordList.tsx` | 记录列表样式 |

---

### C5. 节点属性面板优化

#### 现状

- 表单字段使用内联样式，无统一组件
- label 未关联 htmlFor
- 缺少字段描述/帮助文字

#### 改进点

1. 使用 A2 的 FormField 组件替换
2. 添加字段帮助文字（hover tooltip 或行内说明）
3. 面板标题区域增加节点类型图标

#### 涉及文件

| 文件 | 改动 |
|------|------|
| `frontend/src/components/FlowEditor/panels/NodePanel.tsx` | 使用表单组件重写 |

---

## D. 交互体验增强

### D1. 加载状态

#### 现状

- AI 生成中只显示 "生成中..." 文字
- 工作流列表加载无反馈
- 按钮加载状态无视觉禁用

#### 目标

| 场景 | 改进 |
|------|------|
| 工作流列表加载 | 骨架屏占位 |
| AI 生成中 | 按钮 loading 旋转图标 + 禁用 |
| 执行面板连接中 | 连接状态动画指示 |
| 保存工作流 | 按钮短暂 loading 态 |

#### 涉及文件

| 文件 | 改动 |
|------|------|
| `frontend/src/components/ui/Skeleton.tsx`（新建） | 骨架屏组件 |
| Button 组件 | loading 属性支持 |

---

### D2. 空状态增强

#### 现状

`EmptyState.tsx` 已有基础实现，但使用场景不够丰富。

#### 目标

| 场景 | 当前 | 改进 |
|------|------|------|
| 未选择工作流 | 纯文字提示 | 图标 + 引导操作按钮 |
| 工作流列表为空 | 无提示 | 引导创建提示 |
| 执行面板无数据 | 空白 | "点击执行按钮开始" + 图标 |
| 节点面板未选中 | 纯文字 | 图标 + 简要操作说明 |

#### 涉及文件

| 文件 | 改动 |
|------|------|
| `frontend/src/components/common/EmptyState.tsx` | 增强样式，支持 action 按钮 |
| 各面板组件 | 在空状态处使用增强版 EmptyState |

---

### D3. 过渡动效统一

#### 现状

- `index.css` 定义了 slide-in、fade-in、node-pulse 等动画
- 各组件 transition 参数不统一：`duration-200` / `duration-300` 混用

#### 目标

统一动效规范：

```typescript
export const transitions = {
  fast: 'transition-all duration-150 ease-out',    // hover、焦点
  normal: 'transition-all duration-200 ease-out',  // 面板展开收起
  slow: 'transition-all duration-300 ease-in-out', // 布局变化
}
```

---

## E. 无障碍 & 质量

### E1. ARIA 标注

- 所有图标按钮补充 `aria-label`
- 状态指示增加文字描述（不仅依赖颜色）
- 表单 label 关联 `htmlFor` / `id`

#### 关键位置

| 文件 | 行 | 问题 |
|------|-----|------|
| `Header.tsx` | 107-109 | 图标按钮缺 aria-label |
| `ExecutionPanel/index.tsx` | 142-147 | 缩放按钮缺描述 |
| `BaseNode.tsx` | 98-106 | 节点图标缺描述 |
| `NodePanel.tsx` | 98-101 | label 无 htmlFor |

---

### E2. 键盘导航

- Modal 组件实现 focus trap
- 所有 Modal 支持 Escape 关闭
- ConfirmDialog 确认按钮自动 focus

---

### E3. 对比度检查

- ExecutionPanel 暗色背景文字对比度达 WCAG AA（4.5:1）
- 特别关注：`text-gray-400` 在 `bg-gray-800/50` 上的可读性

---

### E4. 测试框架搭建

#### 目标

搭建前端测试基础设施，覆盖 UI 组件：

| 工具 | 用途 |
|------|------|
| Vitest | 测试运行器（与 Vite 生态统一） |
| @testing-library/react | 组件渲染和交互测试 |
| @testing-library/user-event | 用户事件模拟 |

#### 覆盖范围

优先为 A 模块新建的 UI 组件编写测试：
- Button 各变体渲染、点击、disabled、loading
- Input / Select / Textarea 渲染、输入、聚焦、错误态
- Modal 打开、关闭、Escape、focus trap

#### 涉及文件

| 文件 | 改动 |
|------|------|
| `frontend/vitest.config.ts`（新建） | Vitest 配置 |
| `frontend/src/test/setup.ts`（新建） | 测试环境初始化 |
| `frontend/src/components/ui/__tests__/`（新建） | UI 组件测试 |
| `frontend/package.json` | 添加测试依赖和脚本 |

---

### E5. 后端优化（顺带处理）

v0.4 前端为主，但以下后端问题如有余力一并处理：

| 任务 | 说明 | 影响范围 |
|------|------|----------|
| 裸 except 替换 | 45+ 处 `except Exception` 改为具体异常 | executor / browser_manager / websocket 等 |
| LLM 客户端单例化 | 避免每次执行重新创建 OpenAI 实例 | context.py |
| BrowserManager 状态解耦 | `_is_cdp` / `_reused_page` 只保留在 context | browser_manager.py |

---

## 实施顺序

| 阶段 | 任务 | 依赖 | 说明 |
|------|------|------|------|
| **P0** | B1 色彩规范 + B2 排版层级 + B3 间距标准 | 无 | 设计基础，后续组件依赖 |
| **P1** | A1 Button 组件 | P0 | 最高频组件，先做 |
| **P2** | A2 表单组件（Input/Select/Textarea/FormField） | P0 | 第二高频组件 |
| **P3** | A3 Modal 组件 + A4 Badge/Tag 组件 | P0 | 弹窗和标识组件 |
| **P4** | C1 Header 重构 + C2 侧边栏优化 | P1, P2 | 使用新组件重构 |
| **P5** | C3 节点样式升级 + C5 节点属性面板 | P2, P3 | 编辑器核心区域 |
| **P6** | C4 执行面板优化 | P1, P3 | 执行监控区域 |
| **P7** | D1 加载状态 + D2 空状态 + D3 动效统一 | P1 | 交互增强 |
| **P8** | E1-E3 无障碍 | P1-P6 完成后 | 全局扫描修复 |
| **P9** | E4 测试框架 + UI 组件测试 | P1-P3 完成后 | 可与 P4-P7 并行 |
| **P10** | E5 后端优化 | 无 | 可独立进行 |

P0-P3（基础组件）为核心路径，完成后 P4-P7（面板重构）和 P9（测试）可并行。

---

## 新增文件清单

```
frontend/src/components/ui/
├── Button.tsx
├── Input.tsx
├── Select.tsx
├── Textarea.tsx
├── FormField.tsx
├── Modal.tsx
├── Badge.tsx
├── Tag.tsx
├── Skeleton.tsx
└── __tests__/
    ├── Button.test.tsx
    ├── Input.test.tsx
    ├── Modal.test.tsx
    └── ...

frontend/vitest.config.ts
frontend/src/test/setup.ts
```

## 修改文件清单

```
frontend/src/constants/designTokens.ts          — 色彩/排版/间距扩展
frontend/src/index.css                          — 新增动画关键帧
frontend/src/components/Header.tsx              — 样式重构
frontend/src/components/FlowEditor/index.tsx    — 样式调整
frontend/src/components/FlowEditor/nodes/BaseNode.tsx    — 节点升级
frontend/src/components/FlowEditor/nodes/StartNode.tsx   — 起止节点样式
frontend/src/components/FlowEditor/nodes/EndNode.tsx     — 起止节点样式
frontend/src/components/FlowEditor/panels/NodePanel.tsx  — 表单组件替换
frontend/src/components/FlowEditor/panels/Toolbar.tsx    — 工具栏优化
frontend/src/components/ExecutionPanel/index.tsx         — 整体重构
frontend/src/components/ExecutionPanel/NodeRecordList.tsx — 列表样式
frontend/src/components/WorkflowList/index.tsx           — 列表样式
frontend/src/components/common/ConfirmDialog.tsx         — 基于 Modal 重写
frontend/src/components/common/EmptyState.tsx            — 增强
frontend/package.json                                    — 测试依赖
```
