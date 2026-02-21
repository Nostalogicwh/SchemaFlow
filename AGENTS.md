# AI Agent 技能使用指南

## 重要原则

**在使用任何工具之前，必须先检查是否有适用的技能。**

即使你认为只有 1% 的可能性，也必须调用技能检查。这不是可选的，是强制要求。

## 可用技能列表

### Superpowers（流程控制技能）

这些技能决定 HOW 来处理任务：

| 技能名称 | 用途 | 类型 |
|---------|------|------|
| `brainstorming` | 将创意转化为设计，必须在使用前理解需求和设计 | Rigid |
| `writing-plans` | 根据规格文档编写详细实施计划 | Rigid |
| `executing-plans` | 执行已有实施计划（跨会话） | Rigid |
| `test-driven-development` | 在编写实现代码之前先写测试 | Rigid |
| `systematic-debugging` | 遇到 bug 或异常行为时的系统化调试流程 | Rigid |
| `verification-before-completion` | 在声称完成前运行验证命令确认 | Rigid |
| `using-git-worktrees` | 需要隔离开发环境时创建 git worktree | Flexible |
| `dispatching-parallel-agents` | 面对多个独立任务时可并行工作 | Flexible |
| `subagent-driven-development` | 在当前会话执行包含独立任务的计划 | Flexible |
| `finishing-a-development-branch` | 实现完成后决定如何集成工作 | Flexible |
| `requesting-code-review` | 完成主要功能或合并前请求代码审查 | Flexible |
| `receiving-code-review` | 接收代码审查反馈时使用 | Rigid |
| `writing-skills` | 创建、编辑或验证新技能时使用 | Rigid |
| `using-superpowers` | 本技能，了解如何查找和使用技能 | Rigid |

### 领域特定技能

这些技能引导特定领域的实现：

| 技能名称 | 用途 |
|---------|------|
| `frontend-design` | 创建高质量的前端界面、组件、页面 |
| `web-artifacts-builder` | 创建复杂的多组件 HTML/React 工件 |
| `mcp-builder` | 构建高质量的 MCP 服务器 |
| `webapp-testing` | 使用 Playwright 测试本地 Web 应用 |
| `docx` | 创建、读取、编辑 Word 文档 |
| `pdf` | PDF 文件处理（读取、合并、拆分、OCR 等） |
| `pptx` | 演示文稿处理 |
| `xlsx` | 电子表格处理 |
| `doc-coauthoring` | 文档协作编写工作流 |
| `brand-guidelines` | 应用 Anthropic 品牌设计风格 |
| `theme-factory` | 为文档、报告等应用主题样式 |
| `canvas-design` | 创建视觉艺术设计 |
| `algorithmic-art` | 使用 p5.js 创建算法艺术 |
| `internal-comms` | 撰写内部沟通文档 |
| `slack-gif-creator` | 创建 Slack 优化的 GIF 动画 |
| `skill-creator` | 创建新的技能 |

## 技能使用流程

```
收到用户请求
    ↓
是否有 1% 可能性需要技能？
    ↓ 是
调用 Skill 工具
    ↓
技能要求执行流程
    ↓
完成任务
```

## 技能优先级

当多个技能可能适用时，按以下顺序：

1. **流程技能优先**（brainstorming、debugging）- 确定如何处理任务
2. **实现技能其次**（frontend-design、mcp-builder）- 引导具体实现

示例：
- "我们要构建 X" → brainstorming → 实现技能
- "修复这个 bug" → systematic-debugging → 领域技能

## 常见场景技能映射

### 开发新功能

```
需求 → brainstorming（理解需求、设计方案）→ writing-plans（编写实施计划）→ executing-plans（执行计划）
```

### 修复 Bug

```
Bug 报告 → systematic-debugging（系统化调试）→ 实施修复 → verification-before-completion（验证）
```

### 架构重构

```
重构计划 → brainstorming（设计方案）→ writing-plans（详细计划）→ executing-plans（执行）
```

### 创建文档

```
需求 → doc-coauthoring（协作编写）或具体文档技能（docx/pdf/pptx）
```

### 前端开发

```
UI 需求 → frontend-design（设计）→ executing-plans（实施）
```

### 构建 MCP 服务器

```
需求 → brainstorming（设计）→ mcp-builder（实现）
```

## 避免的陷阱

以下想法意味着你正在为自己找借口，**必须停止**：

| 你的想法 | 现实 |
|---------|------|
| "这只是一个简单问题" | 问题也是任务，必须检查技能 |
| "我需要先获取上下文" | 技能检查在提问之前 |
| "让我先探索代码库" | 技能会告诉你如何探索 |
| "我可以快速检查 git/文件" | 文件缺少对话上下文，先检查技能 |
| "让我先收集信息" | 技能会告诉你如何收集信息 |
| "这不需要正式技能" | 如果有技能存在，就使用它 |
| "我记得这个技能" | 技能会演化，读取当前版本 |
| "这不算是任务" | 动作 = 任务，检查技能 |
| "这个技能太复杂了" | 简单的事情会变复杂，使用它 |
| "我先做这一件事" | 在做任何事之前先检查技能 |
| "这感觉很有生产力" | 不自律的行动浪费时间，技能可以防止 |
| "我知道那是什么意思" | 了解概念 ≠ 使用技能，调用它 |

## 技能类型说明

- **Rigid（刚性）**：如 TDD、debugging，严格遵循，不要偏离
- **Flexible（灵活）**：如模式，根据上下文调整原则

技能本身会告诉你属于哪种类型。

## SchemaFlow 项目常用技能组合

### 开始 V0.3 架构重构

如果 V0.3 计划已有详细设计（如 `docs/v0.3/PLAN.md`）：
- 直接从 writing-plans 创建详细的实施计划（如已有计划则跳过）
- 使用 executing-plans 执行计划
- 每个阶段完成后使用 verification-before-completion 验证

如果需要新增功能设计：
- brainstorming（设计方案）→ writing-plans（实施计划）→ executing-plans（执行）

### 日常开发流程

1. 收到任务 → 检查技能 → 调用相应技能
2. 遇到 bug → systematic-debugging
3. 完成功能 → verification-before-completion
4. 前端开发 → frontend-design
5. 需要并行任务 → dispatching-parallel-agents

## 快速参考

### 我应该做什么？

- 用户说"我们开始今天的开发任务"
  - 已有详细计划？→ executing-plans 或直接实施
  - 需要设计？→ brainstorming

- 用户说"修复这个 bug"
  - systematic-debugging

- 用户说"构建 X 功能"
  - brainstorming → writing-plans → executing-plans

- 用户说"检查代码"
  - requesting-code-review

- 用户说"执行计划"
  - executing-plans

- 用户说"验证通过"
  - 继续下一步或使用 verification-before-completion

## 记住

**技能检查永远是第一步，没有任何例外。**
