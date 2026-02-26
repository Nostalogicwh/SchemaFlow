# v0.5.3 可执行方案

## 版本目标
优化代码质量、修复已知问题、提升用户体验，为后续版本打下坚实基础。

---

## 任务列表

### Phase 1: 代码重构与优化

#### 1.1 前端代码补充注释
**优先级**: 高  
**预计工时**: 4小时  
**状态**: 待开始

**详细说明**:
- 为核心组件添加 JSDoc 注释
- 补充类型定义说明
- 记录关键函数用途
- 标记复杂逻辑

**涉及文件**:
- `frontend/src/components/FlowEditor/**/*.tsx`
- `frontend/src/stores/*.ts`
- `frontend/src/hooks/*.ts`
- `frontend/src/api/**/*.ts`

**验收标准**:
- [ ] 所有组件函数添加描述注释
- [ ] 类型定义添加中文说明
- [ ] 复杂逻辑添加代码块注释
- [ ] 关键参数说明用途

---

#### 1.2 前后端代码检查重构
**优先级**: 高  
**预计工时**: 8小时  
**状态**: 待开始

**详细说明**:
- 检查 TypeScript 类型安全
- 检查 Python 类型提示
- 统一错误处理模式
- 消除重复代码

**前端检查项**:
- [ ] 修复 `any` 类型使用
- [ ] 检查 Zustand Store 类型定义
- [ ] 验证 API 调用错误处理
- [ ] 检查 React Hook 依赖数组

**后端检查项**:
- [ ] 检查所有函数类型提示
- [ ] 验证异常处理完整性
- [ ] 检查导入语句排序
- [ ] 验证文档字符串完整性

**验收标准**:
- [ ] `npm run build` 无 TypeScript 错误
- [ ] `npm run lint` 无 ESLint 警告
- [ ] `.venv/bin/python -m mypy backend/` 无类型错误
- [ ] `.venv/bin/ruff check backend/` 无代码风格问题

---

### Phase 2: 功能修复

#### 2.1 修复工作流列表误触发执行问题
**优先级**: 最高  
**预计工时**: 2小时  
**状态**: 待开始  
**问题定位**: `frontend/src/components/WorkflowList/index.tsx:225-249`

**问题描述**:
点击工作流时，会莫名其妙自行执行。原因为操作按钮使用了 `opacity-0 group-hover:opacity-100`，在特定条件下（如触摸设备、快速点击）按钮可能不可见但可点击。

**解决方案**:
1. 使用 `visibility: hidden` 替代 `opacity: 0`
2. 添加 `pointer-events-none` 防止不可见按钮接收点击
3. 增加点击区域确认逻辑

**代码修改**:
```tsx
// 修改前
<div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">

// 修改后
<div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity invisible group-hover:visible">
```

**验收标准**:
- [ ] 点击工作流仅选中，不触发执行
- [ ] 鼠标悬停后显示操作按钮
- [ ] 触摸设备行为正常
- [ ] 添加单元测试覆盖

---

#### 2.2 检查前后端字段对齐
**优先级**: 高  
**预计工时**: 3小时  
**状态**: 待开始

**检查内容**:
- 对比 TypeScript 类型与 Pydantic 模型
- 检查 API 请求/响应字段一致性
- 验证 WebSocket 消息格式

**涉及文件对比**:
| 前端类型 | 后端模型 |
|---------|---------|
| `types/workflow.ts` | `backend/models/*.py` |
| `types/execution.ts` | `backend/engine/context.py` |
| `api/index.ts` | `backend/api/*.py` |

**验收标准**:
- [ ] 字段命名一致
- [ ] 必填/可选字段匹配
- [ ] 默认值一致
- [ ] 类型定义文档同步

---

### Phase 3: 优化

#### 3.1 日志文件管理
**优先级**: 中  
**预计工时**: 4小时  
**状态**: 待开始

**需求说明**:
- 日志自动归档
- 日志文件大小限制
- 日志保留策略
- 日志查看界面

**实现方案**:
1. 创建 `backend/utils/log_manager.py`
2. 实现日志轮转（RotatingFileHandler）
3. 添加日志清理定时任务
4. 前端增加日志查看组件

**配置项**:
```python
# backend/config/settings.py
LOG_CONFIG = {
    "max_bytes": 10 * 1024 * 1024,  # 10MB
    "backup_count": 5,
    "retention_days": 30,
}
```

**验收标准**:
- [ ] 日志文件自动轮转
- [ ] 超过保留期的日志自动清理
- [ ] 前端可查看最近7天日志
- [ ] 支持日志级别筛选

---

#### 3.2 国际化（i18n）
**优先级**: 低  
**预计工时**: 8小时  
**状态**: 待开始

**实现方案**:
1. **前端国际化**
   - 引入 `react-i18next`
   - 创建翻译文件 `frontend/src/i18n/zh-CN.json`、`en-US.json`
   - 提取所有硬编码中文文本
   - 实现语言切换组件

2. **文档国际化**
   - 创建英文版 README（`README.en.md`）
   - 版本开发文档保持中文（如 docs/v0.5/v0.5.3/PLAN.md 保持中文）

**文件结构**:
```
frontend/src/i18n/
├── index.ts
├── zh-CN.json
└── en-US.json

docs/
├── README.zh.md
├── README.en.md
├── AGENTS.zh.md
└── AGENTS.en.md
```

**验收标准**:
- [ ] 所有 UI 文本通过 i18n 渲染
- [ ] 支持中英文切换
- [ ] 语言偏好持久化（localStorage）
- [ ] README、AGENTS 等核心文档有英文版
- [ ] 翻译文件可扩展（支持其他语言）

---

#### 3.3 简化无意义检查
**优先级**: 中  
**预计工时**: 6小时  
**状态**: 待开始

**优化目标**:
- 移除冗余的 if-else 嵌套
- 简化过度防御性代码
- 合并重复逻辑
- 使用早期返回模式

**检查范围**:
- `backend/engine/executor.py`
- `backend/engine/actions/*.py`
- `frontend/src/stores/*.ts`
- `frontend/src/hooks/*.ts`

**示例优化**:
```python
# 优化前
if condition:
    if another_condition:
        do_something()
    else:
        return
else:
    return

# 优化后
if not condition or not another_condition:
    return
do_something()
```

**验收标准**:
- [ ] 代码行数减少 10%+
- [ ] 圈复杂度降低
- [ ] 逻辑等价且测试通过
- [ ] 性能无下降

---

### Phase 4: 新增功能

#### 4.1 一键部署脚本
**优先级**: 高  
**预计工时**: 6小时  
**状态**: 待开始

**需求说明**:
- 自动化环境准备
- 依赖安装
- 服务启动
- Docker 支持

**脚本清单**:
```
scripts/
├── install.sh          # 安装脚本
├── start.sh            # 启动脚本
├── stop.sh             # 停止脚本
└── docker/
    ├── Dockerfile
    ├── docker-compose.yml
    └── .dockerignore
```

**功能特性**:
- [ ] 自动检测 Python/Node 环境
- [ ] 自动创建虚拟环境
- [ ] 自动安装依赖
- [ ] 数据库初始化（如需要）
- [ ] 配置文件生成

**验收标准**:
- [ ] 新用户可在 5 分钟内完成部署
- [ ] 支持 macOS/Linux
- [ ] Docker 一键启动
- [ ] 脚本有完整的错误处理

---

#### 4.2 用户干预节点增强
**优先级**: 中  
**预计工时**: 12小时  
**状态**: 待开始

**需求说明**:
用户干预节点支持配置化跳过（基于浏览器状态），跳过后的节点执行失败时支持回退到干预节点。

**核心场景**:
1. 保存了网页浏览器状态（如已登录状态）
2. 配置了跳过用户干预节点（如"完成验证码"）
3. 跳过后执行下一节点（如"访问个人中心"）
4. **问题场景**: 存储的登录信息已过期，导致下一节点报错
5. **解决方案**: 自动回退到用户干预节点，让用户重新完成操作

**实现方案**:

1. **跳过配置**
   - 添加 `skip_conditions` 字段
   - 支持条件表达式：`browser_state_exists`、`session_valid` 等
   - 执行时检测浏览器状态是否满足条件

2. **失败回退机制**
   - 添加 `fallback_on_failure` 布尔字段（是否启用失败回退）
   - 添加 `max_fallback_attempts` 限制回退次数（防止无限循环）
   - 节点执行失败时，检查是否有上游干预节点可回退
   - 回退时重置浏览器状态标记

3. **执行流程**:
   ```
   用户干预节点 (A) → 下一节点 (B)
   
   场景1: 正常执行
   A(跳过) → B(成功) → 继续执行
   
   场景2: 登录过期，需要回退
   A(跳过) → B(失败: SessionExpired) → 回退到 A → A(人工干预) → B(重试)
   ```

4. **状态管理**:
   - 扩展 `ExecutionContext`，记录跳过的干预节点历史
   - 添加 `skipped_interventions` 列表，记录跳过的节点ID和当时的浏览器状态
   - 执行失败时查询可回退的干预节点

5. **错误检测**:
   - 定义可回退的错误类型：`SessionExpired`、`AuthenticationRequired`、`StateInvalid`
   - 其他错误（如网络错误、元素未找到）不回退

**配置示例**:
```json
{
  "id": "user_intervention_1",
  "action": "user_intervention",
  "config": {
    "message": "请完成验证码",
    "skip_conditions": [
      {
        "type": "browser_state",
        "key": "last_session_time",
        "operator": "within",
        "value": "24h"
      }
    ],
    "fallback_on_failure": true,
    "max_fallback_attempts": 3,
    "fallback_errors": ["SessionExpired", "AuthenticationRequired"]
  }
}
```

**后端实现**:
- 修改 `backend/engine/actions/control.py` - `user_intervention` 动作
- 修改 `backend/engine/executor.py` - 执行器支持回退逻辑
- 新增 `backend/engine/intervention_manager.py` - 干预节点管理器

**前端实现**:
- 节点配置面板添加回退设置
- 执行面板显示回退提示

**验收标准**:
- [ ] 满足跳过条件时正确跳过干预节点
- [ ] 跳过后的节点因登录过期失败时，自动回退到干预节点
- [ ] 回退次数限制有效，防止无限循环
- [ ] 回退后用户完成干预可继续执行
- [ ] 状态记录完整（跳过历史、回退原因）
- [ ] 测试用例覆盖核心场景

---

## 开发计划

### 第1周（Phase 1 + Phase 2）
- [ ] Day 1-2: 前端代码补充注释
- [ ] Day 3: 后端代码检查重构
- [ ] Day 4: 修复工作流列表误触发问题
- [ ] Day 5: 检查前后端字段对齐

### 第2周（Phase 3）
- [ ] Day 1-2: 日志文件管理
- [ ] Day 3-4: 简化无意义检查
- [ ] Day 5: 国际化（可选，时间不足可推迟）

### 第3周（Phase 4）
- [ ] Day 1-2: 一键部署脚本
- [ ] Day 3-5: 用户干预节点增强

---

## 风险与应对

| 风险 | 可能性 | 影响 | 应对措施 |
|-----|-------|------|---------|
| 代码重构引入 Bug | 中 | 高 | 增加代码审查，完善测试覆盖 |
| 字段对齐导致 API 不兼容 | 低 | 高 | 仔细对比，灰度验证 |
| 用户干预回退逻辑复杂 | 中 | 中 | 分阶段实现，先支持基础功能 |
| 部署脚本环境差异 | 高 | 中 | 提供 Docker 方案，降低环境依赖 |

---

## 验收标准

1. **功能完整**
   - 所有 Phase 2 修复项完成
   - 核心功能无回归

2. **代码质量**
   - TypeScript 无类型错误
   - Python 类型提示完整
   - ESLint/Ruff 无警告

3. **测试覆盖**
   - 新增功能有测试用例
   - 修复的问题有回归测试
   - 整体覆盖率不低于 60%

4. **文档更新**
   - API 文档更新
   - 部署文档更新
   - CHANGELOG 更新

---

## 分支策略

```bash
# 创建开发分支
git checkout -b dev/v0.5.3

# 功能开发（示例）
git checkout -b feature/v0.5.3-frontend-comments
git checkout -b feature/v0.5.3-fix-workflow-trigger
git checkout -b feature/v0.5.3-log-management

# 完成后合并到 dev/v0.5.3
git checkout dev/v0.5.3
git merge feature/xxx --no-ff

# 最终合并到 main
git checkout main
git merge dev/v0.5.3 --no-ff
git tag v0.5.3
```
