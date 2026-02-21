import { useCallback } from 'react'
import { FlowEditor } from '@/components/FlowEditor'
import { WorkflowList } from '@/components/WorkflowList'
import { ExecutionPanel } from '@/components/ExecutionPanel'
import { useWorkflowStore } from '@/stores/workflowStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useExecution } from '@/hooks/useExecution'
import { workflowApi } from '@/api'

function App() {
  const { currentWorkflow, selectedId, saveWorkflow } = useWorkflowStore()

  const { showPanel, executionMode, executionState, setExecutionMode, setShowPanel } =
    useExecutionStore()

  const { connect, startExecution, reset: resetExecution } = useExecution()

  const handleExecute = useCallback(async () => {
    if (!selectedId) return

    try {
      const { execution_id } = await workflowApi.execute(selectedId)
      connect(execution_id, selectedId)
      setShowPanel(true)
      setTimeout(() => startExecution(selectedId, executionMode), 500)
    } catch (error) {
      console.error('执行工作流失败:', error)
    }
  }, [selectedId, connect, startExecution, executionMode, setShowPanel])

  const handleSelectWorkflow = useCallback(
    async (id: string) => {
      try {
        await useWorkflowStore.getState().selectWorkflow(id)
        resetExecution()
      } catch (error) {
        console.error('加载工作流失败:', error)
      }
    },
    [resetExecution]
  )

  const handleCreateWorkflow = useCallback(async () => {
    const name = prompt('请输入工作流名称:')
    if (!name) return

    try {
      await useWorkflowStore.getState().createWorkflow(name)
    } catch (error) {
      console.error('创建工作流失败:', error)
    }
  }, [])

  const handleSaveWorkflow = useCallback(
    async (workflow: typeof currentWorkflow) => {
      if (!workflow) return
      try {
        await saveWorkflow(workflow)
        alert('保存成功')
      } catch (error) {
        console.error('保存工作流失败:', error)
        alert('保存失败')
      }
    },
    [saveWorkflow]
  )

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <header className="h-12 bg-white border-b flex items-center justify-between px-4 shrink-0">
        <h1 className="font-bold text-lg">SchemaFlow</h1>
        <div className="flex items-center gap-4">
          {currentWorkflow && (
            <>
              <span className="text-sm text-gray-600">{currentWorkflow.name}</span>
              <select
                value={executionMode}
                onChange={(e) => setExecutionMode(e.target.value as 'headless' | 'headed')}
                className="px-2 py-1 text-sm border border-gray-300 rounded bg-white"
              >
                <option value="headless">后台执行</option>
                <option value="headed">前台执行</option>
              </select>
              <button
                onClick={handleExecute}
                className="px-4 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
              >
                ▶ 执行
              </button>
              <button
                onClick={() => setShowPanel(!showPanel)}
                className={`px-3 py-1 text-sm rounded border ${
                  showPanel
                    ? 'bg-gray-200 border-gray-400'
                    : 'bg-white border-gray-300 hover:bg-gray-50'
                }`}
              >
                {showPanel ? '隐藏监控' : '显示监控'}
              </button>
            </>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-56 bg-white border-r shrink-0">
          <WorkflowList
            selectedId={selectedId}
            onSelect={handleSelectWorkflow}
            onCreate={handleCreateWorkflow}
            refreshKey={useWorkflowStore.getState().listVersion}
          />
        </aside>

        <main className="flex-1 overflow-hidden">
          {currentWorkflow ? (
            <FlowEditor
              workflow={currentWorkflow}
              nodeStatuses={executionState.nodeStatuses}
              onSave={handleSaveWorkflow}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <p className="text-lg mb-2">选择或创建一个工作流开始</p>
                <button
                  onClick={handleCreateWorkflow}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  创建工作流
                </button>
              </div>
            </div>
          )}
        </main>

        {showPanel && (
          <aside className="w-96 border-l shrink-0">
            <ExecutionPanel />
          </aside>
        )}
      </div>
    </div>
  )
}

export default App
