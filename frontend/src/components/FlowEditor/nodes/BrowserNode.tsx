/**
 * 浏览器操作节点
 */
import { memo } from 'react'
import { BaseNode, type BaseNodeData } from './BaseNode'
import { browserIcons } from '@/constants/nodeStyles'

interface BrowserNodeProps {
  data: BaseNodeData
  selected?: boolean
  type?: string
}

function BrowserNodeComponent({ data, selected, type }: BrowserNodeProps) {
  const icon = browserIcons[type || ''] || '🌐'
  return <BaseNode data={data} selected={selected} icon={icon} />
}

export const BrowserNode = memo(BrowserNodeComponent)
