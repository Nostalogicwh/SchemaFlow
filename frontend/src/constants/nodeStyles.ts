import type { NodeStatus } from '@/types/workflow'

export const statusStyles: Record<NodeStatus, string> = {
  idle: '',
  running: 'ring-2 ring-blue-500 ring-offset-2 animate-pulse',
  completed: 'ring-2 ring-green-500 ring-offset-2',
  failed: 'ring-2 ring-red-500 ring-offset-2',
}

export const categoryColors: Record<string, { bg: string; border: string; text: string }> = {
  base: { bg: 'bg-gray-100', border: 'border-gray-400', text: 'text-gray-700' },
  browser: { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-700' },
  data: { bg: 'bg-green-50', border: 'border-green-400', text: 'text-green-700' },
  control: { bg: 'bg-yellow-50', border: 'border-yellow-400', text: 'text-yellow-700' },
  ai: { bg: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-700' },
}

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
