# Automa 参考文档

## 概述

Automa 是一个浏览器自动化扩展，通过可视化的块连接方式构建自动化工作流。

- GitHub: https://github.com/AutomaApp/automa
- 官网: https://www.automa.site/
- 文档: https://docs.automa.site/

## 核心概念

### 工作流 (Workflow)

工作流由节点（Blocks）和连接（Edges）组成，定义自动化任务的执行顺序。

### 块 (Block)

每个块代表一个操作，如点击、输入、提取数据等。

### 触发器 (Trigger)

工作流的启动方式：
- 手动触发
- 定时触发（Cron）
- 访问特定网页时触发
- 快捷键触发
- 右键菜单触发

## 工作流 JSON 结构

```json
{
  "id": "workflow-id",
  "name": "Workflow Name",
  "description": "Description",
  "drawflow": {
    "nodes": {
      "1": {
        "id": 1,
        "name": "trigger",
        "data": {
          "type": "manual"
        },
        "outputs": {
          "output_1": {
            "connections": [{ "node": "2", "output": "input_1" }]
          }
        },
        "pos_x": 100,
        "pos_y": 100
      },
      "2": {
        "id": 2,
        "name": "new-tab",
        "data": {
          "url": "https://example.com",
          "active": true,
          "waitTabLoaded": true
        },
        "inputs": {
          "input_1": {
            "connections": [{ "node": "1", "input": "output_1" }]
          }
        },
        "outputs": {
          "output_1": {
            "connections": []
          }
        },
        "pos_x": 300,
        "pos_y": 100
      }
    }
  },
  "settings": {
    "timeout": 120000,
    "onError": "stop"
  },
  "globalData": "",
  "version": "1.29.0"
}
```

## 块类型

### 触发器块
- `trigger` - 工作流触发器

### 浏览器块
- `new-tab` - 打开新标签页
- `switch-tab` - 切换标签页
- `close-tab` - 关闭标签页
- `go-back` - 后退
- `go-forward` - 前进
- `active-tab` - 激活标签页

### 网页交互块
- `click-element` - 点击元素
- `forms` - 表单填写
- `get-text` - 获取文本
- `attribute-value` - 获取属性值
- `scroll-element` - 滚动
- `hover-element` - 悬停
- `press-key` - 按键
- `upload-file` - 上传文件

### 数据块
- `insert-data` - 插入数据
- `export-data` - 导出数据
- `google-sheets` - Google Sheets 集成
- `loop-data` - 数据循环
- `loop-elements` - 元素循环

### 控制块
- `delay` - 延迟
- `conditions` - 条件判断
- `while-loop` - 循环
- `repeat-task` - 重复任务
- `break-loop` - 跳出循环

### 其他块
- `javascript-code` - 执行 JavaScript
- `webhook` - Webhook 请求
- `take-screenshot` - 截图
- `clipboard` - 剪贴板操作

## 元素选择器

Automa 支持多种元素定位方式：

```json
{
  "selector": "input[name='email']",  // CSS 选择器
  "findBy": "cssSelector"             // cssSelector | xpath | id | className
}
```

## 变量系统

### 全局变量
```
{{globalData}}
{{globalData.key}}
```

### 表格变量
```
{{table}}
{{table@column_name}}
{{table[0].column_name}}
```

### 循环变量
```
{{loopData}}
{{loopData@index}}
```

### 上一个块输出
```
{{output}}
{{prevBlockData}}
```

## 项目结构

```
automa/
├── src/
│   ├── background/           # 后台脚本
│   ├── components/           # Vue 组件
│   │   └── newtab/
│   │       └── workflow/
│   │           └── edit/     # 工作流编辑器
│   ├── content/              # 内容脚本
│   ├── workflowEngine/       # 工作流引擎
│   │   ├── blocksHandler/    # 块处理器
│   │   └── templating/       # 模板引擎
│   └── utils/
├── manifest.json
└── package.json
```

## 关键文件

- `src/workflowEngine/WorkflowEngine.js` - 工作流引擎主类
- `src/workflowEngine/blocksHandler/` - 各类块的处理逻辑
- `src/components/newtab/workflow/edit/` - 编辑器组件

## SchemaFlow 借鉴要点

### 1. 节点设计

Automa 的块设计简洁，每个块有：
- `name` - 块类型
- `data` - 配置数据
- `inputs/outputs` - 连接点

SchemaFlow 采用类似结构：
```json
{
  "id": "node_1",
  "type": "click",
  "config": { ... },
  "meta": { ... }
}
```

### 2. 变量引用语法

借鉴 `{{variable}}` 语法：
```json
{
  "type": "input_text",
  "config": {
    "value": "{{extracted_answer}}"
  }
}
```

### 3. 可视化编辑器

Automa 使用 Drawflow 库，SchemaFlow 使用 ReactFlow：
- 节点拖拽
- 连线
- 属性面板
- 缩放/平移

### 4. 错误处理

Automa 的错误处理策略：
- `stop` - 停止执行
- `continue` - 继续执行
- `restart` - 重新开始

SchemaFlow 可采用类似机制。

## 与 Browser Use 的差异

| 特性 | Automa | Browser Use |
|------|--------|-------------|
| 执行方式 | 确定性，按节点顺序 | AI 规划，动态决策 |
| 元素定位 | CSS/XPath 选择器 | AI 理解页面语义 |
| 灵活性 | 固定流程 | 适应页面变化 |
| 学习成本 | 低，可视化操作 | 低，自然语言描述 |
| 可靠性 | 高（选择器准确时） | 中（依赖 AI 判断） |

## SchemaFlow 的定位

结合两者优势：
1. 可视化编辑器（借鉴 Automa）
2. AI 执行能力（集成 Browser Use）
3. 操作录制（AI 执行 → 确定性节点）
4. 混合模式（确定性 + AI 节点共存）
