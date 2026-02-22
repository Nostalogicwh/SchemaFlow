import { Button } from '@/components/ui/Button'
import { useExecutionStore } from '@/stores/executionStore'
import { useExecution } from '@/hooks/useExecution'

interface LoginAssistPanelProps {
  screenshot?: string | null
}

export function LoginAssistPanel({ screenshot }: LoginAssistPanelProps) {
  const { loginRequired, loginReason, loginUrl, executionState } = useExecutionStore()
  const { confirmLogin, stopExecution } = useExecution()

  if (!loginRequired) {
    return null
  }

  const getReasonText = () => {
    switch (loginReason) {
      case 'TOKEN_EXPIRED':
        return '您的登录凭证已过期，需要重新登录'
      case 'NO_CREDENTIALS':
        return '该网站需要登录才能继续'
      default:
        return '需要登录才能继续执行'
    }
  }

  const handleConfirmLogin = () => {
    if (executionState.executionId) {
      confirmLogin(executionState.executionId)
    }
  }

  return (
    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <span>⚠️</span> 需要手动登录
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {getReasonText()}
          </p>
          {loginUrl && (
            <p className="text-xs text-gray-500 mt-1">
              目标: {loginUrl}
            </p>
          )}
        </div>

        <div className="p-4 bg-gray-50">
          <p className="text-sm text-gray-600 mb-3">
            请在下方截图中完成登录操作。系统将自动检测登录完成并继续执行。
          </p>

          {screenshot ? (
            <div className="border border-gray-300 rounded-lg overflow-hidden">
              <img
                src={`data:image/png;base64,${screenshot}`}
                alt="浏览器实时画面"
                className="w-full"
              />
            </div>
          ) : (
            <div className="h-64 bg-gray-200 rounded-lg flex items-center justify-center">
              <span className="text-gray-400">等待截图...</span>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
          <Button variant="secondary" onClick={stopExecution}>
            取消执行
          </Button>
          <Button variant="secondary">
            跳过
          </Button>
          <Button onClick={handleConfirmLogin}>
            已完成登录
          </Button>
        </div>
      </div>
    </div>
  )
}
