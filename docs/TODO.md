# SchemaFlow 待办清单

## 已完成 ✓

### 第一阶段：后端核心基础设施

- [x] 创建后端目录结构
- [x] 配置 `requirements.txt`
- [x] 配置 `.env.example` 文件
- [x] 创建 `.agents.yaml` 开发规范文件
- [x] 实现存储层（StorageBase + JSONFileStorage）
- [x] 实现动作注册表（ActionRegistry）
- [x] 实现基础节点（start, end）
- [x] 实现浏览器操作节点（open_tab, navigate, click, input_text, screenshot）
- [x] 实现控制节点（wait, wait_for_element, user_input）
- [x] 实现数据节点（extract_text, copy_to_clipboard, paste_from_clipboard, set_variable）
- [x] 实现 AI 节点（ai_action）
- [x] 实现工作流执行器（WorkflowExecutor）
- [x] 实现拓扑排序
- [x] 实现 FastAPI 端点（workflows, actions, execution）
- [x] 实现 WebSocket 连接管理器
- [x] 实现 FastAPI 主入口
- [x] 更新 README 文档

### 第二阶段：WebSocket 实时推流

- [x] 实现 WebSocket 连接管理器（ConnectionManager）
- [x] 集成 WebSocket 到执行器
- [x] 实现 WebSocket 端点
- [x] 创建简单 HTML/JS 测试页面
- [x] 更新 README

---

## 待办事项

### 第三阶段：前端可视化编辑器

#### 3.1 前端项目初始化
- [x] 创建 Vite + React + TypeScript 项目
- [x] 安装依赖：ReactFlow, Tailwind CSS, axios
- [x] 配置开发服务器
- [x] 配置路径别名

#### 3.2 类型定义
- [x] 创建 `types/workflow.ts`
- [x] 定义 Node, Edge, Workflow 类型
- [x] 定义 ActionMetadata 类型
- [x] 定义 WebSocket 消息类型

#### 3.3 API 封装
- [x] 创建 `api/index.ts`
- [x] 封装 axios 实例
- [x] 实现工作流 CRUD 方法
- [x] 实现 AI 生成方法

#### 3.4 WebSocket Hook
- [x] 创建 `hooks/useWebSocket.ts`
- [x] 实现连接管理
- [x] 处理消息收发
- [x] 实现自动重连

#### 3.5 节点组件
- [x] 创建 `components/FlowEditor/nodes/BaseNode.tsx`
- [x] 创建 `components/FlowEditor/nodes/StartNode.tsx`
- [x] 创建 `components/FlowEditor/nodes/EndNode.tsx`
- [x] 创建 `components/FlowEditor/nodes/BrowserNode.tsx`
- [x] 创建 `components/FlowEditor/nodes/DataNode.tsx`
- [x] 创建 `components/FlowEditor/nodes/ControlNode.tsx`
- [x] 创建 `components/FlowEditor/nodes/AINode.tsx`
- [x] 节点状态显示（idle/running/completed/failed）

#### 3.6 属性面板
- [x] 创建 `components/FlowEditor/panels/NodePanel.tsx`
- [x] 动态表单渲染
- [x] 参数验证
- [x] 保存配置

#### 3.7 可视化编辑器主组件
- [x] 创建 `components/FlowEditor/index.tsx`
- [x] 集成 ReactFlow
- [x] 实现节点拖拽
- [x] 实现连线功能
- [x] 实现画布操作（缩放、平移）
- [x] 实现工具栏

#### 3.8 工作流列表
- [x] 创建 `components/WorkflowList/index.tsx`
- [x] 显示工作流列表
- [x] 创建/删除工作流
- [x] 选择工作流加载到编辑器

#### 3.9 执行监控面板
- [x] 创建 `components/ExecutionPanel/index.tsx`
- [x] 集成 WebSocket
- [x] 显示实时截图
- [x] 显示执行日志
- [x] 处理用户输入请求

#### 3.10 主应用
- [x] 创建 `App.tsx`
- [x] 创建 `main.tsx`
- [ ] 配置路由
- [x] 布局设计

---

### 第四阶段：AI 生成与完善

#### 4.1 AI 工作流生成器（后端）
- [ ] 创建 `backend/ai/generator.py`
- [ ] 实现 WorkflowGenerator 类
- [ ] 构建 System Prompt（包含所有节点定义）
- [ ] 调用 OpenAI 格式 API
- [ ] 解析并验证生成的工作流 JSON
- [ ] 实现 refine_workflow 方法（根据反馈修改）

#### 4.2 AI 生成 API（后端）
- [ ] 创建 `backend/api/ai.py`
- [ ] 实现 `POST /api/ai/generate` 端点
- [ ] 保存生成的工作流
- [ ] 返回工作流 ID

#### 4.3 前端 AI 生成界面
- [ ] 创建 `components/AIGenerate/index.tsx`
- [ ] 自然语言输入框
- [ ] 生成按钮和加载状态
- [ ] 错误提示
- [ ] 生成后自动加载到编辑器

#### 4.4 UI/UX 完善
- [ ] 美化节点样式
- [ ] 添加快捷键支持
- [ ] 优化响应式布局
- [ ] 添加加载动画
- [ ] 错误处理优化
- [ ] 空状态页面

#### 4.5 文档和部署
- [ ] 编写完整使用指南
- [ ] 编写 API 文档
- [ ] 添加示例工作流
- [ ] 配置部署脚本
- [ ] Docker 支持（可选）

---

### 其他优化项

#### 功能增强
- [ ] 实现 Browser Use 集成（ai_action 节点）
- [ ] 实现操作录制功能
- [ ] 支持分支/循环节点
- [ ] 支持子工作流
- [ ] 导出/导入工作流

#### 性能优化
- [ ] 大型工作流渲染优化
- [ ] 截图压缩和缓存
- [ ] 日志分页加载

#### 测试
- [ ] 后端单元测试
- [ ] 前端组件测试
- [ ] E2E 测试
- [ ] 集成测试

---

## 开发规范

### 代码规范（`.agents.yaml`）
- 所有代码注释使用中文
- 变量名和函数名使用英文（驼峰命名）
- 文档字符串使用中文

### 提交规范
- feat: 新功能
- fix: 修复 bug
- docs: 文档更新
- style: 代码格式调整
- refactor: 重构
- test: 测试
- chore: 构建/工具

---

## MVP 验收标准

### 场景验证
- [ ] 能拖拽创建和连接节点
- [ ] 能配置节点参数
- [ ] 能保存工作流
- [ ] 能执行工作流并查看实时状态
- [ ] 能通过自然语言生成工作流
- [ ] 能完成 DeepSeek -> Notion 场景

### 功能验证
- [ ] 所有节点类型正常工作
- [ ] 变量引用正常工作
- [ ] WebSocket 连接稳定
- [ ] 截图实时推送正常
- [ ] 用户输入机制正常

---

## 备注

- 当前后端基础架构已完成，可独立运行
- 测试页面位于 `frontend/test.html`
- 启动命令：`cd backend && python main.py`
