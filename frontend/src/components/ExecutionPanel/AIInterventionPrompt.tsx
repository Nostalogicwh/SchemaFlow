/**
 * AI干预提示组件 - 当AI检测到需要人工干预时显示
 * 
 * 功能：
 * - 显示检测到的干预类型（登录、验证码、弹窗等）
 * - 显示AI分析原因
 * - 显示当前页面截图
 * - 提供继续/取消按钮
 * 
 * 使用顶部非遮罩弹窗样式
 */
import { X, AlertCircle, CheckCircle, Pause } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useExecutionStore } from '@/stores/executionStore'

interface AIInterventionPromptProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  onCancel: () => void
}

export function AIInterventionPrompt({
  isOpen,
  onClose,
  onConfirm,
  onCancel,
}: AIInterventionPromptProps) {
  const { executionState } = useExecutionStore()
  const userInputRequest = executionState.userInputRequest

  const prompt = userInputRequest?.prompt || ''
  
  const parseInterventionInfo = (promptText: string) => {
    const lines = promptText.split('\n')
    let type = '未知'
    let reason = ''
    
    lines.forEach(line => {
      if (line.includes('检测到需要人工干预的页面元素')) {
        const match = line.match(/：(.+)$/)
        if (match) {
          type = match[1]
        }
      }
      if (line.startsWith('原因：')) {
        reason = line.replace('原因：', '').trim()
      }
    })
    
    return { type, reason }
  }

  const { type: interventionType, reason } = parseInterventionInfo(prompt)

  const getInterventionStyle = (type: string) => {
    const lowerType = type.toLowerCase()
    if (lowerType.includes('登录')) {
      return {
        icon: CheckCircle,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        label: '登录表单',
      }
    }
    if (lowerType.includes('验证码') || lowerType.includes('captcha')) {
      return {
        icon: AlertCircle,
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        label: '验证码',
      }
    }
    if (lowerType.includes('弹窗') || lowerType.includes('隐私') || lowerType.includes('广告')) {
      return {
        icon: AlertCircle,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        label: '弹窗提示',
      }
    }
    if (lowerType.includes('安全')) {
      return {
        icon: AlertCircle,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        label: '安全确认',
      }
    }
    return {
      icon: Pause,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      label: type || '需要干预',
    }
  }

  const style = getInterventionStyle(interventionType)
  const IconComponent = style.icon

  if (!isOpen || !userInputRequest || !prompt.includes('需要人工干预')) {
    return null
  }

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
      <div className={`${style.bgColor} border ${style.borderColor} rounded-lg shadow-lg p-4 max-w-lg`}>
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${style.bgColor}`}>
            <IconComponent className={`w-5 h-5 ${style.color}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className={`font-medium ${style.color}`}>需要人工干预</h4>
              <span className={`px-2 py-0.5 rounded text-xs ${style.bgColor} ${style.color} border ${style.borderColor}`}>
                {style.label}
              </span>
            </div>
            {reason && (
              <p className="text-sm mt-1 text-gray-600">{reason}</p>
            )}
            <div className="flex gap-2 mt-3">
              <Button onClick={onConfirm} variant="primary" size="sm">
                继续执行
              </Button>
              <Button onClick={onCancel} variant="secondary" size="sm">
                取消执行
              </Button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-black/5 rounded transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  )
}
