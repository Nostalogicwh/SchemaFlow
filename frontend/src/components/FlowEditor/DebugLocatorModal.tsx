import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { twSemanticColors, twColors } from '@/constants/designTokens'

interface DebugLocatorModalProps {
  isOpen: boolean
  onClose: () => void
  nodeId: string
  nodeType: string
  onSave: (selector: string) => void
  wsConnection: WebSocket | null
}

interface DebugResult {
  success: boolean
  selector?: string
  confidence?: number
  method?: string
  reasoning?: string
  error?: string
}

export function DebugLocatorModal({
  isOpen,
  onClose,
  nodeId,
  nodeType: _nodeType,
  onSave,
  wsConnection,
}: DebugLocatorModalProps) {
  const [targetDescription, setTargetDescription] = useState('')
  const [savedSelector, setSavedSelector] = useState('')
  const [enableAiFallback, setEnableAiFallback] = useState(true)
  const [isDebugging, setIsDebugging] = useState(false)
  const [debugResult, setDebugResult] = useState<DebugResult | null>(null)

  const handleDebug = async () => {
    if (!targetDescription.trim()) {
      return
    }

    setIsDebugging(true)
    setDebugResult(null)

    // 发送调试请求到后端
    if (wsConnection?.readyState === WebSocket.OPEN) {
      wsConnection.send(
        JSON.stringify({
          type: 'debug_ai_locator',
          node_id: nodeId,
          target_description: targetDescription,
          saved_selector: savedSelector || null,
          enable_ai_fallback: enableAiFallback,
        })
      )
    }

    // 等待响应（实际应该通过 WebSocket 监听响应）
    // 这里简化处理，假设后端会发送 debug_locator_result 消息
    setTimeout(() => {
      setIsDebugging(false)
    }, 3000)
  }

  const handleSaveSelector = () => {
    if (debugResult?.success && debugResult.selector) {
      onSave(debugResult.selector)
      onClose()
    }
  }

  // 监听 WebSocket 消息更新调试结果
  // 实际使用时，这个应该在父组件中处理并通过 props 传入
  const _updateDebugResult = (result: DebugResult) => {
    setDebugResult(result)
    setIsDebugging(false)
  }
  void _updateDebugResult

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="调试 AI 定位" size="lg">
      <div className="space-y-4">
        {/* 目标描述输入 */}
        <div>
          <label className={`block text-sm font-medium mb-2 ${twSemanticColors.text.primary}`}>
            目标元素描述
          </label>
          <Input
            value={targetDescription}
            onChange={(e) => setTargetDescription(e.target.value)}
            placeholder="例如：搜索按钮、用户名字段、提交表单"
            className="w-full"
          />
          <p className={`text-xs mt-1 ${twSemanticColors.text.tertiary}`}>
            用自然语言描述要定位的元素
          </p>
        </div>

        {/* 已保存的选择器 */}
        <div>
          <label className={`block text-sm font-medium mb-2 ${twSemanticColors.text.primary}`}>
            已保存的 CSS 选择器（可选）
          </label>
          <Input
            value={savedSelector}
            onChange={(e) => setSavedSelector(e.target.value)}
            placeholder="例如：#search-button、.submit-btn"
            className="w-full"
          />
          <p className={`text-xs mt-1 ${twSemanticColors.text.tertiary}`}>
            如果提供，系统会优先尝试使用此选择器
          </p>
        </div>

        {/* AI 后备选项 */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="enable-ai-fallback"
            checked={enableAiFallback}
            onChange={(e) => setEnableAiFallback(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300"
          />
          <label htmlFor="enable-ai-fallback" className={`text-sm ${twSemanticColors.text.primary}`}>
            当 CSS 选择器失效时启用 AI 定位
          </label>
        </div>

        {/* 调试按钮 */}
        <div className="flex gap-2">
          <Button
            onClick={handleDebug}
            loading={isDebugging}
            disabled={!targetDescription.trim() || isDebugging}
            variant="primary"
          >
            {isDebugging ? '调试中...' : '开始调试'}
          </Button>
        </div>

        {/* 调试结果 */}
        {debugResult && (
          <div
            className={`p-4 rounded-lg border ${
              debugResult.success
                ? `border-green-200 ${twColors.status.success.bg}`
                : `border-red-200 ${twColors.status.error.bg}`
            }`}
          >
            <h4
              className={`font-medium mb-2 ${
                debugResult.success ? twColors.status.success.text : twColors.status.error.text
              }`}
            >
              {debugResult.success ? '调试成功' : '调试失败'}
            </h4>

            {debugResult.success ? (
              <div className="space-y-2 text-sm">
                <div>
                  <span className={twSemanticColors.text.secondary}>选择器: </span>
                  <code className="bg-white px-2 py-1 rounded">{debugResult.selector}</code>
                </div>
                <div>
                  <span className={twSemanticColors.text.secondary}>定位方法: </span>
                  <span>{debugResult.method}</span>
                </div>
                <div>
                  <span className={twSemanticColors.text.secondary}>置信度: </span>
                  <span>{(debugResult.confidence! * 100).toFixed(1)}%</span>
                </div>
                <div>
                  <span className={twSemanticColors.text.secondary}>原因: </span>
                  <span>{debugResult.reasoning}</span>
                </div>
              </div>
            ) : (
              <p className={twColors.status.error.text}>{debugResult.error}</p>
            )}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button onClick={onClose} variant="secondary">
            取消
          </Button>
          {debugResult?.success && (
            <Button onClick={handleSaveSelector} variant="primary">
              保存选择器
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}