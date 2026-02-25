import { useState, useRef, useEffect } from 'react'
import { useWorkflowStore } from '@/stores/workflowStore'
import { useExecutionStore } from '@/stores/executionStore'
import { toast } from '@/stores/uiStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Workflow } from '@/types/workflow'
import { 
  Play, 
  Square, 
  RefreshCw, 
  PanelRight, 
  Menu,
  Workflow as WorkflowIcon,
  Info
} from 'lucide-react'

type ExecutionStatus = 'idle' | 'running' | 'success' | 'error'
type ExecutionMode = 'headless' | 'headed'

interface HeaderProps {
  onExecute: () => void
  onStop: () => void
  onTogglePanel: () => void
  showPanel: boolean
  onToggleSidebar?: () => void
  sidebarCollapsed?: boolean
}

const SchemaFlowLogo = () => (
  <div className="flex items-center justify-center w-8 h-8 bg-blue-500 rounded-lg">
    <WorkflowIcon className="w-5 h-5 text-white" />
  </div>
)

function EditableWorkflowName({ workflow }: { workflow: Workflow }) {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { saveWorkflow } = useWorkflowStore()

  const handleStartEdit = () => {
    setName(workflow.name)
    setIsEditing(true)
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
  }

  const handleSave = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setIsEditing(false)
      return
    }

    if (trimmedName !== workflow.name) {
      try {
        await saveWorkflow({ ...workflow, name: trimmedName })
        useWorkflowStore.getState().updateWorkflowInList(workflow.id, { name: trimmedName })
        toast.success('名称已更新')
      } catch (error) {
        console.error('更新名称失败:', error)
        toast.error('更新失败')
      }
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
    }
  }

  if (isEditing) {
    return (
      <div className="w-40">
        <Input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          size="sm"
          autoFocus
        />
      </div>
    )
  }

  return (
    <button
      onClick={handleStartEdit}
      className="px-2 py-0.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded transition-colors max-w-[240px] truncate"
      title="点击编辑名称"
    >
      {workflow.name}
    </button>
  )
}

function ExecuteButton({
  status,
  onExecute,
  onStop,
}: {
  status: ExecutionStatus
  onExecute: () => void
  onStop: () => void
}) {
  switch (status) {
    case 'running':
      return (
        <Button
          onClick={onStop}
          variant="secondary"
          size="sm"
          icon={<Square className="w-4 h-4" />}
        >
          停止
        </Button>
      )
    case 'success':
      return (
        <Button
          onClick={onExecute}
          variant="primary"
          size="sm"
          icon={<Play className="w-4 h-4" />}
        >
          重新执行
        </Button>
      )
    case 'error':
      return (
        <Button
          onClick={onExecute}
          variant="danger"
          size="sm"
          icon={<RefreshCw className="w-4 h-4" />}
        >
          重试
        </Button>
      )
    default:
      return (
        <Button
          onClick={onExecute}
          variant="primary"
          size="sm"
          icon={<Play className="w-4 h-4" />}
        >
          执行
        </Button>
      )
  }
}

export function Header({
  onExecute,
  onStop,
  onTogglePanel,
  showPanel,
  onToggleSidebar,
  sidebarCollapsed = true,
}: HeaderProps) {
  const { currentWorkflow } = useWorkflowStore()
  const { executionState, executionMode, setExecutionMode } = useExecutionStore()
  const lastExecutionIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (executionState.executionId) {
      lastExecutionIdRef.current = executionState.executionId
    }
  }, [executionState.executionId])

  const hasFailedNodes = Object.values(executionState.nodeStatuses).some((s) => s === 'failed')
  const hasCompletedNodes = Object.values(executionState.nodeStatuses).some((s) => s === 'completed')
  // eslint-disable-next-line react-hooks/refs
  const isCurrentExecution = executionState.executionId !== null && executionState.executionId === lastExecutionIdRef.current

  let executionStatus: ExecutionStatus = 'idle'
  if (executionState.isRunning) {
    executionStatus = 'running'
  } else if (isCurrentExecution && hasFailedNodes) {
    executionStatus = 'error'
  } else if (isCurrentExecution && hasCompletedNodes) {
    executionStatus = 'success'
  }

function ExecutionModeToggle({ 
  mode, 
  onChange 
}: { 
  mode: ExecutionMode
  onChange: (mode: ExecutionMode) => void 
}) {
  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center bg-neutral-100 rounded-md p-0.5 border border-neutral-200">
        <button
          onClick={() => onChange('headless')}
          className={`px-2.5 py-1 text-xs font-medium rounded transition-all ${
            mode === 'headless'
              ? 'bg-white text-neutral-900 shadow-sm'
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          后台
        </button>
        <button
          onClick={() => onChange('headed')}
          className={`px-2.5 py-1 text-xs font-medium rounded transition-all ${
            mode === 'headed'
              ? 'bg-white text-neutral-900 shadow-sm'
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          前台
        </button>
      </div>
      <div className="relative group">
        <Info className="w-3.5 h-3.5 text-neutral-400 cursor-help" />
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1.5 bg-neutral-800 text-white text-xs rounded whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
          <div className="mb-1"><span className="font-medium">后台模式：</span>无界面执行</div>
          <div><span className="font-medium">前台模式：</span>显示浏览器窗口</div>
        </div>
      </div>
    </div>
  )
}

  return (
    <header className="h-14 bg-white border-b border-neutral-200 flex items-center justify-between px-3 md:px-4 shrink-0">
      <div className="flex items-center gap-3 md:gap-4">
        {onToggleSidebar && (
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={onToggleSidebar}
            className="md:hidden"
            title={sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
            aria-label={sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
          >
            <Menu className="w-5 h-5" />
          </Button>
        )}
        <div className="flex items-center gap-2.5">
          <SchemaFlowLogo />
          <span className="font-semibold text-neutral-900 tracking-tight text-sm md:text-base">SchemaFlow</span>
        </div>

        {currentWorkflow && (
          <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-neutral-200">
            <EditableWorkflowName workflow={currentWorkflow} />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {currentWorkflow && (
          <>
            <ExecutionModeToggle 
              mode={executionMode} 
              onChange={setExecutionMode} 
            />

            <ExecuteButton status={executionStatus} onExecute={onExecute} onStop={onStop} />

            <Button
              variant={showPanel ? 'secondary' : 'ghost'}
              size="sm"
              icon={<PanelRight className="w-4 h-4" />}
              onClick={onTogglePanel}
            >
              <span className="hidden md:inline">{showPanel ? '隐藏' : '监控'}</span>
            </Button>

            <ApiTriggerHelpButton workflowId={currentWorkflow.id} />
          </>
        )}
      </div>
    </header>
  )
}

type TabType = 'endpoint' | 'curl' | 'javascript' | 'skill'

// API 触发帮助按钮
function ApiTriggerHelpButton({ workflowId }: { workflowId: string }) {
  const [showModal, setShowModal] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('endpoint')

  const triggerUrl = `http://localhost:8000/api/trigger/${workflowId}`
  const curlExample = `curl -X POST "${triggerUrl}" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "variables": {},
    "headless": true
  }'`

  const javascriptExample = `const triggerWorkflow = async () => {
  const response = await fetch('${triggerUrl}', {
    method: 'POST',
    headers: {
      'X-API-Key': 'YOUR_API_KEY',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      variables: {},
      headless: true
    })
  })
  const result = await response.json()
  console.log('执行ID:', result.data.execution_id)
}`

  const SKILL_MD_CONTENT = `---
name: schemaflow-trigger
description: |
  Trigger SchemaFlow workflows via API. Use when user wants to:
  (1) Execute a saved workflow programmatically
  (2) Get execution results from a triggered workflow
  (3) Integrate SchemaFlow with other automation tools
---

# SchemaFlow Workflow Trigger

## Configuration

Set these environment variables or modify the script:
- \`SCHEMAFLOW_API_KEY\`: Your API key
- \`SCHEMAFLOW_BASE_URL\`: Default is http://localhost:8000

## Usage

\`scripts/trigger.py\` provides helper functions:

- \`trigger_workflow(workflow_id, variables, headless)\` - Start execution
- \`get_result(execution_id)\` - Get execution result

## Example

\`\`\`python
import asyncio
from trigger import trigger_workflow, get_result

async def main():
    # Trigger workflow
    result = await trigger_workflow("workflow-id", {"url": "https://example.com"})
    print(f"Execution started: {result['execution_id']}")
    
    # Get result
    status = await get_result(result['execution_id'])
    print(f"Status: {status['status']}")

asyncio.run(main())
\`\`\`
`

  const TRIGGER_PY_CONTENT = `import os
import httpx

API_KEY = os.getenv("SCHEMAFLOW_API_KEY", "YOUR_API_KEY")
BASE_URL = os.getenv("SCHEMAFLOW_BASE_URL", "http://localhost:8000")

async def trigger_workflow(workflow_id: str, variables: dict = None, headless: bool = True) -> dict:
    """触发工作流执行"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{BASE_URL}/api/trigger/{workflow_id}",
            headers={"X-API-Key": API_KEY},
            json={"variables": variables or {}, "headless": headless},
            timeout=30.0
        )
        response.raise_for_status()
        return response.json()

async def get_result(execution_id: str) -> dict:
    """获取执行结果"""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{BASE_URL}/api/trigger/{execution_id}/result",
            headers={"X-API-Key": API_KEY},
            timeout=30.0
        )
        response.raise_for_status()
        return response.json()

async def wait_for_completion(execution_id: str, timeout: float = 300.0, poll_interval: float = 2.0) -> dict:
    """等待执行完成并返回结果"""
    import asyncio
    start_time = asyncio.get_event_loop().time()
    
    while True:
        result = await get_result(execution_id)
        if result.get("status") in ("completed", "failed", "cancelled"):
            return result
        
        elapsed = asyncio.get_event_loop().time() - start_time
        if elapsed >= timeout:
            raise TimeoutError(f"Execution {execution_id} did not complete within {timeout}s")
        
        await asyncio.sleep(poll_interval)
`

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const downloadSkill = () => {
    const skillContent = `schemaflow-trigger/SKILL.md
${'='.repeat(40)}
${SKILL_MD_CONTENT}

schemaflow-trigger/scripts/trigger.py
${'='.repeat(40)}
${TRIGGER_PY_CONTENT}`
    const blob = new Blob([skillContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'schemaflow-trigger.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded border border-blue-200 hover:border-blue-300 transition-colors"
        title="API 调用说明"
      >
        API
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">API 触发说明</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setActiveTab('endpoint')}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    activeTab === 'endpoint'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  触发端点
                </button>
                <button
                  onClick={() => setActiveTab('curl')}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    activeTab === 'curl'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  cURL
                </button>
                <button
                  onClick={() => setActiveTab('javascript')}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    activeTab === 'javascript'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  JavaScript
                </button>
                <button
                  onClick={() => setActiveTab('skill')}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    activeTab === 'skill'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Skill
                </button>
              </div>

              <div className="space-y-4">
                {activeTab === 'endpoint' && (
                  <>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h3 className="text-sm font-medium text-blue-900 mb-2">触发端点</h3>
                      <code className="text-sm text-blue-800 break-all">{triggerUrl}</code>
                    </div>
                    <div className="text-sm text-gray-500 space-y-1">
                      <p>• API Key 存储在服务端 data/api_keys.json 文件中</p>
                      <p>• 首次启动时会自动生成默认 API Key</p>
                      <p>• 执行结果可通过 GET /api/trigger/&#123;execution_id&#125;/result 查询</p>
                    </div>
                  </>
                )}

                {activeTab === 'curl' && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-700">cURL 示例</h3>
                      <button
                        onClick={() => copyToClipboard(curlExample)}
                        className="text-sm text-blue-500 hover:text-blue-600"
                      >
                        复制
                      </button>
                    </div>
                    <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs overflow-x-auto">
                      {curlExample}
                    </pre>
                  </div>
                )}

                {activeTab === 'javascript' && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-700">JavaScript 示例</h3>
                      <button
                        onClick={() => copyToClipboard(javascriptExample)}
                        className="text-sm text-blue-500 hover:text-blue-600"
                      >
                        复制
                      </button>
                    </div>
                    <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs overflow-x-auto">
                      {javascriptExample}
                    </pre>
                  </div>
                )}

                {activeTab === 'skill' && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Skill 文件结构</h4>
                      <pre className="bg-gray-50 p-3 rounded text-sm overflow-x-auto text-gray-800">
{`schemaflow-trigger/
├── SKILL.md
└── scripts/
    └── trigger.py`}
                      </pre>
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">SKILL.md</h4>
                        <button
                          onClick={() => copyToClipboard(SKILL_MD_CONTENT)}
                          className="text-sm text-blue-500 hover:text-blue-600"
                        >
                          复制
                        </button>
                      </div>
                      <pre className="bg-gray-50 p-3 rounded text-sm overflow-x-auto text-gray-800 whitespace-pre-wrap max-h-64 overflow-y-auto">
                        {SKILL_MD_CONTENT}
                      </pre>
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">scripts/trigger.py</h4>
                        <button
                          onClick={() => copyToClipboard(TRIGGER_PY_CONTENT)}
                          className="text-sm text-blue-500 hover:text-blue-600"
                        >
                          复制
                        </button>
                      </div>
                      <pre className="bg-gray-50 p-3 rounded text-sm overflow-x-auto text-gray-800 max-h-64 overflow-y-auto">
                        {TRIGGER_PY_CONTENT}
                      </pre>
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={downloadSkill}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                      >
                        下载 Skill 包
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
                >
                  知道了
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
