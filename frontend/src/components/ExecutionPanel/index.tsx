/**
 * 执行监控面板 - 显示执行状态、截图和日志
 */
import type { ExecutionState, WSUserInputRequired } from '@/types/workflow'

interface ExecutionPanelProps {
  executionState: ExecutionState
  isConnected: boolean
  onStart: () => void
  onStop: () => void
  onUserInputResponse: (nodeId: string, action: 'continue' | 'cancel') => void
}

export function ExecutionPanel({
  executionState,
  isConnected,
  onStart,
  onStop,
  onUserInputResponse,
}: ExecutionPanelProps) {
  const { isRunning, screenshot, logs, userInputRequest } = executionState

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* 控制栏 */}
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
            onClick={onStart}
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
            onClick={onStop}
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

      {/* 用户输入请求 */}
      {userInputRequest && (
        <UserInputDialog
          request={userInputRequest}
          onResponse={onUserInputResponse}
        />
      )}

      {/* 截图区域 */}
      <div className="flex-1 p-2 overflow-hidden">
        {screenshot ? (
          <img
            src={`data:image/png;base64,${screenshot}`}
            alt="执行截图"
            className="w-full h-full object-contain rounded"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500">
            <span>执行后显示截图</span>
          </div>
        )}
      </div>

      {/* 日志区域 */}
      <div className="h-48 border-t border-gray-700 overflow-y-auto">
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
      </div>
    </div>
  )
}

// 用户输入对话框
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
