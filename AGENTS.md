# SchemaFlow - AI 智能体开发指南

本指南帮助 AI 智能体在 SchemaFlow 代码库中高效开发。

## 构建与验证命令

### 前端（React + TypeScript + Vite）
```bash
cd frontend

# 开发
npm run dev                    # 启动开发服务器

# 构建
npm run build                  # TypeScript 检查 + Vite 构建

# 代码检查
npm run lint                   # ESLint 检查

# 测试
npm run test                   # 运行所有测试
npm run test:ui                # Vitest UI 模式
npm run test:coverage          # 覆盖率报告

# 单个测试
npx vitest run <file-path>     # e.g., npx vitest run src/components/ui/__tests__/Button.test.tsx
```

### 后端（FastAPI + Python 3.12）
```bash
cd backend

# 重要：必须使用 venv Python，禁止使用系统 Python
.venv/bin/python -m pytest    # 运行所有测试
.venv/bin/python -m pytest tests/<file>  # 单个测试文件
.venv/bin/python -m pytest tests/<file>::<test_func>  # 单个测试函数

# 验证导入（必须包含所有改动的 .py 文件）
.venv/bin/python -c "import <module1>; import <module2>"

# 启动服务器
.venv/bin/uvicorn main:app --reload
```

## 代码风格规范

### 语言与命名
- **中文项目**：所有注释和文档字符串必须使用中文
- **变量/函数名**：英文（TypeScript 用 `camelCase`，Python 用 `snake_case`）
- **类型定义**：中文 JSDoc 注释说明用途

### Python（后端）
- **遵循 PEP 8** 规范，使用 4 空格缩进
- **类型提示必需**：函数签名必须包含类型提示
- **中文文档字符串**：使用 Google 风格
  ```python
  async def execute_action(context: ExecutionContext, config: Dict[str, Any]) -> Dict[str, Any]:
      """执行节点动作。

      Args:
          context: 执行上下文
          config: 节点配置

      Returns:
          执行结果字典
      """
  ```

- **错误处理**：记录日志时包含上下文，使用具体异常类型
- **异步编程**：默认使用 async，共享状态用 `asyncio.Lock`
- **导入顺序**：标准库 → 第三方库 → 本地模块，用空行分隔

### TypeScript/React（前端）
- **2 空格缩进**
- **函数式组件**：使用 Hooks，性能优化用 `memo`
- **类型安全**：严格 TypeScript，避免 `any`
- **组件结构**：
  ```typescript
  interface Props { /* ... */ }

  function Component({ prop }: Props) {
    // 逻辑在前
    // JSX 在后
  }

  export default memo(Component)
  ```

- **样式**：全部使用 Tailwind CSS v4
- **状态管理**：全局状态用 Zustand，局部状态用 React hooks

### 文件组织
- **前端**：`src/components/<Category>/<Component>.tsx`，测试在 `__tests__/` 子目录
- **后端**：`engine/actions/<category>.py`，测试在 `backend/tests/`
- **类型定义**：`src/types/*.ts`（前端），行内类型提示（后端）

## 关键约束

### 版本开发
- **必须在分支开发**：版本功能开发前先创建 `dev/v{版本号}` 分支（如 `dev/v0.2.3`）
- 完成后合并回 `main` 分支
- 禁止直接在 `main` 提交版本功能

### Git 操作规范
- **禁止频繁切换分支**：在同一分支完成开发，避免来回切换导致状态混乱
- **禁止随意合并**：合并分支前必须确认用户意图，合并后需用户确认
- **数据目录不提交**：`backend/data/` 下的所有数据文件已在 `.gitignore` 中，禁止提交
- **合并前检查**：确保没有未提交的更改，使用 `git stash` 暂存后再操作
- **推送前确认**：推送远程前必须告知用户

### 数据管理
- **工作流数据**：`backend/data/workflows/*.json` 不纳入版本控制
- **截图数据**：`backend/data/screenshots/` 不纳入版本控制
- **浏览器状态**：`backend/data/browser_states/` 不纳入版本控制
- **API 密钥**：`backend/data/api_keys.json` 不纳入版本控制
- **执行日志**：`backend/data/logs/*.json` 不纳入版本控制

### Python 环境
- **强制要求**：所有 Python 操作必须使用 `backend/.venv/bin/python`
- 禁止使用系统 Python
- 验证必须覆盖所有改动的 `.py` 文件

### 测试要求
- 前端：新 UI 组件必须在 `__tests__/` 中有测试
- 后端：使用 `conftest.py` 中的 pytest fixtures
- 单个测试执行：提供完整测试文件路径

## 测试模式

### 前端测试示例
```typescript
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Button } from '../Button'

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click</Button>)
    expect(screen.getByText('Click')).toBeInTheDocument()
  })
})
```

### 后端测试示例
```python
import pytest
from engine.executor import WorkflowExecutor

def test_executor_initialization():
    executor = WorkflowExecutor()
    assert executor is not None
```

## 常见模式

### React 组件
- 按钮类组件使用 `forwardRef`
- 同时处理 `disabled` 和 `loading` 状态
- 图标使用 `lucide-react`

### Python 异步
- 共享状态使用 `asyncio.Lock`
- 优雅处理 websocket 的 `ConnectionClosed`
- 日志带上 execution_id 前缀：`logger.info(f"[{exec_id}] message")`

### WebSocket 消息
- 类型安全：在 `WSMessageType` 枚举中定义
- 节点相关消息必须包含 `node_id`
- 发送截图使用 `type="jpeg", quality=60`

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript + Vite + Tailwind CSS v4 + @xyflow/react |
| 后端 | FastAPI + Python 3.12 + Playwright + asyncio |
| AI | OpenAI 兼容 API（DeepSeek/Kimi） |
| 存储 | JSON 文件（预留数据库接口） |
| 通信 | REST API + WebSocket |
| 测试 | Vitest（前端）+ pytest（后端） |
