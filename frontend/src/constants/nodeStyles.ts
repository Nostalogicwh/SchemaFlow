import type { NodeStatus } from '@/types/workflow'
import { twColors, categoryGradients, statusRing } from './designTokens'

export const statusStyles: Record<NodeStatus, string> = {
  idle: statusRing.idle,
  running: 'ring-2 ring-blue-400 ring-offset-1 animate-pulse',
  completed: statusRing.completed,
  failed: statusRing.failed,
}

export type CategoryStyle = { bg: string; border: string; text: string; accent: string }
export const categoryColors: Record<string, CategoryStyle> = twColors.category

export { categoryGradients }

export const browserIcons: Record<string, string> = {
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

export const dataIcons: Record<string, string> = {
  extract_text: '📝',
  copy_to_clipboard: '📋',
  paste_from_clipboard: '📄',
  set_variable: '💾',
}

export const controlIcons: Record<string, string> = {
  wait: '⏱️',
  wait_for_element: '👁️',
  user_input: '🙋',
}

export const aiIcons: Record<string, string> = {
  ai_action: '🤖',
  ai_chat: '💬',
  ai_extract: '🧠',
}
