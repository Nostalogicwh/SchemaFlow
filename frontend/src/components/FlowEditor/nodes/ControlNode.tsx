/**
 * 控制节点
 */
import { memo } from 'react'
import { BaseNode, type BaseNodeData } from './BaseNode'
import { controlIcons } from '@/constants/nodeStyles'

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
