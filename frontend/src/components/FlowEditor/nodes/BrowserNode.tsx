/**
 * 浏览器操作节点
 */
import { memo } from 'react'
import { BaseNode, type BaseNodeData } from './BaseNode'

// 浏览器操作图标
const browserIcons: Record<string, string> = {
  open_tab: '🌐',
  navigate: '🔗',
  click: '👆',
  input_text: '⌨️',
  screenshot: '📷',
  switch_tab: '🔄',
  close_tab: '❌',
  select_option: '📋',
  scroll: '📜',
}

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
