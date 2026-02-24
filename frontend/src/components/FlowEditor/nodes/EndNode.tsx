/**
 * 结束节点
 * v2: 样式升级 - Handle hover、动画优化
 */
import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { NodeStatus } from '@/types/workflow'
import { statusStyles } from '@/constants/nodeStyles'

interface EndNodeData {
  label?: string
  status?: NodeStatus
}

function EndNodeComponent({ data, selected }: NodeProps & { data: EndNodeData }) {
  const status = data.status || 'idle'

  return (
    <div
      className={`
        w-16 h-16 rounded-full bg-red-500 border-4 border-red-600
        flex items-center justify-center text-white font-bold relative
        ${selected ? 'ring-2 ring-blue-500 ring-offset-2 shadow-lg' : 'shadow'}
        ${status === 'running' ? 'animate-shimmer' : ''}
        ${status === 'completed' ? 'animate-flash-green' : ''}
        ${statusStyles[status]}
        transition-all duration-200
      `}
    >
      <span className="text-sm">结束</span>
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-red-700 border-2 border-white transition-all duration-150 hover:!bg-blue-500 hover:scale-125"
      />
    </div>
  )
}

export const EndNode = memo(EndNodeComponent)
