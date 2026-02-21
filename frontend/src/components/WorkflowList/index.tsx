import { useEffect, useState, useMemo } from 'react'
import { useWorkflowStore } from '@/stores/workflowStore'
import { confirm as confirmDialog } from '@/stores/uiStore'
import type { WorkflowListItem } from '@/types/workflow'
import { workflowApi } from '@/api'
import { LoadingSpinner, EmptyState } from '@/components/common'

interface WorkflowListProps {
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  refreshKey?: number
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins} 分钟前`
  if (diffHours < 24) return `${diffHours} 小时前`
  if (diffDays < 7) return `${diffDays} 天前`
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

export function WorkflowList({ selectedId, onSelect, onCreate, refreshKey }: WorkflowListProps) {
  const [workflows, setWorkflows] = useState<WorkflowListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
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
    const confirmed = await confirmDialog('删除确认', '确定删除此工作流？')
    if (!confirmed) return

    try {
      await workflowApi.delete(id)
      setWorkflows((prev) => prev.filter((w) => w.id !== id))
      refreshList()
    } catch (error) {
      console.error('删除工作流失败:', error)
    }
  }

  const filteredWorkflows = useMemo(() => {
    if (!searchQuery.trim()) return workflows
    const query = searchQuery.toLowerCase()
    return workflows.filter(
      (w) =>
        w.name.toLowerCase().includes(query) ||
        w.description?.toLowerCase().includes(query)
    )
  }, [workflows, searchQuery])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner label="加载中..." />
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

      <div className="px-3 py-2 border-b">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索工作流..."
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-400 pr-7"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredWorkflows.length === 0 ? (
          <EmptyState
            icon={searchQuery ? '🔍' : '📋'}
            title={searchQuery ? '未找到匹配的工作流' : '暂无工作流'}
            description={searchQuery ? '尝试其他关键词' : '创建您的第一个工作流开始使用'}
            action={!searchQuery ? { label: '新建工作流', onClick: onCreate } : undefined}
          />
        ) : (
          <div className="divide-y">
            {filteredWorkflows.map((workflow) => (
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
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {workflow.description}
                      </p>
                    )}
                    {workflow.updated_at && (
                      <p className="text-xs text-gray-400 mt-1">
                        {formatRelativeTime(workflow.updated_at)}
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
