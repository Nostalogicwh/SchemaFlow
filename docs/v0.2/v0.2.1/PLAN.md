# V0.2.1 可执行计划

## 存在问题

1. CDP 连接后新开页面仍无登录态——`new_page()` 创建的标签页不共享已有标签页的 session
2. 后端没有 .venv 虚拟环境，直接使用了系统 Python
3. LLM 配置（`api_key`、`base_url`、`model`）散落在代码中，CDP 端口硬编码，缺少统一配置管理

---

## 问题 1：CDP 模式下登录态丢失

### 根因分析

当前 `executor.py:142-145` 通过 CDP 连接后调用 `default_context.new_page()` 创建新标签页。虽然 Cookie 在 BrowserContext 级别共享，但目标站点可能使用 sessionStorage 等非 Cookie 机制，新标签页无法继承。

### 解决方案

复用用户已打开的标签页，而非创建新页面。优先查找已有页面，找不到时再 `new_page()`。

### 涉及文件

| 文件 | 改动 |
|---|---|
| `backend/engine/executor.py` | CDP 连接后优先复用已有页面；CDP 端口从配置读取 |
| `backend/engine/context.py` | 增加 `_reused_page` 标记，cleanup 时不关闭复用的页面 |

### 实施步骤

1. CDP 连接成功后，遍历 `default_context.pages`，优先复用第一个非空白页面（`page.url != "about:blank"`）
2. 如果没有可复用页面，再调用 `new_page()`
3. 在 `context` 上标记 `_reused_page = True/False`，cleanup 时若为复用页面则不关闭
4. CDP 端口从 `settings.toml` 读取（见问题 3）

---

## 问题 2：后端缺少 venv 虚拟环境

### 根因分析

后端目录下没有创建 `.venv`，所有依赖安装在系统 Python 中，容易造成依赖冲突。

### 解决方案

创建 `.venv` 并将依赖安装到虚拟环境中。

### 实施步骤

1. `cd backend && python3 -m venv .venv`
2. `.venv/bin/pip install -r requirements.txt`
3. `.venv/bin/playwright install chromium`
4. 后续启动使用 `.venv/bin/python main.py`

> `.venv/` 已在 `.gitignore` 中，无需额外处理。

---

## 问题 3：配置统一管理（settings.toml）

### 根因分析

当前配置散落在多处：
- `ai_generate.py:95-96` — `LLM_API_KEY`、`LLM_BASE_URL` 通过环境变量读取，默认值硬编码
- `ai_generate.py:17` — 默认模型 `deepseek-chat` 硬编码
- `executor.py:141` — CDP 端口 `9222` 硬编码
- `main.py:58-63` — 服务端口 `8000`、host `0.0.0.0` 硬编码

### 解决方案

新建 `backend/settings.toml` 作为统一配置文件，创建 `backend/config.py` 单例提供全局访问。环境变量优先级高于配置文件。

### settings.toml 结构

```toml
[server]
host = "0.0.0.0"
port = 8000

[browser]
cdp_url = "http://localhost:9222"

[llm]
api_key = ""          # 留空，优先从环境变量 LLM_API_KEY 读取
base_url = "https://api.deepseek.com/v1"
model = "deepseek-chat"
temperature = 0.1
timeout = 60
```

### 涉及文件

| 文件 | 改动 |
|---|---|
| `backend/settings.toml`（新建） | 配置文件 |
| `backend/config.py`（新建） | 配置加载，环境变量优先覆盖 |
| `backend/main.py` | 从 config 读取 host/port |
| `backend/engine/executor.py` | 从 config 读取 cdp_url |
| `backend/api/ai_generate.py` | 从 config 读取 llm 配置 |
| `.gitignore` | 添加 `settings.local.toml` |

### 实施步骤

1. 创建 `backend/settings.toml`，包含所有默认配置
2. 创建 `backend/config.py`：
   - 加载 `settings.toml`，再尝试加载 `settings.local.toml` 覆盖（本地敏感配置）
   - 环境变量 `LLM_API_KEY` 优先级高于配置文件
   - 提供 `get_settings()` 函数返回配置字典
3. `executor.py` 中 `cdp_url` 改为从 config 读取
4. `ai_generate.py` 中 LLM 相关配置全部从 config 读取
5. `main.py` 中 `host`、`port` 从 config 读取

---

## 实施顺序

| 阶段 | 任务 | 依赖 |
|---|---|---|
| P0 | 问题 3：settings.toml + config.py | 无 |
| P1 | 问题 2：创建 venv 环境 | 无 |
| P2 | 问题 1：CDP 页面复用 | P0（需要从 config 读取 cdp_url） |

P0 优先，因为 P2 依赖配置模块。P1 独立可随时执行。

---

## 验证清单

1. `backend/settings.toml` 存在且包含所有配置项
2. 修改 `settings.toml` 中的端口号，确认各模块使用新值
3. 设置 `LLM_API_KEY` 环境变量，确认优先级高于 `settings.toml`
4. `backend/.venv/` 存在，`.venv/bin/python main.py` 能正常启动
5. 启动带调试端口的 Chrome，登录 DeepSeek，执行工作流，确认复用已有页面且登录态保留
6. 执行完成后确认复用的页面未被关闭
7. 运行提交前验证脚本全部通过