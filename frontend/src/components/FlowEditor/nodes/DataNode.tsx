/**
 * 数据操作节点
 */
import { memo } from 'react'
import { BaseNode, type BaseNodeData } from './BaseNode'
import { dataIcons } from '@/constants/nodeStyles'

interface DataNodeProps {
  data: BaseNodeData
  selected?: boolean
  type?: string
}

function DataNodeComponent({ data, selected, type }: DataNodeProps) {
  const icon = dataIcons[type || ''] || '📊'
  return <BaseNode data={data} selected={selected} icon={icon} />
}

export const DataNode = memo(DataNodeComponent)
