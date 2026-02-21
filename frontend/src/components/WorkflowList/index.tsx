import { useEffect, useState } from 'react'
import { useWorkflowStore } from '@/stores/workflowStore'
import type { WorkflowListItem } from '@/types/workflow'
import { workflowApi } from '@/api'

interface WorkflowListProps {
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  refreshKey?: number
}

export function WorkflowList({ selectedId, onSelect, onCreate, refreshKey }: WorkflowListProps) {
  const [workflows, setWorkflows] = useState<WorkflowListItem[]>([])
  const [loading, setLoading] = useState(true)
  const refreshList = useWorkflowStore((state) => state.refreshList)

  const loadWorkflows = async () => {
    try {
      setLoading(true)
      const list = await workflowApi.list()
      setWorkflows(list)
    } catch (error) {
      console.error('加载工作流列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWorkflows()
  }, [refreshKey])

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('确定删除此工作流？')) return

    try {
      await workflowApi.delete(id)
      setWorkflows((prev) => prev.filter((w) => w.id !== id))
      refreshList()
    } catch (error) {
      console.error('删除工作流失败:', error)
    }
  }

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">
        加载中...
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b flex justify-between items-center">
        <h2 className="font-bold text-sm">工作流</h2>
        <button
          onClick={onCreate}
          className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
        >
          + 新建
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {workflows.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            暂无工作流，点击新建创建
          </div>
        ) : (
          <div className="divide-y">
            {workflows.map((workflow) => (
              <div
                key={workflow.id}
                onClick={() => onSelect(workflow.id)}
                className={`
                  p-3 cursor-pointer hover:bg-gray-50 transition-colors
                  ${selectedId === workflow.id ? 'bg-blue-50 border-l-2 border-blue-500' : ''}
                `}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">{workflow.name}</h3>
                    {workflow.description && (
                      <p className="text-xs text-gray-500 truncate mt-1">
                        {workflow.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={(e) => handleDelete(workflow.id, e)}
                    className="ml-2 text-gray-400 hover:text-red-500 text-xs"
                    title="删除"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-2 border-t">
        <button
          onClick={loadWorkflows}
          className="w-full py-1 text-xs text-gray-500 hover:text-gray-700"
        >
          刷新列表
        </button>
      </div>
    </div>
  )
}
