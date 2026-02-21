import { useState, useEffect, useRef } from 'react'
import type { ActionMetadata, NodeCategory } from '@/types/workflow'
import { aiApi } from '@/api'
import { toast } from '@/stores/uiStore'

interface ToolbarProps {
  actions: ActionMetadata[]
  onAIGenerate?: (nodes: { id: string; type: string; label?: string; config: Record<string, unknown> }[], edges: { source: string; target: string }[]) => void
}

type ExtendedNodeCategory = NodeCategory | 'ai'

const STORAGE_KEY = 'schemaflow_node_panel_collapsed'

const categoryLabels: Record<ExtendedNodeCategory, string> = {
  base: '基础',
  browser: '浏览器',
  data: '数据',
  control: '控制',
  ai: 'AI',
}

const categoryColors: Record<ExtendedNodeCategory, string> = {
  base: 'bg-gray-100 border-gray-300',
  browser: 'bg-blue-50 border-blue-300',
  data: 'bg-green-50 border-green-300',
  control: 'bg-yellow-50 border-yellow-300',
  ai: 'bg-purple-50 border-purple-300',
}

const categoryOrder: ExtendedNodeCategory[] = ['ai', 'browser', 'data', 'control', 'base']

function loadCollapsedState(): Record<string, boolean> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : {}
  } catch {
    return {}
  }
}

function saveCollapsedState(state: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}

export function Toolbar({ actions, onAIGenerate }: ToolbarProps) {
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(loadCollapsedState)
  const ghostRef = useRef<HTMLDivElement>(null)

  const grouped = actions.reduce(
    (acc, action) => {
      let category = action.category as ExtendedNodeCategory
      if (action.name.startsWith('ai_')) {
        category = 'ai'
      }
      if (!acc[category]) acc[category] = []
      acc[category].push(action)
      return acc
    },
    {} as Record<ExtendedNodeCategory, ActionMetadata[]>
  )

  useEffect(() => {
    saveCollapsedState(collapsed)
  }, [collapsed])

  const toggleCategory = (category: string) => {
    setCollapsed((prev) => ({ ...prev, [category]: !prev[category] }))
  }

  const onDragStart = (event: React.DragEvent, action: ActionMetadata) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(action))
    event.dataTransfer.effectAllowed = 'move'

    if (ghostRef.current) {
      const ghost = ghostRef.current
      ghost.textContent = action.label
      ghost.className = `
        fixed px-3 py-2 rounded border text-sm pointer-events-none opacity-70 z-50
        ${categoryColors[grouped[action.category as ExtendedNodeCategory]?.[0]?.category as ExtendedNodeCategory] || 'bg-gray-100 border-gray-300'}
      `
      document.body.appendChild(ghost)
      event.dataTransfer.setDragImage(ghost, 40, 16)

      const handleDragEnd = () => {
        ghost.remove()
        document.removeEventListener('dragend', handleDragEnd)
      }
      document.addEventListener('dragend', handleDragEnd)
    }
  }

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
      toast.error(detail || 'AI 编排失败，请检查后端配置')
    } finally {
      setAiLoading(false)
    }
  }

  const sortedCategories = categoryOrder.filter((cat) => grouped[cat] && grouped[cat].length > 0)

  return (
    <div className="p-2 space-y-3 overflow-y-auto h-full">
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

      <h3 className="font-bold text-sm text-gray-600 px-2">节点工具栏</h3>

      {sortedCategories.map((category) => {
        const isCollapsed = collapsed[category]
        const categoryActions = grouped[category]

        return (
          <div key={category}>
            <button
              onClick={() => toggleCategory(category)}
              className="w-full flex items-center justify-between px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded"
            >
              <span>{categoryLabels[category]}</span>
              <span className="text-gray-400">{isCollapsed ? '▶' : '▼'}</span>
            </button>
            {!isCollapsed && (
              <div className="space-y-1 mt-1">
                {categoryActions.map((action) => (
                  <div
                    key={action.name}
                    draggable
                    onDragStart={(e) => onDragStart(e, action)}
                    className={`
                      px-3 py-2 rounded border cursor-grab text-sm
                      ${categoryColors[category]}
                      hover:shadow-md transition-shadow active:opacity-70
                    `}
                    title={action.description}
                  >
                    {action.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      <div ref={ghostRef} style={{ position: 'fixed', top: -1000, left: -1000 }} />
    </div>
  )
}
