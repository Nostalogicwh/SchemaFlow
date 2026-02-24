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

// 凭证状态显示组件
function CredentialStatus({ workflowId }: { workflowId: string }) {
  const [hasCredential, setHasCredential] = useState(false)

  useEffect(() => {
    const checkCredential = async () => {
      const exists = await credentialStore.has(workflowId)
      setHasCredential(exists)
    }
    checkCredential()
  }, [workflowId])

  const handleClear = async () => {
    try {
      await credentialStore.remove(workflowId)
      setHasCredential(false)
      toast.success('已清除登录凭证')
    } catch (error) {
      toast.error('清除凭证失败')
    }
  }

  if (!hasCredential) return null

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded border border-blue-200">
      <Shield className="w-3.5 h-3.5" />
      <span>已登录</span>
      <button
        onClick={handleClear}
        className="ml-1 p-0.5 hover:bg-blue-100 rounded transition-colors"
        title="清除登录凭证"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  )
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
          </>
        )}
      </div>
    </header>
  )
}
