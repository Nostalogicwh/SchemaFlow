/**
 * 节点工具栏 - 拖拽添加节点 + AI 编排
 */
import { useState } from 'react'
import type { ActionMetadata, NodeCategory } from '@/types/workflow'
import { aiApi } from '@/api'

interface ToolbarProps {
  actions: ActionMetadata[]
  onAIGenerate?: (nodes: { id: string; type: string; label?: string; config: Record<string, unknown> }[], edges: { source: string; target: string }[]) => void
}

// 分类标签
const categoryLabels: Record<NodeCategory, string> = {
  base: '基础',
  browser: '浏览器',
  data: '数据',
  control: '控制',
}

// 分类颜色
const categoryColors: Record<NodeCategory, string> = {
  base: 'bg-gray-100 border-gray-300',
  browser: 'bg-blue-50 border-blue-300',
  data: 'bg-green-50 border-green-300',
  control: 'bg-yellow-50 border-yellow-300',
}

export function Toolbar({ actions, onAIGenerate }: ToolbarProps) {
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  // 按分类分组
  const grouped = actions.reduce(
    (acc, action) => {
      const category = action.category as NodeCategory
      if (!acc[category]) acc[category] = []
      acc[category].push(action)
      return acc
    },
    {} as Record<NodeCategory, ActionMetadata[]>
  )

  // 拖拽开始
  const onDragStart = (event: React.DragEvent, action: ActionMetadata) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(action))
    event.dataTransfer.effectAllowed = 'move'
  }

  // AI 编排
  const handleAIGenerate = async () => {
    if (!aiPrompt.trim() || aiLoading) return
    setAiLoading(true)
    try {
      const { nodes, edges } = await aiApi.generateWorkflow(aiPrompt.trim())
      onAIGenerate?.(nodes, edges)
      setAiPrompt('')
    } catch (error) {
      console.error('AI 编排失败:', error)
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      alert(detail || 'AI 编排失败，请检查后端配置')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="p-2 space-y-3 overflow-y-auto h-full">
      {/* AI 编排区域 */}
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-gray-600 px-2">AI 编排</h3>
        <div className="px-2">
          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleAIGenerate()
              }
            }}
            placeholder="描述你想要的工作流，如：打开百度搜索 SchemaFlow"
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded resize-none focus:outline-none focus:border-blue-400"
            rows={3}
            disabled={aiLoading}
          />
          <button
            onClick={handleAIGenerate}
            disabled={!aiPrompt.trim() || aiLoading}
            className={`w-full mt-1 px-3 py-1.5 text-sm rounded text-white ${
              aiLoading || !aiPrompt.trim()
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {aiLoading ? '生成中...' : '生成工作流'}
          </button>
        </div>
      </div>

      <hr className="border-gray-200" />

      {/* 节点工具栏 */}
      <h3 className="font-bold text-sm text-gray-600 px-2">节点工具栏</h3>

      {Object.entries(grouped).map(([category, categoryActions]) => (
        <div key={category}>
          <h4 className="text-xs font-medium text-gray-500 px-2 mb-1">
            {categoryLabels[category as NodeCategory]}
          </h4>
          <div className="space-y-1">
            {categoryActions.map((action) => (
              <div
                key={action.name}
                draggable
                onDragStart={(e) => onDragStart(e, action)}
                className={`
                  px-3 py-2 rounded border cursor-grab text-sm
                  ${categoryColors[category as NodeCategory]}
                  hover:shadow-md transition-shadow
                `}
                title={action.description}
              >
                {action.label}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
