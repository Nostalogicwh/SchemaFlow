import { create } from 'zustand'
import { workflowApi } from '@/api'
import type { Workflow, WorkflowListItem } from '@/types/workflow'

interface WorkflowState {
  selectedId: string | null
  currentWorkflow: Workflow | null
  workflows: WorkflowListItem[]
  isLoadingList: boolean
  selectWorkflow: (id: string) => Promise<void>
  createWorkflow: (name: string) => Promise<Workflow>
  saveWorkflow: (workflow: Workflow) => Promise<void>
  loadWorkflows: () => Promise<void>
  addWorkflowToList: (workflow: WorkflowListItem) => void
  updateWorkflowInList: (id: string, updates: Partial<WorkflowListItem>) => void
  removeWorkflowFromList: (id: string) => void
  reset: () => void
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  selectedId: null,
  currentWorkflow: null,
  workflows: [],
  isLoadingList: false,

  selectWorkflow: async (id: string) => {
    try {
      const workflow = await workflowApi.get(id)
      set({ selectedId: id, currentWorkflow: workflow })
    } catch (error) {
      console.error('加载工作流失败:', error)
      throw error
    }
  },

  createWorkflow: async (name: string): Promise<Workflow> => {
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
      })
      get().addWorkflowToList(workflow)
      return workflow
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

  loadWorkflows: async () => {
    const { isLoadingList } = get()
    if (isLoadingList) return
    try {
      set({ isLoadingList: true })
      const list = await workflowApi.list()
      set({ workflows: list, isLoadingList: false })
    } catch (error) {
      console.error('加载工作流列表失败:', error)
      set({ isLoadingList: false })
    }
  },

  addWorkflowToList: (workflow: WorkflowListItem) => {
    set((state) => ({
      workflows: [workflow, ...state.workflows],
    }))
  },

  removeWorkflowFromList: (id: string) => {
    set((state) => ({
      workflows: state.workflows.filter((w) => w.id !== id),
    }))
  },

  updateWorkflowInList: (id: string, updates: Partial<WorkflowListItem>) => {
    set((state) => ({
      workflows: state.workflows.map((w) =>
        w.id === id ? { ...w, ...updates } : w
      ),
    }))
  },

  reset: () => {
    set({
      selectedId: null,
      currentWorkflow: null,
    })
  },
}))
