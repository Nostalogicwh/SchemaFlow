# V0.3 实施计划

本文档是 V0.3 迭代的详细实施计划，补充 `PLAN.md` 中的总体规划。

## 实施策略

采用**方案A：按功能模块推进**，共4个阶段：

| 阶段 | 任务 | 时长 |
|------|------|------|
| 阶段1 | 补全基础节点（C4） | 2-3天 |
| 阶段2 | AI智能元素定位（C1） | 3-4天 |
| 阶段3 | Browser Use集成（C2） | 2-3天 |
| 阶段4 | 样式优化（D1-D7） | 5-7天 |

---

## 阶段1：补全基础节点（C4）

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

### 目标

实现5个缺失的基础节点（switch_tab、close_tab、select_option、scroll、custom_script），增强浏览器操作和数据处理能力。

### 涉及文件

- `backend/engine/actions/browser.py` - 添加 switch_tab、close_tab、select_option、scroll
- `backend/engine/actions/data.py` - 添加 custom_script
- `frontend/src/components/FlowEditor/nodes/index.ts` - 验证前端节点注册

### Task 1: 实现 switch_tab 节点

在 `backend/engine/actions/browser.py` 文件末尾添加：

```python
@register_action(
    name="switch_tab",
    label="切换标签页",
    description="切换到指定的标签页",
    category="browser",
    parameters={
        "type": "object",
        "properties": {
            "index": {
                "type": "integer",
                "description": "标签页索引（从0开始），与 title_match 二选一"
            },
            "title_match": {
                "type": "string",
                "description": "按标题模糊匹配标签页，与 index 二选一"
            }
        }
    },
    inputs=["flow"],
    outputs=["flow"]
)
async def switch_tab_action(context: Any, config: Dict[str, Any]) -> Dict[str, Any]:
    """切换标签页。"""
    if not context.browser:
        raise ValueError("浏览器未初始化")

    contexts = context.browser.contexts
    if not contexts:
        raise ValueError("没有可用的浏览器上下文")

    pages = contexts[0].pages
    if not pages:
        raise ValueError("没有可用的标签页")

    index = config.get("index")
    title_match = config.get("title_match")

    if index is not None:
        if index < 0 or index >= len(pages):
            raise ValueError(f"标签页索引 {index} 超出范围（0-{len(pages)-1}）")
        target_page = pages[index]
        await context.log("info", f"切换到标签页 {index}: {target_page.url}")
    elif title_match is not None:
        target_page = None
        for i, page in enumerate(pages):
            page_title = await page.title()
            if title_match.lower() in page_title.lower():
                target_page = page
                await context.log("info", f"切换到标签页（标题匹配）{i}: {page.url}")
                break
        if target_page is None:
            raise ValueError(f"找不到标题包含「{title_match}」的标签页")
    else:
        raise ValueError("必须提供 index 或 title_match 参数")

    context.page = target_page
    return {"page_url": target_page.url, "page_title": await target_page.title()}
```

**验证：** `python -m py_compile backend/engine/actions/browser.py`

**测试：** 创建包含两个 open_tab 节点的工作流，添加 switch_tab 节点测试。

**提交：** `git commit -m "feat: 添加 switch_tab 节点"`

---

### Task 2: 实现 close_tab 节点

在 `backend/engine/actions/browser.py` 文件末尾添加：

```python
@register_action(
    name="close_tab",
    label="关闭标签页",
    description="关闭当前标签页",
    category="browser",
    parameters={
        "type": "object",
        "properties": {},
    },
    inputs=["flow"],
    outputs=["flow"]
)
async def close_tab_action(context: Any, config: Dict[str, Any]) -> Dict[str, Any]:
    """关闭当前标签页。"""
    if not context.page:
        raise ValueError("当前没有打开的标签页")

    contexts = context.browser.contexts
    if not contexts:
        raise ValueError("没有可用的浏览器上下文")

    pages = contexts[0].pages
    if len(pages) <= 1:
        raise ValueError("无法关闭最后一个标签页")

    current_url = context.page.url
    await context.page.close()

    remaining_pages = contexts[0].pages
    if remaining_pages:
        context.page = remaining_pages[-1]
        await context.log("info", f"关闭标签页 {current_url}，切换到 {context.page.url}")
    else:
        context.page = None
        await context.log("info", f"关闭标签页 {current_url}，没有剩余标签页")

    return {"closed_url": current_url, "current_url": context.page.url if context.page else None}
```

**验证：** `python -m py_compile backend/engine/actions/browser.py`

**测试：** 创建包含两个 open_tab 节点的工作流，添加 close_tab 节点测试。

**提交：** `git commit -m "feat: 添加 close_tab 节点"`

---

### Task 3: 实现 select_option 节点

在 `backend/engine/actions/browser.py` 文件末尾添加：

```python
@register_action(
    name="select_option",
    label="下拉选择",
    description="在下拉框中选择指定选项",
    category="browser",
    parameters={
        "type": "object",
        "properties": {
            "selector": {
                "type": "string",
                "description": "CSS选择器"
            },
            "value": {
                "type": "string",
                "description": "要选择的选项值（option的value属性）"
            },
            "label": {
                "type": "string",
                "description": "要选择的选项文本（option的显示文本），与 value 二选一"
            }
        },
        "required": ["selector"]
    },
    inputs=["flow"],
    outputs=["flow"]
)
async def select_option_action(context: Any, config: Dict[str, Any]) -> Dict[str, Any]:
    """在下拉框中选择指定选项。"""
    if not context.page:
        raise ValueError("页面未初始化")

    selector = config.get("selector")
    if not selector:
        raise ValueError("select_option 节点需要 selector 参数")

    value = config.get("value")
    label = config.get("label")

    if not value and not label:
        raise ValueError("必须提供 value 或 label 参数")

    element = await locate_element(context.page, selector)
    await element.wait_for(state="visible", timeout=30000)

    if value:
        await element.select_option(value=value)
        await context.log("info", f"选择下拉框选项（value）: {selector} = {value}")
    else:
        await element.select_option(label=label)
        await context.log("info", f"选择下拉框选项（label）: {selector} = {label}")

    return {"selector": selector, "selected_value": value, "selected_label": label}
```

**验证：** `python -m py_compile backend/engine/actions/browser.py`

**测试：** 创建工作流导航到有下拉框的页面，测试 select_option 节点。

**提交：** `git commit -m "feat: 添加 select_option 节点"`

---

### Task 4: 实现 scroll 节点

在 `backend/engine/actions/browser.py` 文件末尾添加：

```python
@register_action(
    name="scroll",
    label="滚动页面",
    description="滚动页面到指定位置",
    category="browser",
    parameters={
        "type": "object",
        "properties": {
            "pixels": {
                "type": "integer",
                "description": "滚动像素数，正数向下滚动，负数向上滚动"
            },
            "to_bottom": {
                "type": "boolean",
                "description": "是否滚动到页面底部"
            },
            "to_top": {
                "type": "boolean",
                "description": "是否滚动到页面顶部"
            }
        }
    },
    inputs=["flow"],
    outputs=["flow"]
)
async def scroll_action(context: Any, config: Dict[str, Any]) -> Dict[str, Any]:
    """滚动页面。"""
    if not context.page:
        raise ValueError("页面未初始化")

    pixels = config.get("pixels")
    to_bottom = config.get("to_bottom", False)
    to_top = config.get("to_top", False)

    if to_bottom:
        await context.page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await context.log("info", "滚动到页面底部")
        return {"action": "to_bottom"}
    elif to_top:
        await context.page.evaluate("window.scrollTo(0, 0)")
        await context.log("info", "滚动到页面顶部")
        return {"action": "to_top"}
    elif pixels is not None:
        await context.page.evaluate(f"window.scrollBy(0, {pixels})")
        direction = "向下" if pixels > 0 else "向上"
        await context.log("info", f"{direction}滚动 {abs(pixels)} 像素")
        return {"action": "scroll", "pixels": pixels}
    else:
        raise ValueError("必须提供 pixels、to_bottom 或 to_top 参数")
```

**验证：** `python -m py_compile backend/engine/actions/browser.py`

**测试：** 创建工作流导航到长页面，测试 scroll 节点的不同参数。

**提交：** `git commit -m "feat: 添加 scroll 节点"`

---

### Task 5: 实现 custom_script 节点

在 `backend/engine/actions/data.py` 文件末尾添加：

```python
@register_action(
    name="custom_script",
    label="自定义脚本",
    description="执行自定义Python脚本",
    category="data",
    parameters={
        "type": "object",
        "properties": {
            "script": {
                "type": "string",
                "description": "Python脚本代码"
            }
        },
        "required": ["script"]
    },
    inputs=["any"],
    outputs=["any"]
)
async def custom_script_action(context: Any, config: Dict[str, Any]) -> Dict[str, Any]:
    """执行自定义Python脚本。"""
    script = config.get("script")
    if not script:
        raise ValueError("custom_script 节点需要 script 参数")

    await context.log("info", f"执行自定义脚本: {script[:50]}...")

    local_vars = {
        "variables": context.variables,
        "context": context,
    }

    try:
        exec(script, {}, local_vars)
    except Exception as e:
        raise ValueError(f"脚本执行失败: {str(e)}")

    result = local_vars.get("result")
    context.variables = local_vars.get("variables", context.variables)

    await context.log("info", f"脚本执行完成，结果: {result}")

    return {"result": result}
```

**验证：** `python -m py_compile backend/engine/actions/data.py`

**测试：** 测试简单脚本如 `result = 2 + 2` 和变量访问。

**提交：** `git commit -m "feat: 添加 custom_script 节点"`

---

### Task 6: 验证前端节点注册

检查 `frontend/src/components/FlowEditor/nodes/index.ts`，确认以下节点已在前端注册：
- switch_tab
- close_tab
- select_option
- scroll

custom_script 是 data 类型节点，应使用 DataNode 组件。

---

### Task 7: 综合测试

创建包含所有新节点的测试工作流并执行，验证：
1. 所有节点都能正常工作
2. 执行日志正确
3. 没有错误或异常

---

### 验收标准

- ✅ 5个新节点都已实现
- ✅ 所有节点语法正确
- ✅ 参数定义和错误处理完整
- ✅ 前端节点组件正确注册
- ✅ 通过综合测试

---

## 阶段2：AI智能元素定位（C1）

### 目标

构建真正的LLM驱动的智能元素定位系统。

### 涉及文件

- `backend/engine/ai_locator.py`（新建）
- `backend/engine/actions/browser.py` - 修改 click、input_text
- `backend/engine/actions/utils.py` - 修改 locate_element

### 核心流程

1. 获取页面DOM快照（提取可交互元素，简化属性，限制数量）
2. 构建LLM Prompt（包含URL、用户描述、元素列表）
3. LLM返回结构化结果（best_match_index、selector、confidence、reasoning、alternatives）
4. 执行和验证（使用selector定位，验证可见性，失败尝试alternatives）
5. 错误处理和记录（详细记录失败原因）

### 关键任务

**Task 1: 创建 ai_locator.py**

实现以下函数：
- `extract_interactive_elements(page)` - 提取页面可交互元素
- `locate_with_ai(page, ai_target, context)` - AI定位主函数
- `build_ai_prompt(url, ai_target, elements)` - 构建LLM Prompt
- `parse_ai_response(response)` - 解析LLM返回

**Task 2: 修改 utils.py**

修改 `locate_element` 函数，ai_target 参数时调用 `locate_with_ai`。

**Task 3: 修改 browser.py**

click、input_text 节点使用新的 locate_element。

**Task 4: 测试和调试**

测试各种场景，验证AI定位效果。

---

## 阶段3：Browser Use集成（C2）

### 目标

集成browser-use库，实现ai_action节点。

### 涉及文件

- `backend/engine/actions/ai.py`（新建）
- `frontend/src/components/FlowEditor/nodes/AINode.tsx`（新建）

### 集成方式

```python
from browser_use import Agent

@register_action(
    name="ai_action",
    label="AI自动化",
    category="ai"
)
async def ai_action_action(context, config):
    prompt = config.get("prompt")
    max_steps = config.get("max_steps", 10)

    agent = Agent(
        task=prompt,
        browser=context.browser,
        page=context.page,
    )

    await agent.run(max_steps=max_steps)

    return {"result": "AI自动化执行完成"}
```

### 关键任务

**Task 1: 创建 ai.py**
实现 ai_action 节点。

**Task 2: 创建 AINode.tsx**
创建AI节点前端组件。

**Task 3: 测试**
测试各种自然语言指令。

---

## 阶段4：样式优化（D1-D7）

### 涉及文件

- `frontend/src/components/FlowEditor/nodes/BaseNode.tsx`
- `frontend/src/components/FlowEditor/nodes/StartNode.tsx`
- `frontend/src/components/FlowEditor/nodes/EndNode.tsx`
- `frontend/src/components/common/EmptyState.tsx`（新建）
- `frontend/src/components/common/LoadingSpinner.tsx`（新建）
- `frontend/src/App.tsx`
- 其他UI相关文件

### 关键任务

**D1. 整体设计语言**
- 定义设计token（颜色、间距、圆角、阴影）

**D2. 节点样式升级**
- 添加分类色条
- 图标优化
- 状态动画
- 选中态优化

**D3. 顶部导航优化**
- Logo
- 可编辑工作流名称
- 状态化执行按钮
- Toggle模式选择

**D4. 侧边栏优化**
- 工作流列表搜索
- 时间显示
- 节点分组折叠
- Ghost预览

**D5. 执行面板优化**
- 截图缩放
- 时间线视图
- 日志过滤
- Modal对话框

**D6. 空状态和加载状态**
- EmptyState组件
- LoadingSpinner组件
- 场景覆盖

**D7. 响应式布局（简化版）**
- 侧边栏折叠
- MiniMap隐藏

---

## 执行顺序

```
阶段1（C4基础节点）→ 阶段2（C1 AI定位）→ 阶段3（C2 Browser Use）→ 阶段4（D1-D7样式）
    ↓                    ↓                    ↓                    ↓
 2-3天               3-4天               2-3天                5-7天
```

---

## 下一步

1. 审查本实施计划
2. 执行阶段1（补全基础节点）
3. 继续后续阶段
