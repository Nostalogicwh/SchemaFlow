import { create } from 'zustand'
import { workflowApi } from '@/api'
import type { Workflow } from '@/types/workflow'

interface WorkflowState {
  selectedId: string | null
  currentWorkflow: Workflow | null
  listVersion: number
  selectWorkflow: (id: string) => Promise<void>
  createWorkflow: (name: string) => Promise<void>
  saveWorkflow: (workflow: Workflow) => Promise<void>
  refreshList: () => void
  reset: () => void
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  selectedId: null,
  currentWorkflow: null,
  listVersion: 0,

  selectWorkflow: async (id: string) => {
    try {
      const workflow = await workflowApi.get(id)
      set({ selectedId: id, currentWorkflow: workflow })
    } catch (error) {
      console.error('加载工作流失败:', error)
      throw error
    }
  },

  createWorkflow: async (name: string) => {
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
      set({
        selectedId: workflow.id,
        currentWorkflow: workflow,
        listVersion: get().listVersion + 1,
      })
    } catch (error) {
      console.error('创建工作流失败:', error)
      throw error
    }
  },

  saveWorkflow: async (workflow: Workflow) => {
    try {
      await workflowApi.update(workflow.id, workflow)
      set({ currentWorkflow: workflow })
    } catch (error) {
      console.error('保存工作流失败:', error)
      throw error
    }
  },

  refreshList: () => {
    set((state) => ({ listVersion: state.listVersion + 1 }))
  },

  reset: () => {
    set({
      selectedId: null,
      currentWorkflow: null,
    })
  },
}))
