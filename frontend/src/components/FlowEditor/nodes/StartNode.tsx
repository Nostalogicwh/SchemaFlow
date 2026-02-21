/**
 * 开始节点
 */
import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { NodeStatus } from '@/types/workflow'
import { statusStyles } from '@/constants/nodeStyles'

interface StartNodeData {
  label?: string
  status?: NodeStatus
}

function StartNodeComponent({ data, selected }: NodeProps & { data: StartNodeData }) {
  const status = data.status || 'idle'

  return (
    <div
      className={`
        w-16 h-16 rounded-full bg-green-500 border-4 border-green-600
        flex items-center justify-center text-white font-bold
        ${selected ? 'shadow-lg' : 'shadow'}
        ${statusStyles[status]}
        transition-all duration-200
      `}
    >
      <span className="text-sm">开始</span>
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-green-700 border-2 border-white"
      />
    </div>
  )
}

export const StartNode = memo(StartNodeComponent)
