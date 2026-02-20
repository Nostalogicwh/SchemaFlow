# Browser Use 参考文档

## 概述

Browser Use 是一个 AI 驱动的浏览器自动化框架，使用 LLM 理解自然语言指令并执行浏览器操作。

- GitHub: https://github.com/browser-use/browser-use
- 文档: https://docs.browser-use.com

## 核心概念

### Agent

Agent 是核心执行单元，接收任务描述并自动规划执行：

```python
from browser_use import Agent, Browser, ChatBrowserUse
import asyncio

async def example():
    browser = Browser()
    llm = ChatBrowserUse()
    
    agent = Agent(
        task="Find the number of stars of the browser-use repo",
        llm=llm,
        browser=browser,
    )
    
    history = await agent.run()
    return history

asyncio.run(example())
```

### Browser

Browser 封装了 Playwright，支持有头/无头模式：

```python
browser = Browser(
    headless=False,  # 有头模式，用户可见
    # use_cloud=True,  # 使用云端浏览器
)
```

### 自定义工具

可以扩展 Agent 的能力：

```python
from browser_use import Tools

tools = Tools()

@tools.action(description='Description of what this tool does.')
def custom_tool(param: str) -> str:
    return f"Result: {param}"

agent = Agent(
    task="Your task",
    llm=llm,
    browser=browser,
    tools=tools,
)
```

## 项目结构

```
browser_use/
├── agent/          # Agent 核心逻辑
├── browser/        # 浏览器控制封装
├── controller/     # 操作控制器
├── dom/            # DOM 解析
├── llm/            # LLM 集成
├── tools/          # 工具系统
└── skills/         # 技能系统
```

## 关键文件

- `browser_use/agent/service.py` - Agent 主类
- `browser_use/browser/browser.py` - Browser 封装
- `browser_use/controller/service.py` - 操作控制器
- `browser_use/tools/service.py` - 工具注册系统

## SchemaFlow 集成要点

### 1. 复用 Browser Use 的 Agent

```python
from browser_use import Agent, Browser
from browser_use.llm import ChatBrowserUse

class AIActionNode:
    async def execute(self, context, config):
        agent = Agent(
            task=config['prompt'],
            llm=ChatBrowserUse(),
            browser=context.browser,
        )
        history = await agent.run()
        return history
```

### 2. 操作录制

Browser Use 执行时会产生操作历史，可用于录制：

```python
history = await agent.run()
# history 包含执行的每个步骤
for step in history:
    # 转换为 SchemaFlow 节点
    node = convert_to_node(step)
```

### 3. 共享浏览器实例

SchemaFlow 需要在多个节点间共享同一个浏览器：

```python
class ExecutionContext:
    def __init__(self):
        self.browser = Browser(headless=False)
        self.variables = {}
    
    async def close(self):
        await self.browser.close()
```

## 支持的 LLM

- ChatBrowserUse（官方优化模型）
- OpenAI GPT-4
- Anthropic Claude
- Google Gemini
- 本地模型（Ollama）

## 安装

```bash
pip install browser-use
# 安装浏览器
uvx browser-use install
```

## 环境变量

```
BROWSER_USE_API_KEY=your-key  # 使用官方 LLM
OPENAI_API_KEY=your-key       # 使用 OpenAI
ANTHROPIC_API_KEY=your-key    # 使用 Claude
```
