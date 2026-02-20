/**
 * AI 节点
 */
import { memo } from 'react'
import { BaseNode, type BaseNodeData } from './BaseNode'

interface AINodeProps {
  data: BaseNodeData
  selected?: boolean
}

function AINodeComponent({ data, selected }: AINodeProps) {
  return <BaseNode data={data} selected={selected} icon="🤖" />
}

export const AINode = memo(AINodeComponent)
