/**
 * 基础节点组件 - 所有节点的通用样式和结构
 * v3: 样式升级 - 宽色条、Badge状态、Handle hover效果、动画优化
 */
import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeStatus } from '@/types/workflow'
import { statusStyles, categoryColors, categoryGradients } from '@/constants/nodeStyles'
import { Badge } from '@/components/ui/Badge'

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

  // 将NodeStatus映射到BadgeStatus
  const getBadgeStatus = (s: NodeStatus): 'running' | 'completed' | 'failed' | 'pending' => {
    if (s === 'idle') return 'pending'
    return s
  }

  return (
    <div
      className={`
        relative flex items-stretch rounded-lg
        min-w-[140px] shadow-sm
        hover:-translate-y-0.5 hover:shadow-md
        transition-all duration-200 ease-out
        ${selected ? 'ring-2 ring-blue-500 ring-offset-2 shadow-lg' : ''}
        ${status === 'running' ? 'animate-shimmer' : ''}
        ${status === 'completed' ? 'animate-flash-green' : ''}
        ${statusStyles[status]}
      `}
    >
      {/* 分类色条 - 宽度增加 */}
      <div className={`w-2.5 bg-gradient-to-b ${gradient} shrink-0`} />

      {/* 节点主体 */}
      <div
        className={`
          flex-1 px-3 py-2.5 border-2 border-l-0 rounded-r-lg relative
          ${colors.bg} ${colors.border}
        `}
      >
        {/* 目标连接点（输入） */}
        {showTargetHandle && (
          <Handle
            type="target"
            position={Position.Left}
            className="w-3 h-3 !bg-gray-400 border-2 border-white !left-[-7px] transition-all duration-150 hover:!bg-blue-500 hover:scale-125"
          />
        )}

        {/* 节点内容 */}
        <div className="flex items-center gap-2 pr-16">
          {icon && (
            <span className={`text-base ${status === 'running' ? 'animate-pulse' : ''}`}>
              {icon}
            </span>
          )}
          <span className={`font-medium text-sm truncate ${colors.text}`}>
            {data.label}
          </span>
        </div>

        {/* 状态Badge - 内部右上角 */}
        {(status === 'running' || status === 'completed' || status === 'failed') && (
          <div className="absolute top-1.5 right-1.5">
            <Badge status={getBadgeStatus(status)} size="sm" />
          </div>
        )}

        {/* 源连接点（输出） */}
        {showSourceHandle && (
          <Handle
            type="source"
            position={Position.Right}
            className="w-3 h-3 !bg-gray-400 border-2 border-white !right-[-7px] transition-all duration-150 hover:!bg-blue-500 hover:scale-125"
          />
        )}
      </div>
    </div>
  )
}

export const BaseNode = memo(BaseNodeComponent)
