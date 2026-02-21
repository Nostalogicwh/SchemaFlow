import { useState } from 'react'
import { useExecutionStore } from '@/stores/executionStore'
import { useExecution } from '@/hooks/useExecution'
import type { NodeExecutionRecord } from '@/types/workflow'

type TabType = 'screenshot' | 'nodes' | 'logs'

export function ExecutionPanel() {
  const { executionState, isConnected } = useExecutionStore()
  const { startExecution, stopExecution, respondUserInput } = useExecution()

  const { isRunning, screenshot, logs, userInputRequest, nodeRecords } = executionState
  const [activeTab, setActiveTab] = useState<TabType>('screenshot')

  const handleStart = () => {
    const { executionMode } = useExecutionStore.getState()
    const workflowId = useExecutionStore.getState().executionState.executionId
    if (workflowId) {
      startExecution(workflowId, executionMode)
    }
  }

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
            onClick={handleStart}
            disabled={isRunning}
            className={`
              px-3 py-1 text-sm rounded
              ${isRunning
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'}
            `}
          >
            ▶ 执行
          </button>
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

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'screenshot' && (
          <div className="h-full p-2">
            {screenshot ? (
              <img
                src={`data:image/jpeg;base64,${screenshot}`}
                alt="执行截图"
                className="w-full h-full object-contain rounded"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500">
                <span>执行后显示截图</span>
              </div>
            )}
          </div>
        )}

        {activeTab === 'nodes' && (
          <NodeRecordList records={nodeRecords} />
        )}

        {activeTab === 'logs' && (
          <div className="p-2 text-xs font-mono">
            {logs.length === 0 ? (
              <div className="text-gray-500">暂无日志</div>
            ) : (
              logs.map((log, index) => (
                <div
                  key={index}
                  className={`py-0.5 ${
                    log.level === 'error'
                      ? 'text-red-400'
                      : log.level === 'warning'
                      ? 'text-yellow-400'
                      : 'text-gray-300'
                  }`}
                >
                  <span className="text-gray-500">
                    [{new Date(log.timestamp).toLocaleTimeString()}]
                  </span>{' '}
                  {log.message}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function NodeRecordList({ records }: { records: NodeExecutionRecord[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (records.length === 0) {
    return <div className="p-4 text-gray-500 text-sm">暂无节点执行记录</div>
  }

  const statusConfig: Record<string, { color: string; label: string }> = {
    completed: { color: 'bg-green-500', label: '完成' },
    failed: { color: 'bg-red-500', label: '失败' },
    running: { color: 'bg-blue-500 animate-pulse', label: '执行中' },
    pending: { color: 'bg-gray-500', label: '等待' },
    skipped: { color: 'bg-yellow-500', label: '跳过' },
  }

  return (
    <div className="divide-y divide-gray-700">
      {records.map((record) => {
        const cfg = statusConfig[record.status] || statusConfig.pending
        const isExpanded = expandedId === record.node_id
        return (
          <div key={record.node_id}>
            <button
              onClick={() => setExpandedId(isExpanded ? null : record.node_id)}
              className="w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-800 text-left"
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.color}`} />
              <span className="text-sm flex-1 truncate">{record.node_label}</span>
              <span className="text-xs text-gray-500">{record.node_type}</span>
              {record.duration_ms != null && (
                <span className="text-xs text-gray-400">{record.duration_ms}ms</span>
              )}
              <span className="text-xs text-gray-500">{isExpanded ? '▼' : '▶'}</span>
            </button>
            {isExpanded && (
              <div className="px-4 pb-3 text-xs font-mono bg-gray-800/50">
                {record.error && (
                  <div className="text-red-400 py-1">错误: {record.error}</div>
                )}
                {record.result && (
                  <div className="text-gray-300 py-1">
                    <span className="text-gray-500">返回值: </span>
                    {JSON.stringify(record.result, null, 2)}
                  </div>
                )}
                {record.logs.length > 0 && (
                  <div className="mt-1 border-t border-gray-700 pt-1">
                    {record.logs.map((log, i) => (
                      <div key={i} className={`py-0.5 ${
                        log.level === 'error' ? 'text-red-400'
                          : log.level === 'warning' ? 'text-yellow-400'
                          : 'text-gray-400'
                      }`}>
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
  )
}

import type { WSUserInputRequired } from '@/types/workflow'

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
