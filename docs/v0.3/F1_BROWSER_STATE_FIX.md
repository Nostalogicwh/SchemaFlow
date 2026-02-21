# F1 - 浏览器登录状态保持修复报告

## 问题根因分析

### 核心 Bug
**文件**: `backend/engine/browser_manager.py`  
**位置**: 第 30-32 行

**问题代码**:
```python
if context.browser is not None and context.page is None:
    context.page = await context.browser.new_page()
    return False, False  # ❌ BUG: 应返回 context 中存储的真实状态
```

### 问题链分析

1. **首次连接成功** → `context._is_cdp=True` 和 `context._reused_page` 被正确存储
2. **页面被关闭**（如 `close_tab_action` 执行后）→ `context.page=None`，但 `context.browser` 仍存在
3. **再次调用 connect()** → 进入上述 Bug 分支
4. **返回 `(False, False)`** → `BrowserManager._is_cdp` 和 `_reused_page` 被错误设置为 `False`
5. **cleanup() 时** → 因 `_is_cdp=False` 执行了错误的清理逻辑（停止 playwright）
6. **登录状态丢失** → CDP 连接的浏览器上下文被破坏

### 影响范围
- 跳转页面后需要重新登录
- 同一工作流内多个 action 节点之间上下文不连贯
- cookies 和 localStorage 在 CDP 模式下无法持久化

---

## 修改内容

### 修改文件 1: `backend/engine/browser_manager.py`

#### 修改 1: 修正状态返回逻辑（第 30-49 行）

**修复前**:
```python
if context.browser is not None and context.page is None:
    context.page = await context.browser.new_page()
    return False, False

if context.browser is not None or context.page is not None:
    return getattr(context, '_is_cdp', False), getattr(context, '_reused_page', False)
```

**修复后**:
```python
if context.browser is not None and context.page is None:
    # browser存在但page被关闭，需要创建新页面
    is_cdp = getattr(context, '_is_cdp', False)
    await context.log("info", f"Browser已连接，创建新页面（CDP模式: {is_cdp}）")
    context.page = await context.browser.new_page()
    self._is_cdp = is_cdp
    self._reused_page = False
    context._reused_page = False
    await context.log("debug", f"新页面创建成功，返回状态: is_cdp={is_cdp}, reused_page=False")
    return is_cdp, False

if context.browser is not None or context.page is not None:
    is_cdp = getattr(context, '_is_cdp', False)
    reused_page = getattr(context, '_reused_page', False)
    await context.log("debug", f"浏览器已连接，复用现有状态: is_cdp={is_cdp}, reused_page={reused_page}")
    self._is_cdp = is_cdp
    self._reused_page = reused_page
    return is_cdp, reused_page
```

**修复说明**:
- 从 `context` 中读取之前存储的 `_is_cdp` 状态
- 正确设置 `BrowserManager` 实例的状态
- 确保 `BrowserManager` 和 `context` 状态同步

#### 修改 2: 添加调试日志（全文）

在以下关键位置添加调试日志：
1. `connect()` 开始和结束
2. CDP 连接尝试和结果
3. 页面复用决策
4. cleanup 执行流程

**目的**: 便于后续排查状态相关问题

#### 修改 3: 完善 cleanup 日志（第 100-127 行）

**修复后**:
```python
async def cleanup(self, context):
    await context.log("debug", f"BrowserManager.cleanup() 开始 - _is_cdp={self._is_cdp}, _reused_page={self._reused_page}")

    if self._is_cdp:
        await context.log("debug", f"CDP 模式清理 - reused_page={self._reused_page}")
        if not self._reused_page:
            try:
                if context.page and not context.page.is_closed():
                    await context.page.close()
                    await context.log("debug", "已关闭 CDP 模式下创建的新页面")
            except Exception as e:
                await context.log("debug", f"关闭页面时出错: {e}")
        else:
            await context.log("debug", "复用的页面保持打开（不关闭）")
    elif self.playwright is not None:
        await context.log("debug", "独立浏览器模式，停止 Playwright")
        try:
            await self.playwright.stop()
            await context.log("debug", "Playwright 已停止")
        except Exception as e:
            await context.log("debug", f"停止 Playwright 时出错: {e}")
    else:
        await context.log("debug", "无需要清理的资源")
```

---

## 测试验证方案

### 单元测试
**测试文件**: `tests/test_browser_state_fix.py`

测试覆盖以下场景：

1. **状态保持测试** (`test_state_preserved_when_page_recreated`)
   - 模拟 page 被关闭后重新创建
   - 验证 `_is_cdp` 状态保持为 `True`
   - 验证 `_reused_page` 被正确设置为 `False`

2. **状态复用测试** (`test_state_preserved_when_already_connected`)
   - 模拟已连接状态直接复用
   - 验证从 context 正确读取状态

3. **Cleanup 逻辑测试** (`test_cleanup_respects_state`)
   - CDP + 复用页面 → 不关闭
   - CDP + 新页面 → 关闭
   - 非 CDP 模式 → 停止 playwright

4. **状态存储验证** (`test_first_connect_stores_state_to_context`)
   - 验证 connect 方法正确同步状态到 context

### 运行测试
```bash
cd /Users/zwh/zwh/AICode/SchemaFlow
python tests/test_browser_state_fix.py
```

### 集成测试方案

**手动验证步骤**:

1. **准备工作**
   ```bash
   # 启动浏览器 CDP 模式
   # Chrome: 使用 --remote-debugging-port=9222 启动
   # 并在已登录的页面保持打开
   ```

2. **创建工作流**
   - 节点 1: `open_tab` 打开登录页面
   - 节点 2: `wait` 等待 2 秒
   - 节点 3: `close_tab` 关闭标签页（模拟页面变化）
   - 节点 4: `open_tab` 再次打开同一网站
   - 节点 5: `screenshot` 截图验证登录状态

3. **验证预期**
   - 节点 4 不应要求重新登录
   - Cookies 和 localStorage 保持有效
   - 日志中显示 "复用已有页面" 或正确创建新页面

### 日志验证

**成功连接示例**:
```
[debug] BrowserManager.connect() 开始 - browser存在: False, page存在: False
[debug] 启动 Playwright，尝试 CDP 连接...
[debug] 尝试连接 CDP: http://localhost:9222
[info] CDP 连接成功，contexts 数量: 1
[info] 已有页面数量: 2
[info]   页面 0: https://example.com/dashboard
[info]   页面 1: about:blank
[info] 已复用已有页面: https://example.com/dashboard
[info] 已连接本地浏览器（CDP 模式），reused_page=True
```

**页面重建示例**:
```
[debug] BrowserManager.connect() 开始 - browser存在: True, page存在: False
[info] Browser已连接，创建新页面（CDP模式: True）
[debug] 新页面创建成功，返回状态: is_cdp=True, reused_page=False
```

**清理示例**:
```
[debug] BrowserManager.cleanup() 开始 - _is_cdp=True, _reused_page=True
[debug] CDP 模式清理 - reused_page=True
[debug] 复用的页面保持打开（不关闭）
```

---

## 技术说明

### CDP 模式 vs 独立浏览器

**CDP 模式**:
- 连接到用户已打开的浏览器
- 共享 cookies、localStorage、sessionStorage
- 保留登录状态
- 适合需要登录态的自动化任务

**独立浏览器**:
- 启动全新的浏览器实例
- 独立的存储空间
- 无登录状态
- 适合无需登录的自动化任务

### 状态管理策略

关键原则：**context 是状态的唯一真实来源**

```
ExecutionContext (context)
├── browser: Browser 实例
├── page: Page 实例
├── _is_cdp: 是否 CDP 模式（状态存储）
└── _reused_page: 是否复用页面（状态存储）

BrowserManager (每个执行创建一个)
├── _is_cdp: 当前实例状态（从 context 同步）
└── _reused_page: 当前实例状态（从 context 同步）
```

**同步流程**:
1. 首次连接：BrowserManager 设置状态并同步到 context
2. 后续连接：从 context 读取状态并设置到 BrowserManager
3. Cleanup：根据 BrowserManager 状态执行清理

---

## 后续优化建议

1. **持久化存储**
   - 考虑添加 `browser_context.storage_state()` 保存和恢复
   - 支持跨工作流的登录态保持

2. **状态监控**
   - 添加健康检查接口
   - 监控 CDP 连接状态

3. **配置优化**
   - 支持 `user_data_dir` 配置
   - 允许自定义 CDP URL

---

**修复日期**: 2026-02-21  
**修复版本**: v0.3  
**相关问题**: 问题 6 - 浏览器登录状态保持
