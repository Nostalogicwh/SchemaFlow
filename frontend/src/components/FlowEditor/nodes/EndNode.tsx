/**
 * 结束节点
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
        flex items-center justify-center text-white font-bold
        ${selected ? 'shadow-lg' : 'shadow'}
        ${statusStyles[status]}
        transition-all duration-200
      `}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-red-700 border-2 border-white"
      />
      <span className="text-sm">结束</span>
    </div>
  )
}

export const EndNode = memo(EndNodeComponent)
