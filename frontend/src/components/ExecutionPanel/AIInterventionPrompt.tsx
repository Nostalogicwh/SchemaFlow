/**
 * AI干预提示组件 - 当AI检测到需要人工干预时显示
 * 
 * 功能：
 * - 显示检测到的干预类型（登录、验证码、弹窗等）
 * - 显示AI分析原因
 * - 显示当前页面截图
 * - 提供继续/取消按钮
 * 
 * 与Task 1用户干预机制复用，使用相同的用户输入响应流程
 */
import { X, AlertCircle, CheckCircle, Pause } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
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

  // 从userInputRequest中提取AI干预相关信息
  // AI干预消息会包含在userInputRequest中，prompt字段包含干预详情
  const prompt = userInputRequest?.prompt || ''
  
  // 解析prompt获取干预类型和原因
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

  // 获取干预类型图标和颜色
  const getInterventionStyle = (type: string) => {
    const lowerType = type.toLowerCase()
    if (lowerType.includes('登录')) {
      return {
        icon: CheckCircle,
        color: 'text-blue-500',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        label: '登录表单',
        description: '页面显示登录表单，需要用户手动输入凭证'
      }
    }
    if (lowerType.includes('验证码') || lowerType.includes('captcha')) {
      return {
        icon: AlertCircle,
        color: 'text-orange-500',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        label: '验证码',
        description: '检测到验证码验证，需要用户手动完成'
      }
    }
    if (lowerType.includes('弹窗') || lowerType.includes('隐私') || lowerType.includes('广告')) {
      return {
        icon: AlertCircle,
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        label: '弹窗提示',
        description: '检测到广告拦截、隐私政策或其他弹窗'
      }
    }
    if (lowerType.includes('安全')) {
      return {
        icon: AlertCircle,
        color: 'text-red-500',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        label: '安全确认',
        description: '需要人工确认的安全弹窗或警告'
      }
    }
    return {
      icon: Pause,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      label: type || '需要干预',
      description: reason || 'AI检测到页面需要人工处理'
    }
  }

  const style = getInterventionStyle(interventionType)
  const IconComponent = style.icon

  // 如果不是AI干预请求，不显示
  if (!isOpen || !prompt.includes('需要人工干预')) {
    return null
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <div className="p-6">
        {/* 标题区域 */}
        <div className="flex items-start gap-4 mb-6">
          <div className={`p-3 rounded-xl ${style.bgColor} ${style.borderColor} border`}>
            <IconComponent className={`w-8 h-8 ${style.color}`} />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              需要人工干预
            </h2>
            <p className="text-gray-600">
              AI检测到页面需要您手动处理
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* 干预详情 */}
        <div className={`mb-6 p-4 rounded-lg ${style.bgColor} ${style.borderColor} border`}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-1 rounded text-xs font-medium ${style.bgColor} ${style.color} border ${style.borderColor}`}>
              {style.label}
            </span>
          </div>
          <p className="text-gray-700 text-sm leading-relaxed">
            {style.description}
          </p>
          {reason && (
            <div className="mt-3 pt-3 border-t border-gray-200/50">
              <p className="text-xs text-gray-500 mb-1">AI分析原因：</p>
              <p className="text-sm text-gray-700">{reason}</p>
            </div>
          )}
        </div>

        {/* 当前页面截图 */}
        {executionState.screenshot && (
          <div className="mb-6">
            <p className="text-sm font-medium text-gray-700 mb-2">当前页面状态：</p>
            <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
              <img
                src={`data:image/jpeg;base64,${executionState.screenshot}`}
                alt="当前页面截图"
                className="w-full max-h-64 object-contain"
              />
              <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-blue-400/30 rounded-lg" />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              请查看上方截图，完成相应操作后继续执行
            </p>
          </div>
        )}

        {/* 操作指引 */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-medium text-gray-900 mb-2">操作指引：</h3>
          <ul className="text-sm text-gray-600 space-y-1.5 list-disc list-inside">
            <li>查看当前页面状态（上方截图）</li>
            <li>在浏览器中完成相应操作（登录、验证、关闭弹窗等）</li>
            <li>完成后点击下方"继续执行"按钮</li>
            <li>如需停止工作流，点击"取消执行"</li>
          </ul>
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={onCancel}
          >
            取消执行
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
          >
            继续执行
          </Button>
        </div>

        {/* 提示信息 */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-400">
            AI自动检测 · 安全优先 · 检测失败时默认需要干预
          </p>
        </div>
      </div>
    </Modal>
  )
}
