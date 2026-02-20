/**
 * 控制节点
 */
import { memo } from 'react'
import { BaseNode, type BaseNodeData } from './BaseNode'

// 控制节点图标
const controlIcons: Record<string, string> = {
  wait: '⏱️',
  wait_for_element: '👁️',
  user_input: '🙋',
}

interface ControlNodeProps {
  data: BaseNodeData
  selected?: boolean
  type?: string
}

function ControlNodeComponent({ data, selected, type }: ControlNodeProps) {
  const icon = controlIcons[type || ''] || '⚙️'
  return <BaseNode data={data} selected={selected} icon={icon} />
}

export const ControlNode = memo(ControlNodeComponent)
