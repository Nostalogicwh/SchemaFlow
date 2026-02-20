/**
 * 节点工具栏 - 拖拽添加节点
 */
import type { ActionMetadata, NodeCategory } from '@/types/workflow'

interface ToolbarProps {
  actions: ActionMetadata[]
}

// 分类标签
const categoryLabels: Record<NodeCategory, string> = {
  base: '基础',
  browser: '浏览器',
  data: '数据',
  control: '控制',
  ai: 'AI',
}

// 分类颜色
const categoryColors: Record<NodeCategory, string> = {
  base: 'bg-gray-100 border-gray-300',
  browser: 'bg-blue-50 border-blue-300',
  data: 'bg-green-50 border-green-300',
  control: 'bg-yellow-50 border-yellow-300',
  ai: 'bg-purple-50 border-purple-300',
}

export function Toolbar({ actions }: ToolbarProps) {
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

  return (
    <div className="p-2 space-y-3 overflow-y-auto h-full">
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
