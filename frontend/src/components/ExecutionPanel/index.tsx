import { useState, useRef, useEffect, useCallback } from 'react'
import { useExecutionStore } from '@/stores/executionStore'
import { useExecution } from '@/hooks/useExecution'
import type { NodeExecutionRecord, WSLog, WSUserInputRequired } from '@/types/workflow'
import { EmptyState } from '@/components/common'
import { Button } from '@/components/ui/Button'
import { Badge, type BadgeStatus } from '@/components/ui/Badge'
import { NodeRecordList } from './NodeRecordList'
import { twSemanticColors, twColors, twTransitions } from '@/constants/designTokens'

type TabType = 'screenshot' | 'nodes' | 'logs'
type LogLevelFilter = 'all' | 'info' | 'warning' | 'error'

export function ExecutionPanel() {
  const { executionState, isConnected } = useExecutionStore()
  const { stopExecution, respondUserInput } = useExecution()

  const { isRunning, screenshot, logs, userInputRequest, nodeRecords } = executionState
  const [activeTab, setActiveTab] = useState<TabType>('screenshot')
  const [isStopping, setIsStopping] = useState(false)

  const handleStopExecution = async () => {
    setIsStopping(true)
    try {
      await stopExecution()
    } finally {
      setIsStopping(false)
    }
  }

  return (
    <div className={`h-full flex flex-col ${twSemanticColors.bg.surface} ${twSemanticColors.text.primary}`}>
      {/* Header */}
      <div className={`p-3 border-b ${twSemanticColors.border.default} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? twColors.status.success.bg : twColors.status.error.bg
            }`}
          />
          <span className="text-sm font-medium">
            {isRunning ? '执行中' : isConnected ? '已连接' : '未连接'}
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleStopExecution}
            disabled={!isRunning}
            loading={isStopping}
            variant="danger"
            size="sm"
          >
            停止
          </Button>
        </div>
      </div>

      {userInputRequest && (
        <UserInputDialog
          request={userInputRequest}
          onResponse={respondUserInput}
        />
      )}

      {/* Tabs */}
      <div className={`flex border-b ${twSemanticColors.border.default}`}>
        {([
          ['screenshot', '截图'],
          ['nodes', '节点记录'],
          ['logs', '日志'],
        ] as [TabType, string][]).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`
              relative px-4 py-2.5 text-sm font-medium
              ${twTransitions.normal}
              ${activeTab === tab
                ? twSemanticColors.text.primary
                : twSemanticColors.text.secondary + ' hover:text-neutral-700'
              }
            `}
          >
            {label}
            {tab === 'nodes' && nodeRecords.length > 0 && (
              <span className={`ml-1.5 text-xs ${twSemanticColors.text.tertiary}`}>
                ({nodeRecords.length})
              </span>
            )}
            {/* Active indicator */}
            <span
              className={`
                absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500
                ${twTransitions.normal}
                ${activeTab === tab ? 'opacity-100' : 'opacity-0'}
              `}
            />
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'screenshot' && (
          <ScreenshotView screenshot={screenshot} />
        )}

        {activeTab === 'nodes' && (
          <NodeRecordList records={nodeRecords} />
        )}

        {activeTab === 'logs' && (
          <LogViewer logs={logs} />
        )}
      </div>
    </div>
  )
}

function ScreenshotView({ screenshot }: { screenshot: string | null }) {
  const [scale, setScale] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const minScale = 0.25
  const maxScale = 4

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setScale((prev) => Math.min(maxScale, Math.max(minScale, prev + delta)))
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false })
      return () => container.removeEventListener('wheel', handleWheel)
    }
  }, [handleWheel])

  const zoomIn = () => setScale((prev) => Math.min(maxScale, prev + 0.25))
  const zoomOut = () => setScale((prev) => Math.max(minScale, prev - 0.25))
  const resetZoom = () => setScale(1)

  return (
    <>
      <div className="h-full flex flex-col">
        {/* Toolbar */}
        <div className={`flex items-center gap-2 px-3 py-2 border-b ${twSemanticColors.border.default} ${twSemanticColors.bg.sunken}`}>
          <Button
            onClick={zoomOut}
            disabled={scale <= minScale}
            variant="ghost"
            size="sm"
            iconOnly
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </Button>
          <span className={`w-16 text-center text-sm font-medium ${twSemanticColors.text.primary}`}>
            {Math.round(scale * 100)}%
          </span>
          <Button
            onClick={zoomIn}
            disabled={scale >= maxScale}
            variant="ghost"
            size="sm"
            iconOnly
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </Button>
          <Button
            onClick={resetZoom}
            variant="ghost"
            size="sm"
          >
            重置
          </Button>
          <span className={`ml-2 text-xs ${twSemanticColors.text.tertiary}`}>
            滚轮缩放 · 点击查看大图
          </span>
        </div>
        
        {/* Screenshot Area */}
        <div
          ref={containerRef}
          className={`flex-1 overflow-auto p-4 ${twSemanticColors.bg.sunken}`}
        >
          {screenshot ? (
            <img
              src={`data:image/jpeg;base64,${screenshot}`}
              alt="执行截图"
              onClick={() => setShowModal(true)}
              className="cursor-zoom-in rounded shadow-sm transition-transform origin-top-left"
              style={{ transform: `scale(${scale})` }}
              draggable={false}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <EmptyState
                icon="📸"
                title="暂无截图"
                description="执行工作流后显示截图"
              />
            </div>
          )}
        </div>
      </div>

      {showModal && screenshot && (
        <ScreenshotModal
          screenshot={screenshot}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}

function ScreenshotModal({
  screenshot,
  onClose,
}: {
  screenshot: string
  onClose: () => void
}) {
  const [scale, setScale] = useState(1)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === '+' || e.key === '=') {
        setScale((prev) => Math.min(4, prev + 0.25))
      } else if (e.key === '-') {
        setScale((prev) => Math.max(0.25, prev - 0.25))
      } else if (e.key === '0') {
        setScale(1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    modalRef.current?.focus()
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
      tabIndex={0}
    >
      {/* Toolbar */}
      <div className="absolute top-4 right-4 flex items-center gap-2 bg-neutral-800 rounded-lg p-2 text-white">
        <Button
          onClick={(e) => {
            e.stopPropagation()
            setScale((prev) => Math.max(0.25, prev - 0.25))
          }}
          variant="ghost"
          size="sm"
          iconOnly
          className="text-white hover:bg-neutral-700"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </Button>
        <span className="w-16 text-center text-sm font-medium">
          {Math.round(scale * 100)}%
        </span>
        <Button
          onClick={(e) => {
            e.stopPropagation()
            setScale((prev) => Math.min(4, prev + 0.25))
          }}
          variant="ghost"
          size="sm"
          iconOnly
          className="text-white hover:bg-neutral-700"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </Button>
        <Button
          onClick={(e) => {
            e.stopPropagation()
            setScale(1)
          }}
          variant="ghost"
          size="sm"
          className="text-white hover:bg-neutral-700"
        >
          重置
        </Button>
        <div className="w-px h-4 bg-neutral-600 mx-1" />
        <span className="text-xs text-neutral-400">ESC 关闭</span>
      </div>
      
      <img
        src={`data:image/jpeg;base64,${screenshot}`}
        alt="截图放大"
        onClick={(e) => e.stopPropagation()}
        className="max-w-full max-h-full transition-transform"
        style={{ transform: `scale(${scale})` }}
        draggable={false}
      />
    </div>
  )
}

function LogViewer({ logs }: { logs: WSLog[] }) {
  const [levelFilter, setLevelFilter] = useState<LogLevelFilter>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  const filteredLogs = logs.filter((log) => {
    if (levelFilter !== 'all' && log.level !== levelFilter) return false
    if (searchTerm && !log.message.toLowerCase().includes(searchTerm.toLowerCase()))
      return false
    return true
  })

  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [filteredLogs, autoScroll])

  const handleScroll = () => {
    if (listRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = listRef.current
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
      setAutoScroll(isAtBottom)
    }
  }

  const levelCounts = {
    all: logs.length,
    info: logs.filter((l) => l.level === 'info').length,
    warning: logs.filter((l) => l.level === 'warning').length,
    error: logs.filter((l) => l.level === 'error').length,
  }

  const getLogLevelStyle = (level: string) => {
    switch (level) {
      case 'error':
        return {
          text: twColors.status.error.text,
          bg: 'bg-red-50',
          border: 'border-red-100',
        }
      case 'warning':
        return {
          text: twColors.status.warning.text,
          bg: 'bg-amber-50',
          border: 'border-amber-100',
        }
      default:
        return {
          text: twSemanticColors.text.primary,
          bg: 'bg-transparent',
          border: 'border-transparent',
        }
    }
  }

  const filterButtons: { level: LogLevelFilter; label: string; color: string }[] = [
    { level: 'all', label: '全部', color: 'neutral' },
    { level: 'info', label: '信息', color: 'blue' },
    { level: 'warning', label: '警告', color: 'amber' },
    { level: 'error', label: '错误', color: 'red' },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Filter Toolbar */}
      <div className={`px-3 py-2 border-b ${twSemanticColors.border.default} ${twSemanticColors.bg.sunken} flex items-center gap-2`}>
        <div className="flex items-center gap-1">
          {filterButtons.map(({ level, label }) => {
            const isActive = levelFilter === level
            const variant = isActive ? 'secondary' : 'ghost'
            
            return (
              <Button
                key={level}
                onClick={() => setLevelFilter(level)}
                variant={variant}
                size="sm"
                className={isActive ? 'bg-white border-neutral-200' : ''}
              >
                {label}
                <span className={`ml-1 text-xs ${isActive ? twSemanticColors.text.secondary : twSemanticColors.text.tertiary}`}>
                  {levelCounts[level]}
                </span>
              </Button>
            )
          })}
        </div>
        <div className="flex-1" />
        <div className="relative">
          <input
            type="text"
            placeholder="搜索日志..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`
              w-48 px-3 py-1.5 text-xs rounded-md border
              ${twSemanticColors.bg.surface}
              ${twSemanticColors.border.default}
              ${twSemanticColors.text.primary}
              placeholder:text-neutral-400
              focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent
              ${twTransitions.normal}
            `}
          />
          {searchTerm && (
            <Button
              onClick={() => setSearchTerm('')}
              variant="ghost"
              size="sm"
              iconOnly
              className="absolute right-1 top-1/2 -translate-y-1/2"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          )}
        </div>
      </div>
      
      {/* Log List */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-2 text-xs font-mono relative"
      >
        {filteredLogs.length === 0 ? (
          logs.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <EmptyState
                icon="📝"
                title="暂无日志"
                description="执行过程中将显示日志信息"
              />
            </div>
          ) : (
            <div className={twSemanticColors.text.tertiary}>没有匹配的日志</div>
          )
        ) : (
          <div className="space-y-1">
            {filteredLogs.map((log, index) => {
              const style = getLogLevelStyle(log.level)
              return (
                <div
                  key={index}
                  className={`
                    py-1 px-2 rounded
                    ${style.bg} ${style.border} border
                    ${twTransitions.fast}
                  `}
                >
                  <span className={twSemanticColors.text.tertiary}>
                    [{new Date(log.timestamp).toLocaleTimeString()}]
                  </span>{' '}
                  <span className={`inline-block w-10 font-semibold ${style.text}`}>
                    [{log.level.toUpperCase().slice(0, 4)}]
                  </span>{' '}
                  <span className={`break-all ${twSemanticColors.text.primary}`}>
                    {log.message}
                  </span>
                </div>
              )
            })}
          </div>
        )}
        
        {!autoScroll && filteredLogs.length > 0 && (
          <Button
            onClick={() => {
              setAutoScroll(true)
              if (listRef.current) {
                listRef.current.scrollTop = listRef.current.scrollHeight
              }
            }}
            variant="primary"
            size="sm"
            className="sticky bottom-2 left-1/2 -translate-x-1/2 shadow-md"
          >
            滚动到最新
          </Button>
        )}
      </div>
    </div>
  )
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.round((ms % 60000) / 1000)
  return `${minutes}m ${seconds}s`
}

interface UserInputDialogProps {
  request: WSUserInputRequired
  onResponse: (nodeId: string, action: 'continue' | 'cancel') => void
}

function UserInputDialog({ request, onResponse }: UserInputDialogProps) {
  const [isContinuing, setIsContinuing] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  const handleContinue = async () => {
    setIsContinuing(true)
    try {
      await onResponse(request.node_id, 'continue')
    } finally {
      setIsContinuing(false)
    }
  }

  const handleCancel = async () => {
    setIsCancelling(true)
    try {
      await onResponse(request.node_id, 'cancel')
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <div className={`p-4 border-b ${twSemanticColors.border.default} ${twColors.status.warning.bg}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">🙋</span>
        <div className="flex-1">
          <h4 className={`font-medium ${twColors.status.warning.text}`}>需要用户操作</h4>
          <p className={`text-sm mt-1 ${twSemanticColors.text.secondary}`}>{request.prompt}</p>
          <div className="flex gap-2 mt-3">
            <Button
              onClick={handleContinue}
              loading={isContinuing}
              variant="primary"
              size="sm"
            >
              继续执行
            </Button>
            <Button
              onClick={handleCancel}
              loading={isCancelling}
              variant="secondary"
              size="sm"
            >
              取消
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}