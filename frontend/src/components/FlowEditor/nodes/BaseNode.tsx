/**
 * 基础节点组件 - 所有节点的通用样式和结构
 */
import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeStatus } from '@/types/workflow'

// 节点分类对应的颜色
const categoryColors: Record<string, { bg: string; border: string; text: string }> = {
  base: { bg: 'bg-gray-100', border: 'border-gray-400', text: 'text-gray-700' },
  browser: { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-700' },
  data: { bg: 'bg-green-50', border: 'border-green-400', text: 'text-green-700' },
  control: { bg: 'bg-yellow-50', border: 'border-yellow-400', text: 'text-yellow-700' },
  ai: { bg: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-700' },
}

// 状态对应的样式
const statusStyles: Record<NodeStatus, string> = {
  idle: '',
  running: 'ring-2 ring-blue-500 ring-offset-2 animate-pulse',
  completed: 'ring-2 ring-green-500 ring-offset-2',
  failed: 'ring-2 ring-red-500 ring-offset-2',
}

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
  const status = data.status || 'idle'

  return (
    <div
      className={`
        px-4 py-2 rounded-lg border-2 min-w-[120px] shadow-sm
        ${colors.bg} ${colors.border}
        ${selected ? 'shadow-lg' : ''}
        ${statusStyles[status]}
        transition-all duration-200
      `}
    >
      {/* 目标连接点（输入） */}
      {showTargetHandle && (
        <Handle
          type="target"
          position={Position.Left}
          className="w-3 h-3 !bg-gray-400 border-2 border-white"
        />
      )}

      {/* 节点内容 */}
      <div className="flex items-center gap-2">
        {icon && <span className="text-lg">{icon}</span>}
        <span className={`font-medium ${colors.text}`}>{data.label}</span>
      </div>

      {/* 源连接点（输出） */}
      {showSourceHandle && (
        <Handle
          type="source"
          position={Position.Right}
          className="w-3 h-3 !bg-gray-400 border-2 border-white"
        />
      )}
    </div>
  )
}

export const BaseNode = memo(BaseNodeComponent)
