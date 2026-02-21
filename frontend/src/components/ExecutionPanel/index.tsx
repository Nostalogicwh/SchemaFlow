import { useState, useRef, useEffect, useCallback } from 'react'
import { useExecutionStore } from '@/stores/executionStore'
import { useExecution } from '@/hooks/useExecution'
import type { NodeExecutionRecord, WSLog, WSUserInputRequired } from '@/types/workflow'
import { EmptyState } from '@/components/common'

type TabType = 'screenshot' | 'nodes' | 'logs'
type LogLevelFilter = 'all' | 'info' | 'warning' | 'error'

export function ExecutionPanel() {
  const { executionState, isConnected } = useExecutionStore()
  const { stopExecution, respondUserInput } = useExecution()

  const { isRunning, screenshot, logs, userInputRequest, nodeRecords } = executionState
  const [activeTab, setActiveTab] = useState<TabType>('screenshot')

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      <div className="p-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-sm">
            {isRunning ? '执行中' : isConnected ? '已连接' : '未连接'}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={stopExecution}
            disabled={!isRunning}
            className={`
              px-3 py-1 text-sm rounded
              ${!isRunning
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700'}
            `}
          >
            ■ 停止
          </button>
        </div>
      </div>

      {userInputRequest && (
        <UserInputDialog
          request={userInputRequest}
          onResponse={respondUserInput}
        />
      )}

      <div className="flex border-b border-gray-700 text-sm">
        {([
          ['screenshot', '截图'],
          ['nodes', '节点记录'],
          ['logs', '日志'],
        ] as [TabType, string][]).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 ${
              activeTab === tab
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {label}
            {tab === 'nodes' && nodeRecords.length > 0 && (
              <span className="ml-1 text-xs text-gray-500">({nodeRecords.length})</span>
            )}
          </button>
        ))}
      </div>

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
        <div className="flex items-center gap-2 px-2 py-1 bg-gray-800 border-b border-gray-700 text-xs">
          <button
            onClick={zoomOut}
            disabled={scale <= minScale}
            className="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50"
          >
            -
          </button>
          <span className="w-14 text-center">{Math.round(scale * 100)}%</span>
          <button
            onClick={zoomIn}
            disabled={scale >= maxScale}
            className="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50"
          >
            +
          </button>
          <button
            onClick={resetZoom}
            className="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 rounded"
          >
            重置
          </button>
          <span className="text-gray-500 ml-2">滚轮缩放</span>
        </div>
        <div
          ref={containerRef}
          className="flex-1 overflow-auto p-2 bg-gray-950"
        >
          {screenshot ? (
            <img
              src={`data:image/jpeg;base64,${screenshot}`}
              alt="执行截图"
              onClick={() => setShowModal(true)}
              className="cursor-zoom-in rounded transition-transform origin-top-left"
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
      tabIndex={0}
    >
      <div className="absolute top-4 right-4 flex items-center gap-2 text-white text-sm">
        <button
          onClick={(e) => {
            e.stopPropagation()
            setScale((prev) => Math.max(0.25, prev - 0.25))
          }}
          className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded"
        >
          -
        </button>
        <span className="w-14 text-center">{Math.round(scale * 100)}%</span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            setScale((prev) => Math.min(4, prev + 0.25))
          }}
          className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded"
        >
          +
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            setScale(1)
          }}
          className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded"
        >
          重置
        </button>
        <span className="ml-4 text-gray-400">ESC 关闭</span>
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

function NodeRecordList({ records }: { records: NodeExecutionRecord[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (records.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <EmptyState
          icon="🔧"
          title="暂无执行记录"
          description="执行工作流后将显示节点执行记录"
        />
      </div>
    )
  }

  const totalDuration = records.reduce(
    (sum, r) => sum + (r.duration_ms || 0),
    0
  )
  const maxDuration = Math.max(...records.map((r) => r.duration_ms || 0))

  const statusConfig: Record<string, { color: string; label: string }> = {
    completed: { color: 'bg-green-500', label: '完成' },
    failed: { color: 'bg-red-500', label: '失败' },
    running: { color: 'bg-blue-500 animate-pulse', label: '执行中' },
    pending: { color: 'bg-gray-500', label: '等待' },
    skipped: { color: 'bg-yellow-500', label: '跳过' },
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 bg-gray-800 border-b border-gray-700 text-xs flex items-center justify-between">
        <span className="text-gray-400">共 {records.length} 个节点</span>
        <span className="text-blue-400">
          总耗时: {formatDuration(totalDuration)}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-gray-700">
          {records.map((record, index) => {
            const cfg = statusConfig[record.status] || statusConfig.pending
            const isExpanded = expandedId === record.node_id
            const barWidth =
              maxDuration > 0
                ? ((record.duration_ms || 0) / maxDuration) * 100
                : 0

            return (
              <div key={record.node_id}>
                <button
                  onClick={() =>
                    setExpandedId(isExpanded ? null : record.node_id)
                  }
                  className="w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-800 text-left"
                >
                  <span className="w-5 text-xs text-gray-500">{index + 1}</span>
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${cfg.color}`}
                  />
                  <span className="text-sm flex-1 truncate">
                    {record.node_label}
                  </span>
                  <span className="text-xs text-gray-500 w-16 text-right">
                    {record.duration_ms != null
                      ? formatDuration(record.duration_ms)
                      : '-'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {isExpanded ? '▼' : '▶'}
                  </span>
                </button>
                <div className="px-3 pb-2">
                  <div className="h-1.5 bg-gray-700 rounded overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        record.status === 'completed'
                          ? 'bg-green-500'
                          : record.status === 'failed'
                          ? 'bg-red-500'
                          : 'bg-blue-500'
                      }`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-4 pb-3 text-xs font-mono bg-gray-800/50">
                    <div className="flex gap-4 text-gray-400 mb-2">
                      <span>类型: {record.node_type}</span>
                      <span>状态: {cfg.label}</span>
                      {record.started_at && (
                        <span>
                          开始: {new Date(record.started_at).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                    {record.error && (
                      <div className="text-red-400 py-1">错误: {record.error}</div>
                    )}
                    {record.result && (
                      <div className="text-gray-300 py-1">
                        <span className="text-gray-500">返回值: </span>
                        <pre className="mt-1 p-2 bg-gray-900 rounded overflow-x-auto">
                          {JSON.stringify(record.result, null, 2)}
                        </pre>
                      </div>
                    )}
                    {record.logs.length > 0 && (
                      <div className="mt-1 border-t border-gray-700 pt-1">
                        {record.logs.map((log, i) => (
                          <div
                            key={i}
                            className={`py-0.5 ${
                              log.level === 'error'
                                ? 'text-red-400'
                                : log.level === 'warning'
                                ? 'text-yellow-400'
                                : 'text-gray-400'
                            }`}
                          >
                            {log.message}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
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

  return (
    <div className="h-full flex flex-col">
      <div className="px-2 py-2 bg-gray-800 border-b border-gray-700 flex items-center gap-2">
        <div className="flex bg-gray-700 rounded text-xs">
          {(['all', 'info', 'warning', 'error'] as LogLevelFilter[]).map(
            (level) => (
              <button
                key={level}
                onClick={() => setLevelFilter(level)}
                className={`px-2 py-1 rounded transition-colors ${
                  levelFilter === level
                    ? level === 'error'
                      ? 'bg-red-600 text-white'
                      : level === 'warning'
                      ? 'bg-yellow-600 text-white'
                      : level === 'info'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {level === 'all' ? '全部' : level === 'info' ? '信息' : level === 'warning' ? '警告' : '错误'}
                <span className="ml-1 opacity-60">({levelCounts[level]})</span>
              </button>
            )
          )}
        </div>
        <input
          type="text"
          placeholder="搜索日志..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="px-2 py-1 text-xs text-gray-400 hover:text-white"
          >
            清除
          </button>
        )}
      </div>
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
            <div className="text-gray-500">没有匹配的日志</div>
          )
        ) : (
          filteredLogs.map((log, index) => (
            <div
              key={index}
              className={`py-0.5 ${
                log.level === 'error'
                  ? 'text-red-400 bg-red-900/20'
                  : log.level === 'warning'
                  ? 'text-yellow-400 bg-yellow-900/20'
                  : 'text-gray-300'
              }`}
            >
              <span className="text-gray-500">
                [{new Date(log.timestamp).toLocaleTimeString()}]
              </span>{' '}
              <span
                className={`inline-block w-8 ${
                  log.level === 'error'
                    ? 'text-red-400'
                    : log.level === 'warning'
                    ? 'text-yellow-400'
                    : 'text-blue-400'
                }`}
              >
                [{log.level.toUpperCase().slice(0, 3)}]
              </span>{' '}
              <span className="break-all">{log.message}</span>
            </div>
          ))
        )}
        {!autoScroll && filteredLogs.length > 0 && (
          <button
            onClick={() => {
              setAutoScroll(true)
              if (listRef.current) {
                listRef.current.scrollTop = listRef.current.scrollHeight
              }
            }}
            className="sticky bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
          >
            滚动到最新
          </button>
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
  return (
    <div className="p-4 bg-yellow-900/50 border-b border-yellow-700">
      <div className="flex items-start gap-3">
        <span className="text-2xl">🙋</span>
        <div className="flex-1">
          <h4 className="font-medium text-yellow-200">需要用户操作</h4>
          <p className="text-sm text-yellow-100 mt-1">{request.prompt}</p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => onResponse(request.node_id, 'continue')}
              className="px-4 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
            >
              继续执行
            </button>
            <button
              onClick={() => onResponse(request.node_id, 'cancel')}
              className="px-4 py-1 bg-gray-600 hover:bg-gray-700 rounded text-sm"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
