# 浏览器登录态持久化 — 实现方案（Chrome 扩展版）

## 背景

工作流执行时需要目标网站的登录态（如 DeepSeek、内部系统等），但 Playwright 启动的独立浏览器没有任何 cookies。由于浏览器同源策略限制，前端页面（`localhost:3000`）无法读取其他域名的 cookies 和 localStorage。

**解决方案**：开发一个轻量 Chrome 扩展（CRX），利用 `chrome.cookies.getAll()` API 跨域采集用户浏览器中所有 cookies，发送给后端保存，在工作流执行时注入到 Playwright 上下文中。

## 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│  用户浏览器（Chrome）                                         │
│                                                             │
│  ┌──────────────┐    postMessage     ┌──────────────────┐   │
│  │ SchemaFlow   │ ◄────────────────► │ PlayFlow 扩展    │   │
│  │ 前端页面      │   请求/响应        │ (content script)  │   │
│  │ localhost:3000│                   │                  │   │
│  └──────┬───────┘                   │  background.js   │   │
│         │ axios                     │  chrome.cookies   │   │
│         │                           │  .getAll()       │   │
└─────────┼───────────────────────────┴──────────────────┘   │
          │ POST /api/browser-state/cookies                   │
          ▼                                                   │
┌─────────────────────┐                                       │
│  SchemaFlow 后端     │                                       │
│  FastAPI :8000       │                                       │
│                     │                                       │
│  保存到文件:         │                                       │
│  data/browser_states│                                       │
│  /global_state.json │                                       │
│                     │                                       │
│  执行工作流时:       │    Playwright                         │
│  new_context(       │───────────────► 独立 Chromium          │
│   storage_state=...)│    注入 cookies   （已携带登录态）       │
└─────────────────────┘                                       │
```

## 涉及的文件

### 新建文件

| 文件 | 说明 |
|------|------|
| `extension/manifest.json` | Chrome 扩展清单（MV3） |
| `extension/background.js` | Service Worker，调用 `chrome.cookies` API |
| `extension/content.js` | Content Script，与前端页面通信 |
| `extension/icons/icon-*.png` | 扩展图标（16/48/128） |
| `backend/api/browser_state.py` | 后端 API：接收/查询/清除 cookies |
| `backend/engine/browser_state.py` | BrowserStateManager：状态文件读写 |
| `frontend/src/components/ExtensionGuide/` | 扩展安装引导弹窗组件 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `backend/main.py` | 注册 `browser_state.router` |
| `backend/engine/browser_manager.py` | 回退时加载 storage_state |
| `frontend/src/api/index.ts` | 新增 `browserStateApi` |
| `frontend/src/components/Header.tsx` | 添加扩展状态指示器 + 入口按钮 |
| `.gitignore` | 添加 `backend/data/browser_states/` |

---

## 一、Chrome 扩展（`extension/`）

### 1.1 目录结构

```
extension/
├── manifest.json
├── background.js
├── content.js
└── icons/
    ├── icon-16.png
    ├── icon-48.png
    └── icon-128.png
```

### 1.2 `manifest.json`

```json
{
  "manifest_version": 3,
  "name": "PlayFlow Cookie Collector",
  "description": "为 SchemaFlow 工作流采集浏览器登录态",
  "version": "1.0.0",
  "permissions": [
    "cookies"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": [
        "http://localhost:*/*",
        "http://127.0.0.1:*/*"
      ],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

关键说明：
- `permissions: ["cookies"]`：允许扩展跨域读取所有 cookies
- `host_permissions: ["<all_urls>"]`：cookies API 需要此权限才能读取所有域名
- `content_scripts.matches`：仅在 SchemaFlow 前端页面注入 content script
- 企业内网分发：打包为 `.crx` 文件，用户拖拽安装或通过组策略部署

### 1.3 `background.js`（Service Worker）

```javascript
/**
 * PlayFlow Cookie Collector - Background Service Worker
 * 负责调用 chrome.cookies API 采集 cookies
 */

// 监听来自 content script 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'COLLECT_COOKIES') {
    collectCookies(request.domains)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true; // 异步响应
  }

  if (request.type === 'PING') {
    sendResponse({ status: 'ok', version: chrome.runtime.getManifest().version });
    return false;
  }
});

/**
 * 采集 cookies
 * @param {string[]} [domains] - 可选，指定域名列表。为空则采集全部。
 * @returns {Promise<{cookies: Array}>}
 */
async function collectCookies(domains) {
  let allCookies = [];

  if (domains && domains.length > 0) {
    // 按指定域名采集
    for (const domain of domains) {
      const cookies = await chrome.cookies.getAll({ domain });
      allCookies.push(...cookies);
    }
    // 去重（同一个 cookie 可能因 domain 匹配规则被重复获取）
    const seen = new Set();
    allCookies = allCookies.filter(c => {
      const key = `${c.domain}|${c.path}|${c.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } else {
    // 采集全部 cookies
    allCookies = await chrome.cookies.getAll({});
  }

  // 转换为 Playwright storage_state 格式
  const playwrightCookies = allCookies.map(cookie => ({
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path,
    expires: cookie.expirationDate || -1,
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: normalizeSameSite(cookie.sameSite),
  }));

  return { cookies: playwrightCookies, count: playwrightCookies.length };
}

/**
 * 将 Chrome 的 sameSite 值转换为 Playwright 格式
 */
function normalizeSameSite(sameSite) {
  const map = {
    'no_restriction': 'None',
    'lax': 'Lax',
    'strict': 'Strict',
    'unspecified': 'Lax',  // Chrome 默认行为
  };
  return map[sameSite] || 'Lax';
}
```

### 1.4 `content.js`（Content Script）

```javascript
/**
 * PlayFlow Cookie Collector - Content Script
 * 注入到 SchemaFlow 前端页面，负责页面与扩展之间的通信桥梁
 */

// 扩展加载完成后，通知页面
window.postMessage({
  type: 'PLAYFLOW_EXTENSION_READY',
  version: chrome.runtime.getManifest().version
}, '*');

// 监听来自页面的请求
window.addEventListener('message', async (event) => {
  // 安全检查：只处理来自同一窗口的消息
  if (event.source !== window) return;

  const { type, requestId } = event.data;

  // 心跳检测
  if (type === 'PLAYFLOW_PING') {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'PING' });
      window.postMessage({
        type: 'PLAYFLOW_PONG',
        requestId,
        data: response
      }, '*');
    } catch (err) {
      // 扩展可能已被卸载
      window.postMessage({
        type: 'PLAYFLOW_PONG',
        requestId,
        error: err.message
      }, '*');
    }
  }

  // 采集 cookies
  if (type === 'PLAYFLOW_COLLECT_COOKIES') {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'COLLECT_COOKIES',
        domains: event.data.domains || null
      });

      window.postMessage({
        type: 'PLAYFLOW_COOKIES_RESULT',
        requestId,
        data: response
      }, '*');
    } catch (err) {
      window.postMessage({
        type: 'PLAYFLOW_COOKIES_RESULT',
        requestId,
        error: err.message
      }, '*');
    }
  }
});
```

### 1.5 通信协议汇总

| 方向 | 消息类型 | 载荷 | 说明 |
|------|---------|------|------|
| 扩展 → 页面 | `PLAYFLOW_EXTENSION_READY` | `{ version }` | 扩展安装/加载完成 |
| 页面 → 扩展 | `PLAYFLOW_PING` | `{ requestId }` | 检测扩展是否可用 |
| 扩展 → 页面 | `PLAYFLOW_PONG` | `{ requestId, data }` | 心跳响应 |
| 页面 → 扩展 | `PLAYFLOW_COLLECT_COOKIES` | `{ requestId, domains? }` | 请求采集 cookies |
| 扩展 → 页面 | `PLAYFLOW_COOKIES_RESULT` | `{ requestId, data/error }` | 返回采集结果 |

---

## 二、后端改动

### 2.1 新建 `backend/engine/browser_state.py`

状态文件管理器，将扩展采集的 cookies 转存为 Playwright `storage_state` 格式。

```python
"""浏览器状态持久化管理。"""
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List


class BrowserStateManager:
    """管理浏览器 storage_state 的保存和加载。"""

    STATE_DIR = Path("./data/browser_states")
    STATE_FILE = "global_state.json"

    @classmethod
    def _ensure_dir(cls):
        cls.STATE_DIR.mkdir(parents=True, exist_ok=True)

    @classmethod
    def get_state_path(cls) -> Path:
        return cls.STATE_DIR / cls.STATE_FILE

    @classmethod
    def save_cookies(cls, cookies: List[Dict[str, Any]]) -> Dict[str, Any]:
        """将前端提交的 cookies 保存为 Playwright storage_state 格式。

        Args:
            cookies: Playwright 格式的 cookie 列表

        Returns:
            保存结果摘要
        """
        cls._ensure_dir()

        state = {
            "cookies": cookies,
            "origins": [],  # localStorage 暂不通过扩展采集
            "_meta": {
                "saved_at": datetime.now().isoformat(),
                "source": "chrome_extension",
                "cookie_count": len(cookies)
            }
        }

        state_path = cls.get_state_path()
        with open(str(state_path), "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=2)

        # 统计涉及的域名
        domains = sorted(set(c.get("domain", "") for c in cookies))

        return {
            "cookie_count": len(cookies),
            "domains": domains,
            "saved_at": state["_meta"]["saved_at"]
        }

    @classmethod
    def load_state_path(cls) -> Optional[str]:
        """获取可用的状态文件路径（供 new_context(storage_state=...) 使用）。

        Returns:
            状态文件路径字符串，不存在则返回 None
        """
        state_path = cls.get_state_path()
        if state_path.exists() and state_path.stat().st_size > 0:
            return str(state_path)
        return None

    @classmethod
    def get_state_info(cls) -> Optional[Dict[str, Any]]:
        """获取已保存状态的摘要信息。"""
        state_path = cls.get_state_path()
        if not state_path.exists():
            return None

        try:
            with open(str(state_path), "r", encoding="utf-8") as f:
                state = json.load(f)

            meta = state.get("_meta", {})
            domains = sorted(set(
                c.get("domain", "") for c in state.get("cookies", [])
            ))

            return {
                "saved_at": meta.get("saved_at"),
                "source": meta.get("source"),
                "cookie_count": meta.get("cookie_count", 0),
                "domains": domains
            }
        except Exception:
            return None

    @classmethod
    def clear_state(cls) -> bool:
        """清除已保存的状态。"""
        state_path = cls.get_state_path()
        if state_path.exists():
            os.remove(str(state_path))
            return True
        return False
```

### 2.2 新建 `backend/api/browser_state.py`

提供 REST API 供前端提交和管理 cookies。

```python
"""浏览器状态管理 API。"""
from typing import List, Dict, Any
from fastapi import APIRouter

router = APIRouter(prefix="/api/browser-state", tags=["browser-state"])


@router.post("/cookies")
async def save_cookies(payload: Dict[str, Any]):
    """接收前端（通过扩展采集的）cookies 并保存。

    请求体:
        { "cookies": [ { name, value, domain, path, expires, ... }, ... ] }
    """
    from engine.browser_state import BrowserStateManager

    cookies = payload.get("cookies", [])
    if not cookies:
        return {"success": False, "message": "未收到任何 cookies"}

    result = BrowserStateManager.save_cookies(cookies)
    return {"success": True, **result}


@router.get("/status")
async def get_state_status():
    """查询当前已保存的浏览器状态。"""
    from engine.browser_state import BrowserStateManager

    info = BrowserStateManager.get_state_info()
    if info is None:
        return {"has_state": False}

    return {"has_state": True, **info}


@router.delete("/cookies")
async def clear_cookies():
    """清除已保存的浏览器状态。"""
    from engine.browser_state import BrowserStateManager

    removed = BrowserStateManager.clear_state()
    return {"success": removed}
```

### 2.3 修改 `backend/main.py`

注册新路由：

```python
from api import workflows, actions, execution, ai_generate, browser_state

# ... 已有路由 ...
app.include_router(browser_state.router)
```

### 2.4 修改 `backend/engine/browser_manager.py`

在 CDP 连接全部失败、回退到独立浏览器时，尝试加载已保存的状态。

修改 `connect()` 方法中回退逻辑（当前约第 190-197 行）：

```python
# ── 当前代码（替换掉） ──
await context.log("warn", "启动独立浏览器（无登录态）...")
context.browser = await self.playwright.chromium.launch(headless=headless)
context.page = await context.browser.new_page()
context._is_cdp = False
context._reused_page = False
return False, False

# ── 替换为 ──
from .browser_state import BrowserStateManager

context.browser = await self.playwright.chromium.launch(headless=headless)

saved_state = BrowserStateManager.load_state_path()
if saved_state:
    await context.log("info", "检测到已保存的登录态，正在注入...")
    try:
        browser_context = await context.browser.new_context(
            storage_state=saved_state
        )
        context.page = await browser_context.new_page()
        await context.log("info", "✓ 登录态注入成功")
    except Exception as e:
        await context.log("warn", f"登录态注入失败，使用空白浏览器: {e}")
        context.page = await context.browser.new_page()
else:
    await context.log("warn", "启动独立浏览器（无已保存的登录态）...")
    await context.log("info", "提示：安装 PlayFlow 扩展可自动同步登录态")
    context.page = await context.browser.new_page()

context._is_cdp = False
context._reused_page = False
return False, False
```

---

## 三、前端改动

### 3.1 `frontend/src/api/index.ts` — 新增 API

```typescript
// 浏览器状态 API
export const browserStateApi = {
  // 提交 cookies（扩展采集后调用）
  saveCookies: async (cookies: any[]): Promise<{
    success: boolean
    cookie_count?: number
    domains?: string[]
    saved_at?: string
  }> => {
    const { data } = await api.post('/browser-state/cookies', { cookies })
    return data
  },

  // 查询已保存状态
  getStatus: async (): Promise<{
    has_state: boolean
    cookie_count?: number
    domains?: string[]
    saved_at?: string
  }> => {
    const { data } = await api.get('/browser-state/status')
    return data
  },

  // 清除已保存状态
  clearCookies: async (): Promise<{ success: boolean }> => {
    const { data } = await api.delete('/browser-state/cookies')
    return data
  },
}
```

### 3.2 `frontend/src/hooks/useExtension.ts` — 扩展通信 Hook

封装与 Chrome 扩展的 postMessage 通信。

```typescript
import { useState, useEffect, useCallback, useRef } from 'react'
import { browserStateApi } from '@/api'
import { toast } from '@/stores/uiStore'

interface ExtensionState {
  /** 扩展是否已安装且可用 */
  installed: boolean
  /** 扩展版本号 */
  version: string | null
  /** 是否正在采集 */
  collecting: boolean
  /** 后端是否已有保存的状态 */
  hasState: boolean
  /** 已保存的 cookie 数量 */
  cookieCount: number
  /** 涉及的域名列表 */
  domains: string[]
}

export function useExtension() {
  const [state, setState] = useState<ExtensionState>({
    installed: false,
    version: null,
    collecting: false,
    hasState: false,
    cookieCount: 0,
    domains: [],
  })
  const pendingRequests = useRef<Map<string, (data: any) => void>>(new Map())

  // 监听来自扩展的消息
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== window) return

      const { type, requestId, data, error } = event.data

      // 扩展安装/加载通知
      if (type === 'PLAYFLOW_EXTENSION_READY') {
        setState(prev => ({
          ...prev,
          installed: true,
          version: event.data.version || null
        }))
      }

      // 心跳响应
      if (type === 'PLAYFLOW_PONG' && requestId) {
        const resolve = pendingRequests.current.get(requestId)
        if (resolve) {
          resolve(error ? null : data)
          pendingRequests.current.delete(requestId)
        }
      }

      // Cookies 采集结果
      if (type === 'PLAYFLOW_COOKIES_RESULT' && requestId) {
        const resolve = pendingRequests.current.get(requestId)
        if (resolve) {
          resolve(error ? { error } : data)
          pendingRequests.current.delete(requestId)
        }
      }
    }

    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  // 启动时检测扩展和后端状态
  useEffect(() => {
    // 发一个 PING 检测扩展
    const reqId = `ping_${Date.now()}`
    const timeout = setTimeout(() => {
      pendingRequests.current.delete(reqId)
    }, 2000) // 2 秒内没响应视为未安装

    pendingRequests.current.set(reqId, (data) => {
      clearTimeout(timeout)
      if (data) {
        setState(prev => ({
          ...prev,
          installed: true,
          version: data.version || null
        }))
      }
    })

    window.postMessage({ type: 'PLAYFLOW_PING', requestId: reqId }, '*')

    // 查询后端状态
    browserStateApi.getStatus().then(res => {
      setState(prev => ({
        ...prev,
        hasState: res.has_state,
        cookieCount: res.cookie_count || 0,
        domains: res.domains || [],
      }))
    }).catch(() => {})
  }, [])

  // 触发 cookie 采集
  const collectCookies = useCallback(async (domains?: string[]) => {
    setState(prev => ({ ...prev, collecting: true }))

    try {
      const reqId = `collect_${Date.now()}`

      const result = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => {
          pendingRequests.current.delete(reqId)
          reject(new Error('采集超时'))
        }, 10000)

        pendingRequests.current.set(reqId, (data) => {
          clearTimeout(timeout)
          resolve(data)
        })

        window.postMessage({
          type: 'PLAYFLOW_COLLECT_COOKIES',
          requestId: reqId,
          domains,
        }, '*')
      })

      if (result.error) {
        throw new Error(result.error)
      }

      // 发送到后端保存
      const saveResult = await browserStateApi.saveCookies(result.cookies)

      if (saveResult.success) {
        setState(prev => ({
          ...prev,
          hasState: true,
          cookieCount: saveResult.cookie_count || 0,
          domains: saveResult.domains || [],
        }))
        toast.success(`已同步 ${saveResult.cookie_count} 个 cookies`)
      }

      return saveResult
    } catch (err: any) {
      toast.error(`同步失败: ${err.message}`)
      throw err
    } finally {
      setState(prev => ({ ...prev, collecting: false }))
    }
  }, [])

  // 清除状态
  const clearState = useCallback(async () => {
    await browserStateApi.clearCookies()
    setState(prev => ({
      ...prev,
      hasState: false,
      cookieCount: 0,
      domains: [],
    }))
    toast.success('已清除登录态')
  }, [])

  return { ...state, collectCookies, clearState }
}
```

### 3.3 前端 UI 组件

#### 扩展安装引导弹窗

新建 `frontend/src/components/ExtensionGuide/index.tsx`，使用已有的 `Modal` 组件，分步骤展示安装教程：

1. 下载 CRX 文件（提供下载按钮）
2. 打开 `chrome://extensions/`
3. 开启开发者模式
4. 拖拽安装

页面底层通过 `useExtension` hook 持续监听 `PLAYFLOW_EXTENSION_READY` 消息，安装成功瞬间自动关闭弹窗并提示成功。

#### Header 集成

在 `Header.tsx` 的右侧按钮区域添加扩展状态指示器：

- **未安装扩展**：显示带提示的按钮，点击打开安装引导弹窗
- **已安装、未同步**：显示「同步登录态」按钮
- **已同步**：显示绿色圆点指示器，hover 显示详情（cookie 数量、域名列表），点击可重新同步或清除

具体 UI 设计留给实现阶段。

---

## 四、.gitignore

在项目根 `.gitignore` 中添加：

```
backend/data/browser_states/
```

---

## 五、执行流程

### 首次使用

```
1. 用户打开 SchemaFlow 前端
2. 前端检测扩展未安装 → Header 显示提示按钮
3. 用户点击 → 弹出安装引导弹窗
4. 用户按步骤安装 CRX 扩展
5. 安装成功 → content.js 注入 → postMessage EXTENSION_READY
6. 前端收到消息 → 弹窗自动关闭 → 提示「连接成功」
7. 用户点击「同步登录态」按钮
8. 前端通过 postMessage → 扩展 chrome.cookies.getAll() 采集
9. 扩展返回 cookies → 前端 POST /api/browser-state/cookies → 后端保存
10. 同步完成 → Header 显示绿色状态
```

### 工作流执行

```
1. 用户点击「运行」
2. 后端 BrowserManager.connect() 尝试 CDP 连接
3. CDP 成功 → 正常执行（与之前一致）
4. CDP 失败 → 检查 global_state.json
5. 文件存在 → browser.new_context(storage_state=...) 注入
6. 独立 Chromium 携带 cookies 打开目标页面 → 已登录状态
```

### 状态刷新

当登录态过期时：
1. 用户在自己的浏览器中重新登录目标网站
2. 回到 SchemaFlow 页面，点击「重新同步」
3. 扩展重新采集最新 cookies → 覆盖保存

---

## 六、局限性

| 局限 | 说明 | 影响程度 |
|------|------|---------|
| 仅 cookies | 扩展的 `chrome.cookies` API 只能采集 cookies，无法采集 localStorage | 中。大多数登录态依赖 cookies，少数网站用 localStorage 存 token |
| cookies 过期 | 保存的 cookies 有有效期，过期后需重新同步 | 低。用户可随时重新同步 |
| 需要安装扩展 | 用户需手动安装 CRX（非商店分发） | 低。一次安装，有引导 |
| 单用户设计 | 全局共享一份状态 | 低。当前为单用户本地部署 |

---

## 七、验证方法

1. **扩展安装**：打包 CRX → 拖拽安装 → 前端控制台是否收到 `PLAYFLOW_EXTENSION_READY`
2. **Cookie 采集**：点击同步 → 检查 `data/browser_states/global_state.json` 内容是否正确
3. **状态注入**：关闭 Chrome 调试端口 → 执行工作流 → 查看日志是否有「登录态注入成功」→ 目标页面是否已登录
4. **状态清除**：点击清除 → 确认文件已删除 → 执行工作流回退到空白浏览器

---

## 八、开发顺序建议

1. **先做后端**：`browser_state.py`（管理器 + API）+ `browser_manager.py` 改动 → 用 curl 验证接口
2. **再做扩展**：`extension/` 三个文件 → 安装后在控制台手动 postMessage 测试
3. **最后做前端**：`useExtension` hook → UI 组件 → 串联测试
