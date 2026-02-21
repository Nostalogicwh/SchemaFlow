import { useState, useEffect, useRef } from 'react'
import type { ActionMetadata, NodeCategory } from '@/types/workflow'
import { aiApi } from '@/api'
import { toast } from '@/stores/uiStore'
import { Button } from '@/components/ui/Button'
import { ChevronDown, ChevronRight, Sparkles, Wand2 } from 'lucide-react'

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
  base: 'bg-neutral-50 border-neutral-200 hover:border-neutral-300',
  browser: 'bg-blue-50/50 border-blue-200 hover:border-blue-300',
  data: 'bg-emerald-50/50 border-emerald-200 hover:border-emerald-300',
  control: 'bg-amber-50/50 border-amber-200 hover:border-amber-300',
  ai: 'bg-purple-50/50 border-purple-200 hover:border-purple-300',
}

const categoryHeaderColors: Record<ExtendedNodeCategory, string> = {
  base: 'text-neutral-600',
  browser: 'text-blue-600',
  data: 'text-emerald-600',
  control: 'text-amber-600',
  ai: 'text-purple-600',
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
    <div className="p-3 space-y-4 overflow-y-auto h-full bg-neutral-50/50">
      {/* AI 编排区域 - 卡片化设计 */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="px-3 py-2.5 bg-gradient-to-r from-blue-500/5 to-purple-500/5 border-b border-neutral-100 flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-blue-500" />
          <h3 className="font-semibold text-sm text-neutral-800">AI 编排</h3>
        </div>
        <div className="p-3 space-y-2.5">
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
            className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg resize-none focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
            rows={3}
            disabled={aiLoading}
          />
          <Button
            onClick={handleAIGenerate}
            loading={aiLoading}
            disabled={!aiPrompt.trim() || aiLoading}
            size="sm"
            className="w-full"
            icon={<Sparkles className="w-3.5 h-3.5" />}
          >
            {aiLoading ? '生成中...' : '生成工作流'}
          </Button>
        </div>
      </div>

      {/* 节点工具栏 */}
      <div>
        <h3 className="font-semibold text-sm text-neutral-600 px-1 mb-2 flex items-center gap-1.5">
          <span className="w-1 h-4 bg-blue-500 rounded-full" />
          节点工具栏
        </h3>

        <div className="space-y-1">
          {sortedCategories.map((category) => {
            const isCollapsed = collapsed[category]
            const categoryActions = grouped[category]

            return (
              <div key={category} className="rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 transition-colors"
                >
                  <span className={`flex items-center gap-2 ${categoryHeaderColors[category]}`}>
                    {categoryLabels[category]}
                    <span className="text-xs text-neutral-400 font-normal">({categoryActions.length})</span>
                  </span>
                  {isCollapsed ? (
                    <ChevronRight className="w-4 h-4 text-neutral-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-neutral-400" />
                  )}
                </button>
                {!isCollapsed && (
                  <div className="space-y-1.5 px-2 pb-2">
                    {categoryActions.map((action) => (
                      <div
                        key={action.name}
                        draggable
                        onDragStart={(e) => onDragStart(e, action)}
                        className={`
                          px-3 py-2 rounded-lg border cursor-grab text-sm
                          ${categoryColors[category]}
                          hover:shadow-md hover:translate-x-0.5 transition-all active:scale-95
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
        </div>
      </div>

      <div ref={ghostRef} style={{ position: 'fixed', top: -1000, left: -1000 }} />
    </div>
  )
}
