/**
 * 基础节点组件 - 所有节点的通用样式和结构
 * v2: 支持分类色条、状态动画、选中态、hover效果
 */
import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeStatus } from '@/types/workflow'
import { statusStyles, categoryColors, categoryGradients } from '@/constants/nodeStyles'

export interface BaseNodeData {
  label: string
  category: string
  config?: Record<string, unknown>
  status?: NodeStatus
}

interface BaseNodeProps {
  data: BaseNodeData
  selected?: boolean
  showSourceHandle?: boolean
  showTargetHandle?: boolean
  icon?: React.ReactNode
}

function BaseNodeComponent({
  data,
  selected,
  showSourceHandle = true,
  showTargetHandle = true,
  icon,
}: BaseNodeProps) {
  const colors = categoryColors[data.category] || categoryColors.base
  const gradient = categoryGradients[data.category] || categoryGradients.base
  const status = data.status || 'idle'

  const renderStatusIndicator = () => {
    switch (status) {
      case 'completed':
        return (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow-sm">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )
      case 'failed':
        return (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow-sm">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )
      case 'running':
        return (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow-sm animate-spin-slow">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div
      className={`
        relative flex items-stretch rounded-lg overflow-hidden
        min-w-[140px] shadow-sm
        hover:-translate-y-0.5 hover:shadow-md
        transition-all duration-200 ease-out
        ${selected ? 'ring-2 ring-blue-500 ring-offset-2 shadow-lg scale-[1.02]' : ''}
        ${statusStyles[status]}
      `}
    >
      {/* 分类色条 */}
      <div className={`w-1.5 bg-gradient-to-b ${gradient} shrink-0`} />

      {/* 节点主体 */}
      <div
        className={`
          flex-1 px-3 py-2.5 border-2 border-l-0 rounded-r-lg
          ${colors.bg} ${colors.border}
        `}
      >
        {/* 目标连接点（输入） */}
        {showTargetHandle && (
          <Handle
            type="target"
            position={Position.Left}
            className="w-3 h-3 !bg-gray-400 border-2 border-white !left-[-7px]"
          />
        )}

        {/* 节点内容 */}
        <div className="flex items-center gap-2">
          {icon && (
            <span className={`text-base ${status === 'running' ? 'animate-pulse' : ''}`}>
              {icon}
            </span>
          )}
          <span className={`font-medium text-sm truncate ${colors.text}`}>
            {data.label}
          </span>
        </div>

        {/* 源连接点（输出） */}
        {showSourceHandle && (
          <Handle
            type="source"
            position={Position.Right}
            className="w-3 h-3 !bg-gray-400 border-2 border-white !right-[-7px]"
          />
        )}
      </div>

      {/* 状态指示器 */}
      {renderStatusIndicator()}
    </div>
  )
}

export const BaseNode = memo(BaseNodeComponent)
