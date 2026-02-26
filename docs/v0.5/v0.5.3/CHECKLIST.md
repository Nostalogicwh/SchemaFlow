# v0.5.3 执行清单

**状态**: 已完成（待验证）  
**分支**: `dev/v0.5.3`  

---

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

| 任务 | 优先级 | 状态 | 工时 | 依赖 |
|-----|-------|------|-----|------|
| 修复工作流误触发 | P0 | ✅ 已完成 | 2h | 无 |
| 前端补充注释 | P1 | ✅ 已完成 | 4h | 无 |
| 后端代码重构 | P1 | ✅ 已完成 | 4h | 无 |
| 字段对齐检查 | P1 | ✅ 已完成 | 3h | 无 |
| 一键部署脚本 | P1 | ✅ 已完成 | 6h | 无 |
| 日志文件管理 | P2 | ✅ 已完成 | 4h | 无 |
| 简化无意义检查 | P2 | ⏸️ 推迟到v0.5.4 | 6h | 代码重构完成后 |
| 用户干预增强 | P2 | ⏸️ 推迟到v0.5.4 | 12h | 无 |
| 国际化 | P3 | ⏸️ 推迟到v0.5.4 | 8h | 所有任务完成后 |

---

## 关键文件修改

### 已完成 ✅
- [x] `frontend/src/components/WorkflowList/index.tsx:225` - 修复按钮透明问题（添加 invisible + pointer-events-none）
- [x] `frontend/src/stores/*.ts` - 添加 JSDoc 注释
- [x] `frontend/src/hooks/*.ts` - 添加 JSDoc 注释
- [x] `frontend/src/api/index.ts` - 添加 JSDoc 注释
- [x] `backend/**/*.py` - Ruff 代码风格修复（57处自动修复 + 手动修复）
- [x] 新增 `backend/utils/log_manager.py` - 日志管理器
- [x] 新增 `scripts/install.sh` - 安装脚本
- [x] 新增 `scripts/start.sh` - 启动脚本
- [x] 新增 `scripts/stop.sh` - 停止脚本
- [x] 新增 `scripts/docker/Dockerfile` - Docker 构建
- [x] 新增 `scripts/docker/docker-compose.yml` - Docker Compose

### 推迟到 v0.5.4 ⏸️
- [ ] 新增 `frontend/src/i18n/` - 国际化配置
- [ ] 新增 `README.en.md` - 英文文档
- [ ] 修改 `backend/engine/actions/control.py` - 用户干预节点
- [ ] 新增 `backend/engine/intervention_manager.py` - 干预节点管理器
- [ ] 修改 `backend/engine/executor.py` - 支持回退逻辑

---

## 检查命令（待执行）

```bash
# 前端检查
cd frontend && npm run build && npm run lint

# 后端检查
cd backend && .venv/bin/python -m pytest
.venv/bin/ruff check .

# 类型检查（可选）
.venv/bin/python -m mypy engine/ api/

# 部署脚本测试
./scripts/install.sh
./scripts/start.sh
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

## 完成标记（待验证）

- [x] dev/v0.5.3 分支创建
- [x] Phase 1 完成（代码重构）
- [x] Phase 2 完成（功能修复）
- [x] Phase 3 完成（优化）- 部分完成（日志管理已完成，简化检查推迟）
- [ ] Phase 4 完成（新增功能）- 部分完成（部署脚本已完成，用户干预推迟）
- [ ] 测试全部通过 - **待验证**
- [ ] 合并到 main - **待执行**
- [ ] 打 tag v0.5.3 - **待执行**

---

## 已知问题

1. **Ruff 检查剩余**: 21个错误在 tests/ 目录中（E712比较风格问题）
2. **字段对齐**: NodeStatus枚举前后端不一致（前端: idle，后端: PENDING）
3. **Pydantic模型**: 后端API使用Dict[str, Any]，建议v0.5.4添加模型验证

---

## 后续计划（v0.5.4）

1. 简化无意义检查（代码优化）
2. 用户干预节点增强（跳过+失败回退）
3. 国际化（前端UI + README）
4. 添加Pydantic模型
5. 统一NodeStatus枚举
