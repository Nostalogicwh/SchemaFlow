import { useState, useRef } from 'react'
import { useWorkflowStore } from '@/stores/workflowStore'
import { useExecutionStore } from '@/stores/executionStore'
import { toast } from '@/stores/uiStore'
import type { Workflow } from '@/types/workflow'

type ExecutionStatus = 'idle' | 'running' | 'success' | 'error'

interface HeaderProps {
  onExecute: () => void
  onStop: () => void
  onTogglePanel: () => void
  showPanel: boolean
  onToggleSidebar?: () => void
  sidebarCollapsed?: boolean
}

const SchemaFlowLogo = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />
    <circle cx="19" cy="18" r="2" fill="currentColor" stroke="none" />
  </svg>
)

const PlayIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
)

const StopIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="6" width="12" height="12" rx="1" />
  </svg>
)

const SpinnerIcon = () => (
  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
  </svg>
)

const CheckIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const RefreshIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M21 3v5h-5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 21v-5h5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const PanelIcon = ({ isOpen }: { isOpen: boolean }) => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d={isOpen ? "M15 3v18" : "M9 3v18"} />
  </svg>
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
        useWorkflowStore.getState().refreshList()
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
      <input
        ref={inputRef}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="px-2 py-0.5 text-sm font-medium bg-white border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-200 min-w-[120px] max-w-[240px]"
      />
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
  const baseClasses =
    'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded transition-all duration-200'

  switch (status) {
    case 'running':
      return (
        <button
          onClick={onStop}
          className={`${baseClasses} bg-amber-500 hover:bg-amber-600 text-white shadow-sm`}
        >
          <SpinnerIcon />
          <span>执行中...</span>
          <StopIcon />
        </button>
      )
    case 'success':
      return (
        <button
          onClick={onExecute}
          className={`${baseClasses} bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm`}
        >
          <CheckIcon />
          <span>完成</span>
        </button>
      )
    case 'error':
      return (
        <button
          onClick={onExecute}
          className={`${baseClasses} bg-red-500 hover:bg-red-600 text-white shadow-sm`}
        >
          <RefreshIcon />
          <span>失败 - 重试</span>
        </button>
      )
    default:
      return (
        <button
          onClick={onExecute}
          className={`${baseClasses} bg-blue-500 hover:bg-blue-600 text-white shadow-sm`}
        >
          <PlayIcon />
          <span>运行</span>
        </button>
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

  const hasFailedNodes = Object.values(executionState.nodeStatuses).some((s) => s === 'failed')
  const hasCompletedNodes = Object.values(executionState.nodeStatuses).some((s) => s === 'completed')

  let executionStatus: ExecutionStatus = 'idle'
  if (executionState.isRunning) {
    executionStatus = 'running'
  } else if (hasFailedNodes) {
    executionStatus = 'error'
  } else if (hasCompletedNodes) {
    executionStatus = 'success'
  }

  return (
    <header className="h-12 bg-gradient-to-r from-slate-800 to-slate-700 flex items-center justify-between px-2 md:px-4 shrink-0 shadow-sm">
      <div className="flex items-center gap-2 md:gap-4">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-1.5 hover:bg-slate-700 rounded md:hidden text-white"
            title={sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {sidebarCollapsed ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              )}
            </svg>
          </button>
        )}
        <div className="flex items-center gap-2 text-white">
          <SchemaFlowLogo />
          <span className="font-semibold tracking-tight text-sm md:text-base">SchemaFlow</span>
        </div>

        {currentWorkflow && (
          <div className="hidden sm:flex items-center gap-2 pl-4 border-l border-slate-600">
            <EditableWorkflowName workflow={currentWorkflow} />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {currentWorkflow && (
          <>
            <select
              value={executionMode}
              onChange={(e) => setExecutionMode(e.target.value as 'headless' | 'headed')}
              className="px-2 py-1 text-xs md:text-sm bg-slate-100 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="headless">后台</option>
              <option value="headed">前台</option>
            </select>

            <ExecuteButton status={executionStatus} onExecute={onExecute} onStop={onStop} />

            <button
              onClick={onTogglePanel}
              className={`flex items-center gap-1 px-2 md:px-3 py-1.5 text-xs md:text-sm rounded transition-all ${
                showPanel
                  ? 'bg-slate-200 text-slate-800'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <PanelIcon isOpen={showPanel} />
              <span className="hidden md:inline">{showPanel ? '隐藏' : '监控'}</span>
            </button>
          </>
        )}
      </div>
    </header>
  )
}
