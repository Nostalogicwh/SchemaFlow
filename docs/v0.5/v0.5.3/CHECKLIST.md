# v0.5.3 执行清单

## 快速开始

```bash
# 1. 创建开发分支
git checkout -b dev/v0.5.3

# 2. 按顺序执行各阶段任务
# 3. 完成后合并到 main
git checkout main && git merge dev/v0.5.3 --no-ff
git tag v0.5.3
```

---

## 任务优先级矩阵

| 任务 | 优先级 | 工时 | 依赖 |
|-----|-------|------|-----|
| 修复工作流误触发 | P0 | 2h | 无 |
| 前端补充注释 | P1 | 4h | 无 |
| 后端代码重构 | P1 | 4h | 无 |
| 字段对齐检查 | P1 | 3h | 无 |
| 一键部署脚本 | P1 | 6h | 无 |
| 日志文件管理 | P2 | 4h | 无 |
| 简化无意义检查 | P2 | 6h | 代码重构完成后 |
| 用户干预增强 | P2 | 12h | 无 |
| 国际化 | P3 | 8h | 所有任务完成后 |

---

## 关键文件修改

### 必改（Phase 1-2）
- [ ] `frontend/src/components/WorkflowList/index.tsx:225` - 修复按钮透明问题
- [ ] `frontend/src/**/*.ts` - 添加类型注释
- [ ] `backend/**/*.py` - 补充类型提示

### 建议改（Phase 3-4）
- [ ] 新增 `backend/utils/log_manager.py`
- [ ] 新增 `scripts/install.sh`, `scripts/start.sh`
- [ ] 新增 `frontend/src/i18n/` - 国际化配置
- [ ] 新增 `README.en.md`, `AGENTS.en.md` - 英文文档
- [ ] 修改 `backend/engine/actions/control.py` - 用户干预节点
- [ ] 新增 `backend/engine/intervention_manager.py` - 干预节点管理器
- [ ] 修改 `backend/engine/executor.py` - 支持回退逻辑

---

## 检查命令

```bash
# 前端检查
cd frontend && npm run build && npm run lint

# 后端检查
cd backend && .venv/bin/python -m pytest
.venv/bin/ruff check .

# 类型检查（可选）
.venv/bin/python -m mypy engine/ api/
```

---

## 提交规范

```
feat: 新增 xxx 功能
fix: 修复 xxx 问题
docs: 更新 xxx 文档
refactor: 重构 xxx 代码
test: 添加 xxx 测试
chore: 更新脚本/配置
```

---

## 完成标记

- [ ] dev/v0.5.3 分支创建
- [ ] Phase 1 完成（代码重构）
- [ ] Phase 2 完成（功能修复）
- [ ] Phase 3 完成（优化）
- [ ] Phase 4 完成（新增功能）
- [ ] 测试全部通过
- [ ] 合并到 main
- [ ] 打 tag v0.5.3
