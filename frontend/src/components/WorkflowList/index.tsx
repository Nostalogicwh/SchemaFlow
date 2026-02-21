import { useEffect, useState, useMemo } from 'react'
import { useWorkflowStore } from '@/stores/workflowStore'
import { confirm as confirmDialog, toast } from '@/stores/uiStore'
import type { WorkflowListItem } from '@/types/workflow'
import { workflowApi } from '@/api'
import { LoadingSpinner, EmptyState } from '@/components/common'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { FormField } from '@/components/ui/FormField'

interface WorkflowListProps {
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate?: () => void
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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newWorkflowName, setNewWorkflowName] = useState('')
  const [newWorkflowDescription, setNewWorkflowDescription] = useState('')
  const [nameError, setNameError] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const refreshList = useWorkflowStore((state) => state.refreshList)

  const handleOpenCreateModal = () => {
    setNewWorkflowName('')
    setNewWorkflowDescription('')
    setNameError('')
    setIsCreateModalOpen(true)
    onCreate?.()
  }

  const handleCloseCreateModal = () => {
    if (isCreating) return
    setIsCreateModalOpen(false)
    setNewWorkflowName('')
    setNewWorkflowDescription('')
    setNameError('')
  }

  const validateForm = (): boolean => {
    if (!newWorkflowName.trim()) {
      setNameError('工作流名称不能为空')
      return false
    }
    if (newWorkflowName.trim().length > 50) {
      setNameError('工作流名称不能超过50个字符')
      return false
    }
    setNameError('')
    return true
  }

  const handleCreateWorkflow = async () => {
    if (!validateForm()) return

    setIsCreating(true)
    try {
      const newWorkflow = await workflowApi.create({
        name: newWorkflowName.trim(),
        description: newWorkflowDescription.trim() || undefined,
        nodes: [],
        edges: [],
      })
      
      setWorkflows((prev) => [newWorkflow, ...prev])
      refreshList()
      handleCloseCreateModal()
      toast.success('工作流创建成功')
      
      // 自动选中新创建的工作流
      onSelect(newWorkflow.id)
    } catch (error) {
      console.error('创建工作流失败:', error)
      toast.error('创建工作流失败，请重试')
    } finally {
      setIsCreating(false)
    }
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewWorkflowName(e.target.value)
    if (nameError) setNameError('')
  }

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewWorkflowDescription(e.target.value)
  }

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
          onClick={handleOpenCreateModal}
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
            action={!searchQuery ? { label: '新建工作流', onClick: handleOpenCreateModal } : undefined}
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

      {/* 创建工作流弹窗 */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        title="创建工作流"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <button
              onClick={handleCloseCreateModal}
              disabled={isCreating}
              className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100 rounded-md transition-colors disabled:opacity-50"
            >
              取消
            </button>
            <button
              onClick={handleCreateWorkflow}
              disabled={isCreating}
              className="px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isCreating && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              )}
              {isCreating ? '创建中...' : '创建'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <FormField
            label="工作流名称"
            required
            error={nameError}
            helpText="最多50个字符"
          >
            <Input
              type="text"
              value={newWorkflowName}
              onChange={handleNameChange}
              placeholder="请输入工作流名称"
              disabled={isCreating}
              maxLength={50}
              clearable
            />
          </FormField>

          <FormField
            label="描述"
            helpText="可选，简要描述工作流用途"
          >
            <Input
              type="text"
              value={newWorkflowDescription}
              onChange={handleDescriptionChange}
              placeholder="请输入描述（可选）"
              disabled={isCreating}
              maxLength={200}
              clearable
            />
          </FormField>
        </div>
      </Modal>
    </div>
  )
}
