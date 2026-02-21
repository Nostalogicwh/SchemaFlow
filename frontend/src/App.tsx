/**
 * SchemaFlow 主应用
 */
import { useState, useCallback } from 'react'
import { FlowEditor } from '@/components/FlowEditor'
import { WorkflowList } from '@/components/WorkflowList'
import { ExecutionPanel } from '@/components/ExecutionPanel'
import { useWebSocket } from '@/hooks/useWebSocket'
import { workflowApi } from '@/api'
import type { Workflow } from '@/types/workflow'

function App() {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null)
  const [currentWorkflow, setCurrentWorkflow] = useState<Workflow | null>(null)
  const [showExecution, setShowExecution] = useState(false)
  const [executionMode, setExecutionMode] = useState<'headless' | 'headed'>('headless')
  const [listVersion, setListVersion] = useState(0)

  const {
    isConnected,
    executionState,
    connect,
    startExecution,
    stopExecution,
    respondUserInput,
    reset,
  } = useWebSocket()

  // 选择工作流
  const handleSelectWorkflow = useCallback(async (id: string) => {
    try {
      const workflow = await workflowApi.get(id)
      setSelectedWorkflowId(id)
      setCurrentWorkflow(workflow)
      reset()
    } catch (error) {
      console.error('加载工作流失败:', error)
    }
  }, [reset])

  // 创建新工作流
  const handleCreateWorkflow = useCallback(async () => {
    const name = prompt('请输入工作流名称:')
    if (!name) return

    try {
      const workflow = await workflowApi.create({
        name,
        description: '',
        nodes: [
          { id: 'start_1', type: 'start', config: {} },
          { id: 'end_1', type: 'end', config: {} },
        ],
        edges: [{ source: 'start_1', target: 'end_1' }],
      })
      setSelectedWorkflowId(workflow.id)
      setCurrentWorkflow(workflow)
      setListVersion(v => v + 1)
    } catch (error) {
      console.error('创建工作流失败:', error)
    }
  }, [])

  // 保存工作流
  const handleSaveWorkflow = useCallback(async (workflow: Workflow) => {
    try {
      await workflowApi.update(workflow.id, workflow)
      setCurrentWorkflow(workflow)
      alert('保存成功')
    } catch (error) {
      console.error('保存工作流失败:', error)
      alert('保存失败')
    }
  }, [])

  // 执行工作流
  const handleExecute = useCallback(async () => {
    if (!selectedWorkflowId) return

    try {
      const { execution_id } = await workflowApi.execute(selectedWorkflowId)
      connect(execution_id, selectedWorkflowId)
      setShowExecution(true)
      // 连接后自动开始执行
      setTimeout(() => startExecution(selectedWorkflowId, executionMode), 500)
    } catch (error) {
      console.error('执行工作流失败:', error)
    }
  }, [selectedWorkflowId, connect, startExecution, executionMode])

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* 顶部导航 */}
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
                onClick={() => setShowExecution(!showExecution)}
                className={`px-3 py-1 text-sm rounded border ${
                  showExecution
                    ? 'bg-gray-200 border-gray-400'
                    : 'bg-white border-gray-300 hover:bg-gray-50'
                }`}
              >
                {showExecution ? '隐藏监控' : '显示监控'}
              </button>
            </>
          )}
        </div>
      </header>

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧工作流列表 */}
        <aside className="w-56 bg-white border-r shrink-0">
          <WorkflowList
            selectedId={selectedWorkflowId}
            onSelect={handleSelectWorkflow}
            onCreate={handleCreateWorkflow}
            refreshKey={listVersion}
          />
        </aside>

        {/* 中间编辑器 */}
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

        {/* 右侧执行面板 */}
        {showExecution && (
          <aside className="w-96 border-l shrink-0">
            <ExecutionPanel
              executionState={executionState}
              isConnected={isConnected}
              onStart={startExecution}
              onStop={stopExecution}
              onUserInputResponse={respondUserInput}
            />
          </aside>
        )}
      </div>
    </div>
  )
}

export default App
