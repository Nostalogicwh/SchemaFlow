# v0.4.1 版本计划

## 高优先级问题（阻塞性功能缺陷）

### 🔴 CRITICAL: 浏览器登录态无法继承问题

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

1. **方案A：检测并提示用户（短期方案）**
   - 检测系统中是否有开启调试端口的 Chrome
   - 如果没有，给出清晰的启动指南（区分 macOS/Windows/Linux）
   - 提供一个"启动 Chrome"的便捷按钮（如果技术上可行）

2. **方案B：使用 Playwright 的 `browser_instance_path`（推荐尝试）**
   - Playwright 支持直接连接系统 Chrome 的可执行文件
   - 配置示例：
     ```python
     config = BrowserConfig(
         browser_instance_path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
     )
     ```
   - 这比 CDP 连接更直接，可能能访问用户数据

3. **方案C：Cookie 导入导出（如果用户接受）**
   - 提供前端界面让用户手动导出 Chrome cookies（通过浏览器扩展）
   - 工作流执行前导入这些 cookies
   - 完全在客户端处理，服务端不存储

4. **方案D：复用已打开的标签页（如果可能）**
   - 检测用户是否已经在浏览器中打开了目标页面
   - 直接复用该页面，而非创建新页面
   - 这样自然继承登录态

**需要进一步验证的问题：**
- Chrome for Testing 和系统 Chrome 是否同时存在？
- Playwright 的 `browser_instance_path` 参数是否能真正访问用户的 Chrome 数据？
- 用户是否愿意接受需要手动启动 Chrome 的方案？

**相关代码位置：**
- `backend/engine/browser_manager.py` - 浏览器连接管理
- `backend/engine/actions/browser.py` - 浏览器操作节点

**参考资源：**
- [Playwright 连接本地 Chrome](https://m.blog.csdn.net/u014177256/article/details/156098554)
- [Playwright-MCP 浏览器会话复用](https://blog.51cto.com/u_15591470/14079324)

---

## 中优先级问题（UI/UX改进）

1. 执行、执行中、完成按钮，但是如果想再次执行，按钮还是完成，比较奇怪
2. 几个侧边栏是黑边，样式有点违和
3. 节点能够自定义名称
4. 节点左右应该都要能连线
5. 任何可能引起歧义的地方都需要用比较友好的方式提示用户

## 低优先级问题（代码质量）

6. 清理无意义的代码
7. 后端服务需要补充日志
8. 工作流停止按钮无效