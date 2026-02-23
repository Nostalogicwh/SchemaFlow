import { useCallback, useState } from 'react'
import { FlowEditor } from '@/components/FlowEditor'
import { WorkflowList } from '@/components/WorkflowList'
import { ExecutionPanel } from '@/components/ExecutionPanel'
import { Header } from '@/components/Header'
import { Toast, ErrorBoundary, ConfirmDialog, EmptyState } from '@/components/common'
import { Rocket } from 'lucide-react'
import { useWorkflowStore } from '@/stores/workflowStore'
import { useExecutionStore } from '@/stores/executionStore'
import { toast } from '@/stores/uiStore'
import { useExecution } from '@/hooks/useExecution'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import { workflowApi } from '@/api'

function App() {
  const { currentWorkflow, selectedId, saveWorkflow } = useWorkflowStore()

  const { showPanel, executionMode, executionState, setShowPanel } =
    useExecutionStore()

  const { connect, startExecution, stopExecution, reset: resetExecution } = useExecution()
  const handleError = useErrorHandler()

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const handleExecute = useCallback(async () => {
    if (!selectedId) return

    try {
      const { execution_id } = await workflowApi.execute(selectedId)
      connect(execution_id, selectedId)
      setShowPanel(true)
      setTimeout(() => startExecution(selectedId, executionMode), 500)
    } catch (error) {
      handleError(error, '执行工作流失败')
    }
  }, [selectedId, connect, startExecution, executionMode, setShowPanel, handleError])

  const handleSelectWorkflow = useCallback(
    async (id: string) => {
      try {
        await useWorkflowStore.getState().selectWorkflow(id)
        resetExecution()
      } catch (error) {
        handleError(error, '加载工作流失败')
      }
    },
    [resetExecution, handleError]
  )

  const handleCreateWorkflow = useCallback(async () => {
    const name = prompt('请输入工作流名称:')
    if (!name) return

    try {
      await useWorkflowStore.getState().createWorkflow(name)
    } catch (error) {
      handleError(error, '创建工作流失败')
    }
  }, [handleError])

  const handleSaveWorkflow = useCallback(
    async (workflow: typeof currentWorkflow) => {
      if (!workflow) return
      try {
        await saveWorkflow(workflow)
        toast.success('保存成功')
      } catch (error) {
        handleError(error, '保存工作流失败')
      }
    },
    [saveWorkflow, handleError]
  )

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <Toast />
      <ConfirmDialog />
      <Header
        onExecute={handleExecute}
        onStop={stopExecution}
        onTogglePanel={() => setShowPanel(!showPanel)}
        showPanel={showPanel}
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        sidebarCollapsed={sidebarCollapsed}
      />

      <div className="flex-1 flex overflow-hidden relative">
        <aside
          className={`bg-white border-r border-gray-200 shrink-0 transition-all duration-300 ease-in-out ${
            sidebarCollapsed ? 'w-14' : 'w-56'
          }`}
        >
          {!sidebarCollapsed && (
            <WorkflowList
              selectedId={selectedId}
              onSelect={handleSelectWorkflow}
              onCreate={handleCreateWorkflow}
            />
          )}
          {sidebarCollapsed && (
            <div className="h-full flex items-center justify-center border-r">
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-2 hover:bg-gray-100 rounded"
                title="展开"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          )}
        </aside>

        <main className="flex-1 overflow-hidden min-w-0">
          {currentWorkflow ? (
            <ErrorBoundary>
              <FlowEditor
                workflow={currentWorkflow}
                nodeStatuses={executionState.nodeStatuses}
                onSave={handleSaveWorkflow}
              />
            </ErrorBoundary>
          ) : (
            <EmptyState
              icon={Rocket}
              title="开始使用 SchemaFlow"
              description="选择一个现有工作流或创建新的工作流"
              action={{ label: '创建工作流', onClick: handleCreateWorkflow }}
            />
          )}
        </main>

        {showPanel && (
          <aside className="w-96 border-l border-gray-200 shrink-0 bg-white shadow-sm">
            <ExecutionPanel />
          </aside>
        )}
      </div>
    </div>
  )
}

export default App
