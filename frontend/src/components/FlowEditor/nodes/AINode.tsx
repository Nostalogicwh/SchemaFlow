/**
 * AI 操作节点
 */
import { memo } from 'react'
import { BaseNode, type BaseNodeData } from './BaseNode'
import { aiIcons } from '@/constants/nodeStyles'

interface AINodeProps {
  data: BaseNodeData
  selected?: boolean
  type?: string
}

function AINodeComponent({ data, selected, type }: AINodeProps) {
  const icon = aiIcons[type || ''] || '✨'
  return <BaseNode data={data} selected={selected} icon={icon} />
}

export const AINode = memo(AINodeComponent)
