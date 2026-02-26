import { create } from 'zustand'
import { workflowApi } from '@/api'
import type { Workflow, WorkflowListItem } from '@/types/workflow'

/**
 * 工作流状态接口
 * 定义工作流相关的所有状态和操作
 */
interface WorkflowState {
  /** 当前选中的工作流ID */
  selectedId: string | null
  /** 当前加载的完整工作流对象 */
  currentWorkflow: Workflow | null
  /** 工作流列表（用于侧边栏展示） */
  workflows: WorkflowListItem[]
  /** 是否正在加载列表 */
  isLoadingList: boolean

  /**
   * 选择并加载指定工作流
   * @param id - 工作流ID
   */
  selectWorkflow: (id: string) => Promise<void>

  /**
   * 创建新工作流
   * @param name - 工作流名称
   * @returns 创建的工作流对象
   */
  createWorkflow: (name: string) => Promise<Workflow>

  /**
   * 保存工作流
   * @param workflow - 要保存的工作流对象
   */
  saveWorkflow: (workflow: Workflow) => Promise<void>

  /**
   * 加载工作流列表
   */
  loadWorkflows: () => Promise<void>

  /**
   * 向列表中添加工作流
   * @param workflow - 工作流列表项
   */
  addWorkflowToList: (workflow: WorkflowListItem) => void

  /**
   * 更新列表中的工作流
   * @param id - 工作流ID
   * @param updates - 要更新的字段
   */
  updateWorkflowInList: (id: string, updates: Partial<WorkflowListItem>) => void

  /**
   * 从列表中移除工作流
   * @param id - 工作流ID
   */
  removeWorkflowFromList: (id: string) => void

  /**
   * 重置选中状态
   */
  reset: () => void
}

/**
 * 工作流状态管理 Store
 * 使用 Zustand 管理全局工作流状态
 * @example
 * const { workflows, loadWorkflows } = useWorkflowStore()
 */
export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  selectedId: null,
  currentWorkflow: null,
  workflows: [],
  isLoadingList: false,

  /**
   * 选择并加载指定工作流
   * 从API获取完整工作流数据并更新状态
   */
  selectWorkflow: async (id: string) => {
    try {
      const workflow = await workflowApi.get(id)
      set({ selectedId: id, currentWorkflow: workflow })
    } catch (error) {
      console.error('加载工作流失败:', error)
      throw error
    }
  },

  /**
   * 创建新工作流
   * 创建默认包含开始和结束节点的工作流
   */
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

  /**
   * 保存工作流
   * 调用API更新并同步本地状态
   */
  saveWorkflow: async (workflow: Workflow) => {
    try {
      await workflowApi.update(workflow.id, workflow)
      set({ currentWorkflow: workflow })
    } catch (error) {
      console.error('保存工作流失败:', error)
      throw error
    }
  },

  /**
   * 加载工作流列表
   * 带防抖，防止重复请求
   */
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

  /**
   * 向列表开头添加工作流
   */
  addWorkflowToList: (workflow: WorkflowListItem) => {
    set((state) => ({
      workflows: [workflow, ...state.workflows],
    }))
  },

  /**
   * 从列表中移除指定工作流
   */
  removeWorkflowFromList: (id: string) => {
    set((state) => ({
      workflows: state.workflows.filter((w) => w.id !== id),
    }))
  },

  /**
   * 更新列表中指定工作流的信息
   */
  updateWorkflowInList: (id: string, updates: Partial<WorkflowListItem>) => {
    set((state) => ({
      workflows: state.workflows.map((w) =>
        w.id === id ? { ...w, ...updates } : w
      ),
    }))
  },

  /**
   * 重置选中状态和当前工作流
   */
  reset: () => {
    set({
      selectedId: null,
      currentWorkflow: null,
    })
  },
}))
