import { useEffect, useState, useMemo } from 'react'
import { useWorkflowStore } from '@/stores/workflowStore'
import { confirm as confirmDialog, toast } from '@/stores/uiStore'
import type { WorkflowListItem } from '@/types/workflow'
import { workflowApi } from '@/api'
import { LoadingSpinner, EmptyState } from '@/components/common'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { FormField } from '@/components/ui/FormField'
import { Button } from '@/components/ui/Button'
import { Search, Plus, RefreshCw, Trash2 } from 'lucide-react'

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
      <div className="p-3 border-b border-neutral-200 flex justify-between items-center bg-white">
        <h2 className="font-semibold text-sm text-neutral-900">工作流</h2>
        <Button
          onClick={handleOpenCreateModal}
          size="sm"
          icon={<Plus className="w-3.5 h-3.5" />}
        >
          新建
        </Button>
      </div>

      <div className="px-3 py-2 border-b border-neutral-200 bg-neutral-50">
        <Input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索工作流..."
          prefixIcon={Search}
          clearable
          size="sm"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredWorkflows.length === 0 ? (
          <div className="h-full flex items-center justify-center px-4">
            <EmptyState
              icon={searchQuery ? '🔍' : '📋'}
              title={searchQuery ? '未找到匹配的工作流' : '暂无工作流'}
              description={searchQuery ? '尝试其他关键词' : '创建您的第一个工作流开始使用'}
              action={!searchQuery ? { label: '新建工作流', onClick: handleOpenCreateModal } : undefined}
            />
          </div>
        ) : (
          <div className="py-1">
            {filteredWorkflows.map((workflow) => (
              <div
                key={workflow.id}
                onClick={() => onSelect(workflow.id)}
                className={`
                  group relative px-3 py-2.5 mx-2 rounded-lg cursor-pointer transition-all duration-200
                  ${selectedId === workflow.id 
                    ? 'bg-blue-50 shadow-sm' 
                    : 'hover:bg-neutral-100'
                  }
                `}
              >
                {/* 左侧高亮色条 */}
                <div className={`
                  absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full transition-all duration-200
                  ${selectedId === workflow.id ? 'bg-blue-500 opacity-100' : 'bg-blue-400 opacity-0 group-hover:opacity-50'}
                `} />
                
                <div className="flex justify-between items-start pl-2">
                  <div className="flex-1 min-w-0">
                    <h3 className={`
                      font-medium text-sm truncate transition-colors
                      ${selectedId === workflow.id ? 'text-blue-900' : 'text-neutral-900'}
                    `}>
                      {workflow.name}
                    </h3>
                    {workflow.description && (
                      <p className="text-xs text-neutral-500 truncate mt-0.5">
                        {workflow.description}
                      </p>
                    )}
                    {workflow.updated_at && (
                      <p className="text-xs text-neutral-400 mt-1.5 flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-neutral-300" />
                        {formatRelativeTime(workflow.updated_at)}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    onClick={(e) => handleDelete(workflow.id, e as React.MouseEvent)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity -mr-1"
                    title="删除"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-neutral-400 hover:text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-2 border-t border-neutral-200 bg-white">
        <Button
          variant="ghost"
          size="sm"
          icon={<RefreshCw className="w-3.5 h-3.5" />}
          onClick={loadWorkflows}
          className="w-full"
        >
          刷新列表
        </Button>
      </div>

      {/* 创建工作流弹窗 */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        title="创建工作流"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={handleCloseCreateModal}
              disabled={isCreating}
            >
              取消
            </Button>
            <Button
              onClick={handleCreateWorkflow}
              loading={isCreating}
              disabled={isCreating}
            >
              {isCreating ? '创建中...' : '创建'}
            </Button>
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
