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

**推荐的解决方案：**

#### 📄 技术架构方案：基于客户端受托的 Web 自动化凭证管理 (Client-Side Vault)

##### 1. 架构目标与核心原则
*   **隐私绝对合规**：服务端（后端引擎）绝对不将用户的 Cookies、LocalStorage 写入数据库或服务器硬盘，做到“用完即毁，片叶不沾身”。
*   **体验无缝顺滑**：用户只需在首次遇到登录墙时协助扫码/登录一次，后续运行自动注水复用，直到凭证自然失效。
*   **用户拥有控制权**：用户明确知晓凭证存放在自己电脑的浏览器中，并提供一键清理失效凭证的能力。

---

##### 2. 核心数据流转设计 (Sequence Flow)

###### 场景一：首次运行（拦截登录 -> 提取凭证 -> 下发前端）
1. **[前端]** 发起工作流执行请求。
2. **[后端]** Playwright 在纯内存（无痕模式）中启动，访问目标网站（如 DeepSeek）。
3. **[后端]** 引擎检测到页面存在登录框，暂停执行，将当前页面截图/流媒体推流给前端。
4. **[前端]** 弹出“人机协同”控制台，用户在网页上完成扫码或密码登录。
5. **[后端]** 监测到页面跳转且登录成功，立刻执行 `await context.storage_state()`，将凭证提取为 JSON 对象。
6. **[后端]** 将此 JSON 附加在执行结果中一并返回，**服务器内存随之销毁，不留任何存档**。
7. **[前端]** 接收到 JSON，将其静默保存在用户本地的 `IndexedDB` 中（按网站域名或工作流 ID 隔离）。

###### 场景二：后续运行（凭证注水 -> 免密执行）
1. **[前端]** 用户再次点击“运行工作流”。
2. **[前端]** 拦截请求，去 `IndexedDB` 检查是否存有该工作流的凭证 JSON。
3. **[前端]** 若有，将其作为 Request Body 的一部分（`auth_payload`）发送给后端。
4. **[后端]** 接收到请求，启动 Playwright，直接将收到的 JSON 注入：`context = await browser.new_context(storage_state=auth_payload)`。
5. **[后端]** Playwright 瞬间获得登录态，绕过登录流程，直接执行后续自动化操作。
6. **[后端]** 执行完毕，内存销毁。


##### 3. 前端设计规范 (Web UI & Storage)

###### 3.1 存储选型：必须使用 IndexedDB
*   **切忌使用 LocalStorage**：Playwright 导出的 `storage_state` 包含全量 Cookies 和大量站点的 LocalStorage 数据，极易超过浏览器 `LocalStorage` 的 5MB 限制导致报错。
*   **推荐方案**：使用 `localforage` 库，它提供类似 LocalStorage 的简单 API，但底层自动使用无限容量的 `IndexedDB`。

###### 3.2 交互界面设计 (UI)
在工作流配置面板的侧边栏，增加一个 **「授权与凭证管理」**模块：

*   **授权开关**：
    `[ √ ] 记住登录状态（凭证仅保存在您当前浏览器的本地缓存中，服务端不予留存）`
*   **状态指示器**：
    *   未授权时显示：`⚪ DeepSeek (未获取凭证)`
    *   已授权时显示：`🟢 DeepSeek (本地已保存登录凭证)`
*   **手动清理按钮 (满足你的新增需求)**：
    当状态为🟢时，右侧显示一个垃圾桶图标或按钮：`[ 🧹 清除失效凭证 ]`
    *点击动作*：弹窗二次确认“清除后下次运行将需要重新扫码登录，确认清除吗？”，点击确认后，前端立刻删除 `IndexedDB` 中的对应记录，状态变回⚪。


##### 4. 后端核心代码实现 (Python FastAPI + Playwright)

后端只需做轻微的改造，支持“接收注入”和“导出下发”。

###### 4.1 接口契约定义 (API Schema)
```python
from pydantic import BaseModel
from typing import Optional, Dict, Any

class WorkflowRunRequest(BaseModel):
    workflow_id: str
    # 核心新增：前端传来的凭证 JSON
    injected_storage_state: Optional[Dict[str, Any]] = None 

class WorkflowRunResponse(BaseModel):
    status: str
    result_data: Any
    # 核心新增：后端下发给前端保存的凭证 JSON
    new_storage_state: Optional[Dict[str, Any]] = None
```

###### 4.2 Playwright 引擎改造片段
```python
from playwright.async_api import async_playwright

async def execute_workflow(request: WorkflowRunRequest):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        
        # 1. [凭证注水] 如果前端传了凭证，直接在初始化时注入
        if request.injected_storage_state:
            context = await browser.new_context(
                storage_state=request.injected_storage_state
            )
        else:
            context = await browser.new_context()

        page = await context.new_page()
        
        # 2. 执行自动化逻辑...
        await page.goto("https://chat.deepseek.com/")
        
        # 判断是否需要人为介入登录 (伪代码)
        is_logged_in = await check_if_logged_in(page)
        
        if not is_logged_in:
            # 触发人机协同流，等待用户扫码...
            await wait_for_user_manual_login(page)
            
        # 3. [凭证提取] 执行完毕后，无论是一直保持登录的，还是刚刚扫码的，都提取最新凭证
        # 注意：这里返回的是 dict 字典，全程不碰硬盘 I/O！
        latest_state = await context.storage_state()
        
        await browser.close()
        
        # 4. [下发前端] 将最新凭证返回，交给前端保存
        return WorkflowRunResponse(
            status="success",
            result_data={"msg": "执行成功"},
            new_storage_state=latest_state
        )
```

---

##### 5. 异常处理：Token 自然过期怎么办？

哪怕有了本地保存，目标网站（如 DeepSeek）的 Cookie 也有自然过期的一天。系统需要具备 **“自动感知失效并要求重登”**的自愈能力。

**处理逻辑：**
1. 前端依然把 `IndexedDB` 里的（已过期的）凭证发给后端。
2. 后端 Playwright 注入凭证并打开网页。
3. 引擎通过逻辑判断（例如：找寻页面上的“登录”按钮，或者判断当前的 URL 是不是跳回了 login 页面），发现**“注入了凭证但依然处于未登录状态”**。
4. 引擎判断：**凭证已失效**。
5. 引擎立刻触发**“场景一”**（拦截登录），向前端发送一个特殊指令 `{"action": "REQUIRE_MANUAL_LOGIN", "reason": "TOKEN_EXPIRED"}`。
6. 前端收到后，唤起扫码推流弹窗，提示用户：`“由于长时间未运行或服务端安全策略，您的登录已失效，请重新扫码激活”`。
7. 用户扫码完成，后端重新提取新的 `storage_state` 下发，前端**覆写** `IndexedDB` 中的旧凭证。
8. 整个流程完美自洽，没有死角。

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
