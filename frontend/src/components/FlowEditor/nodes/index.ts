/**
 * 节点组件导出
 */
export { BaseNode } from './BaseNode'
export { StartNode } from './StartNode'
export { EndNode } from './EndNode'
export { BrowserNode } from './BrowserNode'
export { DataNode } from './DataNode'
export { ControlNode } from './ControlNode'
export { AINode } from './AINode'

import type { NodeTypes } from '@xyflow/react'
import { StartNode } from './StartNode'
import { EndNode } from './EndNode'
import { BrowserNode } from './BrowserNode'
import { DataNode } from './DataNode'
import { ControlNode } from './ControlNode'
import { AINode } from './AINode'

// 节点类型映射
export const nodeTypes: NodeTypes = {
  // 基础节点
  start: StartNode,
  end: EndNode,
  // 浏览器操作节点
  open_tab: BrowserNode,
  navigate: BrowserNode,
  click: BrowserNode,
  input_text: BrowserNode,
  screenshot: BrowserNode,
  switch_tab: BrowserNode,
  close_tab: BrowserNode,
  select_option: BrowserNode,
  scroll: BrowserNode,
  // 数据操作节点
  extract_text: DataNode,
  copy_to_clipboard: DataNode,
  paste_from_clipboard: DataNode,
  set_variable: DataNode,
  custom_script: DataNode,
  // 控制节点
  wait: ControlNode,
  wait_for_element: ControlNode,
  user_input: ControlNode,
  // AI 节点
  ai_action: AINode,
  ai_chat: AINode,
  ai_extract: AINode,
}

// 节点分类映射
export const nodeCategoryMap: Record<string, string> = {
  start: 'base',
  end: 'base',
  open_tab: 'browser',
  navigate: 'browser',
  click: 'browser',
  input_text: 'browser',
  screenshot: 'browser',
  switch_tab: 'browser',
  close_tab: 'browser',
  select_option: 'browser',
  scroll: 'browser',
  extract_text: 'data',
  copy_to_clipboard: 'data',
  paste_from_clipboard: 'data',
  set_variable: 'data',
  custom_script: 'data',
  wait: 'control',
  wait_for_element: 'control',
  user_input: 'control',
  // AI 节点
  ai_action: 'ai',
  ai_chat: 'ai',
  ai_extract: 'ai',
}
