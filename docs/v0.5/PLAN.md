# v0.5 版本优化规划

> **规划日期：** 2026-02-21
> **版本状态：** 规划中

## 概述

v0.5 版本将专注于解决 v0.4.1 版本中识别的高优先级问题（阻塞性功能缺陷）和前端样式优化，提升用户体验和系统稳定性。

---

## 高优先级问题（阻塞性功能缺陷）

### 🔴 CRITICAL-1: 浏览器登录态无法继承问题

**优先级：** P0（最高优先级）
**影响范围：** 阻塞所有需要登录态的自动化工作流
**来源：** docs/v0.4/v0.4.1/PLAN.md:5-84

**问题描述：**
Web自动化工作流打开新页面时，无法继承用户本地Chrome浏览器的登录状态。具体表现为：
- 工作流中配置打开 `https://chat.deepseek.com/`
- 实际打开的页面显示登录页，而非已登录状态
- 导致依赖登录态的自动化流程完全阻塞

**用户原始反馈：**
> "web自动化工作流，打开新页面总是无法继承原来浏览器的登录状态，像这个图里面，打开DeepSeek，打开的却是一个像是无痕的新窗口，里面是需要重新登录的，这样很多流程就阻塞了"

**尝试过的修复方案（均未成功）：**

1. **方案一：在现有 BrowserContext 中创建新页面**
   - 修改 `browser.new_page()` 为 `browser.contexts[0].new_page()`
   - 失败原因：Playwright 的 `connect_over_cdp` 连接的可能不是用户正在使用的 Chrome，而是 Chrome for Testing（独立的测试浏览器），它有自己独立的 user-data-dir

2. **方案二：storage_state 持久化（被用户拒绝）**
   - 实现自动保存/加载 cookies、localStorage 到服务端文件
   - 被拒绝原因：用户不希望服务端存储任何用户数据，担心数据纠纷

3. **方案三：自动发现调试端口**
   - 扫描多个常见端口（9222, 9223, 9224, 9225, 9333）
   - 失败原因：用户日常使用的 Chrome 默认不会开启远程调试端口，需要手动启动

**根本原因分析：**

1. **Chrome for Testing 问题**
   - Playwright 默认安装的是 Chrome for Testing（独立的测试版本）
   - 它有自己独立的 user-data-dir，不共享系统 Chrome 的任何数据
   - 即使通过 CDP 连接，如果没有正确配置，也可能连接到错误的 Chrome 实例

2. **调试端口未开启**
   - 用户日常使用的 Chrome 默认不会开启 `--remote-debugging-port`
   - 需要完全退出 Chrome 并以特殊参数重新启动，这对用户不友好

3. **隐私顾虑**
   - 用户明确拒绝服务端存储 cookies/localStorage
   - 需要纯客户端方案

**推荐的解决方案（按优先级排序）：**

#### 方案A：检测并提示用户（短期方案）⭐ 推荐

**实现步骤：**
1. 检测系统中是否有开启调试端口的 Chrome
   - 扫描常见端口：9222, 9223, 9224, 9225, 9333
   - 检测 Chrome 进程是否有远程调试参数
2. 如果没有，给出清晰的启动指南
   - 区分 macOS/Windows/Linux
   - 提供一键启动脚本（如果技术上可行）
3. 在前端添加"浏览器配置"面板
   - 显示当前连接状态
   - 提供"检测 Chrome"按钮
   - 显示操作指南

**优点：**
- 实现简单，风险低
- 符合用户隐私要求（纯客户端）
- 用户可控

**缺点：**
- 需要用户手动操作
- 用户体验不够流畅

**工作量评估：** 2-3 天

#### 方案B：使用 Playwright 的 `browser_instance_path`（推荐尝试）

**技术原理：**
- Playwright 支持直接连接系统 Chrome 的可执行文件
- 配置示例：
  ```python
  config = BrowserConfig(
      browser_instance_path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  )
  ```

**实现步骤：**
1. 检测系统 Chrome 路径
   - macOS: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
   - Windows: `C:\Program Files\Google\Chrome\Application\chrome.exe`
   - Linux: `/usr/bin/google-chrome` 或 `/usr/bin/chromium-browser`
2. 修改 `browser_manager.py`，使用 `browser_instance_path` 参数
3. 测试是否能正确访问用户数据

**优点：**
- 比方案A更自动化
- 可能直接解决问题

**缺点：**
- 技术风险高，不确定是否能访问用户数据
- 需要大量测试

**工作量评估：** 3-5 天

#### 方案C：Cookie 导入导出（如果用户接受）⚠️ 备选

**技术原理：**
- 提供前端界面让用户手动导出 Chrome cookies（通过浏览器扩展或开发者工具）
- 工作流执行前导入这些 cookies
- 完全在客户端处理，服务端不存储

**实现步骤：**
1. 创建浏览器扩展，用于导出 cookies
2. 前端提供"导入 cookies"界面
3. 修改 `browser_manager.py`，在创建 context 时注入 cookies
4. 提供浏览器内插件或脚本，方便用户导出 cookies

**优点：**
- 纯客户端，符合隐私要求
- 技术可行性高

**缺点：**
- 用户操作复杂
- 需要用户配合安装插件
- cookies 有时效性

**工作量评估：** 5-7 天

#### 方案D：复用已打开的标签页（如果可能）🔬 探索性

**技术原理：**
- 检测用户是否已经在浏览器中打开了目标页面
- 直接复用该页面，而非创建新页面
- 这样自然继承登录态

**实现步骤：**
1. 使用 CDP API 获取当前打开的标签页列表
2. 检查是否有匹配的 URL
3. 如果有，切换到该标签页
4. 如果没有，创建新标签页

**优点：**
- 用户体验最佳
- 完全继承登录态

**缺点：**
- 技术复杂度极高
- Playwright 限制多
- 需要用户主动配合（保持浏览器打开）

**工作量评估：** 7-10 天（如果可行）

**相关代码位置：**
- `backend/engine/browser_manager.py` - 浏览器连接管理
- `backend/engine/actions/browser.py` - 浏览器操作节点

**参考资源：**
- [Playwright 连接本地 Chrome](https://m.blog.csdn.net/u014177256/article/details/156098554)
- [Playwright-MCP 浏览器会话复用](https://blog.51cto.com/u_15591470/14079324)
- [Playwright BrowserType.launchPersistentContext](https://playwright.dev/python/docs/api/class-browsertype#browser-type-launch-persistent-context)

**需要进一步验证的问题：**
1. Chrome for Testing 和系统 Chrome 是否同时存在？
2. Playwright 的 `browser_instance_path` 参数是否能真正访问用户的 Chrome 数据？
3. 用户是否愿意接受需要手动启动 Chrome 的方案？
4. 如果需要用户配合，什么样的操作流程最友好？

**建议的实现路径：**
1. **第一阶段（P0）**：实现方案A（检测并提示用户）
   - 快速上线，解决阻塞问题
   - 收集用户反馈

2. **第二阶段（P1）**：尝试方案B（browser_instance_path）
   - 如果可行，替代方案A
   - 提升用户体验

3. **第三阶段（P2）**：探索方案C/D
   - 根据用户反馈决定是否投入
   - 作为长期优化方向

---

### 🔴 CRITICAL-2: AI定位目标执行失败

**优先级：** P1（高优先级）
**影响范围：** AI 编排功能部分不可用
**来源：** docs/v0.4/存在问题.md:5

**问题描述：**
AI 编排生成的节点中，AI定位目标节点执行失败，导致工作流无法正常完成。

**可能的原因：**
1. AI 生成的定位策略不准确
2. AI Locator 配置错误
3. 页面加载超时
4. 选择器动态变化

**需要进一步调研：**
- 查看具体的错误日志
- 分析 AI 生成的定位策略
- 测试不同页面的定位成功率

**相关代码位置：**
- `backend/engine/ai_locator.py` - AI 定位器
- `backend/engine/actions/browser.py` - 浏览器操作节点

---

## 前端样式问题（UI/UX优化）

### 🔵 STYLE-1: 侧边栏黑边问题

**优先级：** P2（中优先级）
**影响范围：** 视觉体验
**来源：** docs/v0.4/v0.4.1/PLAN.md:89

**问题描述：**
几个侧边栏有黑边，样式有点违和。

**相关组件：**
- `frontend/src/components/FlowEditor/panels/Toolbar.tsx`
- `frontend/src/components/FlowEditor/panels/NodePanel.tsx`
- `frontend/src/components/ExecutionPanel/index.tsx`

**可能的解决方案：**
1. 移除黑边：删除 `border-black` 或类似的边框样式
2. 改为浅色边框：使用 `border-gray-200` 或 `border-neutral-200`
3. 使用阴影代替边框：使用 `shadow-sm` 或 `shadow-md`

**工作量评估：** 0.5 天

---

### 🔵 STYLE-2: 输入法与回车键重叠

**优先级：** P2（中优先级）
**影响范围：** 移动端用户体验
**来源：** docs/v0.4/存在问题.md:1

**问题描述：**
输入法与回车键重叠，影响输入体验。

**相关组件：**
- `frontend/src/components/ui/Input.tsx`
- `frontend/src/components/ui/Textarea.tsx`

**可能的解决方案：**
1. 添加足够的底部 padding，避免被输入法遮挡
2. 使用固定定位的输入框
3. 监听输入法状态，动态调整布局

**工作量评估：** 0.5-1 天

---

### 🔵 STYLE-3: 重试等很多按钮没有交互效果

**优先级：** P2（中优先级）
**影响范围：** 用户反馈
**来源：** docs/v0.4/存在问题.md:2

**问题描述：**
重试等很多按钮没有交互效果（hover、active 状态）。

**相关组件：**
- `frontend/src/components/ui/Button.tsx`
- `frontend/src/components/Header.tsx`
- 所有使用 Button 的地方

**可能的解决方案：**
1. 在 Button 组件中添加完整的交互状态：
   - hover: `hover:bg-opacity-90`
   - active: `active:scale-95`
   - focus: `focus:ring-2 focus:ring-offset-2`
2. 添加过渡动画：`transition-all duration-200`
3. 添加 loading 状态的视觉反馈

**工作量评估：** 0.5 天

---

### 🔵 STYLE-4: 运行和执行功能重复

**优先级：** P2（中优先级）
**影响范围：** 用户困惑
**来源：** docs/v0.4/存在问题.md:3

**问题描述：**
运行和执行功能重复，造成用户困惑。

**相关组件：**
- `frontend/src/components/Header.tsx`
- `frontend/src/components/FlowEditor/panels/Toolbar.tsx`

**可能的解决方案：**
1. 统一术语，全部使用"执行"或"运行"
2. 如果有两个不同的功能，明确区分：
   - "执行"：立即运行
   - "保存并执行"：保存后运行
3. 合并重复的按钮

**工作量评估：** 0.5 天

---

### 🔵 STYLE-5: 创建工作流弹窗样式丑陋

**优先级：** P2（中优先级）
**影响范围：** 视觉体验
**来源：** docs/v0.4/存在问题.md:4

**问题描述：**
创建工作流弹窗样式丑陋。

**相关组件：**
- `frontend/src/components/ui/Modal.tsx`
- `frontend/src/components/WorkflowList/index.tsx`

**可能的解决方案：**
1. 使用现有的 Modal 组件，但优化样式
2. 添加：
   - 合适的 padding
   - 圆角 `rounded-xl`
   - 阴影 `shadow-xl`
   - 动画效果
3. 统一设计风格，参考 AI 编排弹窗的设计

**工作量评估：** 1 天

---

## 实施优先级排序

### 第一阶段（P0 - 必须解决）
1. **CRITICAL-1: 浏览器登录态无法继承问题**（方案A：检测并提示用户）
   - 工作量：2-3 天
   - 影响：解决阻塞问题

### 第二阶段（P1 - 高优先级）
2. **CRITICAL-2: AI定位目标执行失败**
   - 工作量：3-5 天
   - 影响：修复 AI 编排功能

### 第三阶段（P2 - 样式优化）
3. **STYLE-1: 侧边栏黑边问题**（0.5 天）
4. **STYLE-2: 输入法与回车键重叠**（0.5-1 天）
5. **STYLE-3: 重试等很多按钮没有交互效果**（0.5 天）
6. **STYLE-4: 运行和执行功能重复**（0.5 天）
7. **STYLE-5: 创建工作流弹窗样式丑陋**（1 天）

**总计工作量：** 约 9-12 天

---

## 备注

### 关于 v0.4.1 中低优先级问题
以下问题已经在 v0.4.1 中处理，不纳入 v0.5：
1. ✅ 执行、执行中、完成按钮状态问题
2. ✅ 节点能够自定义名称
3. ✅ 节点左右都要能连线
4. ✅ 添加用户友好的提示
5. ✅ 清理无意义的代码
6. ✅ 后端服务补充日志
7. ✅ 工作流停止按钮无效

详细实施计划见：`docs/plans/2026-02-21-v0.4.1-medium-low-priority.md`

### 关于浏览器登录态问题的技术调研建议
在正式实施前，建议进行以下技术调研：
1. 阅读完整文档，确保无遗漏的 API 或参数
2. 探索 Playwright 社区或 Stack Overflow 的解决方案
3. 考虑引入插件方案或简化实现路径，提升用户体验

### 关于样式优化的统一设计
建议在实施前制定统一的设计规范：
1. 参考 `frontend/src/constants/designTokens.ts`
2. 确保所有组件使用一致的颜色、间距、圆角
3. 使用 shadcn/ui 组件库作为基础样式参考
