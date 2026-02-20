/**
 * 数据操作节点
 */
import { memo } from 'react'
import { BaseNode, type BaseNodeData } from './BaseNode'

// 数据操作图标
const dataIcons: Record<string, string> = {
  extract_text: '📝',
  copy_to_clipboard: '📋',
  paste_from_clipboard: '📄',
  set_variable: '💾',
}

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
