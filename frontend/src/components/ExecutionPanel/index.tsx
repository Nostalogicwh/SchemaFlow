import { useState, useRef, useEffect } from 'react'
import { useExecutionStore } from '@/stores/executionStore'
import type { WSLog, WSUserInputRequired } from '@/types/workflow'
import { EmptyState } from '@/components/common'
import { Button } from '@/components/ui/Button'
import { NodeRecordList } from './NodeRecordList'
import { AIInterventionPrompt } from './AIInterventionPrompt'
import { twSemanticColors, twColors, twTransitions } from '@/constants/designTokens'
import { FileText } from 'lucide-react'
import ImageViewer from '../ui/ImageViewer'

export function ExecutionPanel() {
  const { executionState, isConnected, sendWS } = useExecutionStore()

  const { isRunning, userInputRequest } = executionState
  const [isStopping, setIsStopping] = useState(false)

  const isAIIntervention = userInputRequest?.prompt?.includes('需要人工干预') || false
  const [showAIIntervention, setShowAIIntervention] = useState(false)

  useEffect(() => {
    setShowAIIntervention(isAIIntervention)
  }, [isAIIntervention])

  const handleStopExecution = async () => {
    setIsStopping(true)
    try {
      sendWS({ type: 'stop_execution' })
      const execId = executionState.executionId
      if (execId) {
        try {
          await fetch(`/api/executions/${execId}/stop`, { method: 'POST' })
        } catch (e) {
          console.error('REST stop 失败:', e)
        }
      }
    } finally {
      setIsStopping(false)
    }
  }

  const respondUserInput = (nodeId: string, action: 'continue' | 'cancel') => {
    console.log(`[respondUserInput] 发送响应: node_id=${nodeId}, action=${action}`)
    sendWS({
      type: 'user_input_response',
      node_id: nodeId,
      action,
    })
    useExecutionStore.getState().setUserInputRequest(null)
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

      {/* AI干预提示弹窗 - 仅 AI 干预时显示 */}
      {userInputRequest && isAIIntervention && (
        <AIInterventionPrompt
          isOpen={showAIIntervention}
          onClose={() => setShowAIIntervention(false)}
          onConfirm={() => {
            setShowAIIntervention(false)
            respondUserInput(userInputRequest.node_id, 'continue')
          }}
          onCancel={() => {
            setShowAIIntervention(false)
            respondUserInput(userInputRequest.node_id, 'cancel')
          }}
        />
      )}

      {/* 普通用户干预弹窗 - 非 AI 干预时显示 */}
      {userInputRequest && !isAIIntervention && (
        <UserInputDialog
          request={userInputRequest}
          onResponse={respondUserInput}
        />
      )}

      {/* 简洁模式布局 */}
      <CompactModeLayout />
    </div>
  )
}

// 简洁模式布局组件
function CompactModeLayout() {
  const { executionState } = useExecutionStore()
  const { screenshot, nodeRecords, logs } = executionState
  const [screenshotHeight, setScreenshotHeight] = useState(200)
  const [logsHeight, setLogsHeight] = useState(150)
  const [viewerOpen, setViewerOpen] = useState(false)
  const startYRef = useRef(0)
  const startHeightRef = useRef(0)
  const dragTypeRef = useRef<'screenshot' | 'logs' | null>(null)

  const handleMouseDown = (type: 'screenshot' | 'logs') => (e: React.MouseEvent) => {
    e.preventDefault()
    dragTypeRef.current = type
    startYRef.current = e.clientY
    startHeightRef.current = type === 'screenshot' ? screenshotHeight : logsHeight
    const onMove = (e: MouseEvent) => {
      if (!dragTypeRef.current) return
      const deltaY = e.clientY - startYRef.current
      if (dragTypeRef.current === 'screenshot') {
        setScreenshotHeight(Math.min(Math.max(startHeightRef.current - deltaY, 120), 500))
      } else {
        setLogsHeight(Math.min(Math.max(startHeightRef.current - deltaY, 100), 400))
      }
    }
    const onUp = () => {
      dragTypeRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        <h3 className="text-sm font-medium mb-2">节点列表</h3>
        <NodeRecordList records={nodeRecords} />
      </div>

      <div className="cursor-ns-resize h-1.5 bg-gray-100 hover:bg-blue-400 transition-colors flex-shrink-0"
        onMouseDown={handleMouseDown('screenshot')}
      />

      <div className="flex-shrink-0 overflow-hidden" style={{ height: screenshotHeight }}>
        <div className="flex items-center justify-between px-2 py-1 border-t border-gray-200 bg-gray-50">
          <h3 className="text-sm font-medium">实时截图</h3>
        </div>
        <div className="overflow-auto" style={{ height: screenshotHeight - 32 }}>
          {screenshot ? (
            <img
              src={`data:image/jpeg;base64,${screenshot}`}
              alt="执行截图"
              className="w-full h-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setViewerOpen(true)}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">
              等待截图...
            </div>
          )}
        </div>
      </div>

      <div className="cursor-ns-resize h-1.5 bg-gray-100 hover:bg-blue-400 transition-colors flex-shrink-0"
        onMouseDown={handleMouseDown('logs')}
      />

      <div className="flex-shrink-0 overflow-hidden" style={{ height: logsHeight }}>
        <div className="flex items-center justify-between px-2 py-1 border-t border-gray-200 bg-gray-50">
          <h3 className="text-sm font-medium">日志</h3>
        </div>
        <div className="overflow-auto" style={{ height: logsHeight - 32 }}>
          <LogViewer logs={logs} compact />
        </div>
      </div>

      <ImageViewer
        src={`data:image/jpeg;base64,${screenshot}`}
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </div>
  )
}

type LogLevelFilter = 'all' | 'info' | 'warning' | 'error'

function LogViewer({ logs, compact = false }: { logs: WSLog[]; compact?: boolean }) {
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
      {/* Filter Toolbar - 简洁模式下隐藏 */}
      {!compact && (
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
      )}
      
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
                icon={FileText}
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
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
      <div className={`bg-amber-50 border border-amber-200 rounded-lg shadow-lg p-4 max-w-md`}>
        <div className="flex items-start gap-3">
          <span className="text-xl">🙋</span>
          <div className="flex-1">
            <h4 className="font-medium text-amber-800">需要用户操作</h4>
            <p className="text-sm mt-1 text-amber-700">{request.prompt}</p>
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
    </div>
  )
}