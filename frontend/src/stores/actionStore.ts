import { create } from 'zustand'
import { actionApi } from '@/api'
import type { ActionMetadata } from '@/types/workflow'

/** Action 状态接口 */
interface ActionState {
  /** 动作元数据列表 */
  actions: ActionMetadata[]
  /** 是否正在加载 */
  isLoading: boolean
  /** 是否已加载 */
  loaded: boolean
  /**
   * 加载动作列表
   * 带防抖，避免重复请求
   */
  loadActions: () => Promise<void>
}

/**
 * Action 状态管理 Store
 * 管理可用的节点动作类型
 * @example
 * const { actions, loadActions } = useActionStore()
 */
export const useActionStore = create<ActionState>((set, get) => ({
  actions: [],
  isLoading: false,
  loaded: false,

  /**
   * 加载动作列表
   * 如果正在加载或已加载则跳过
   */
  loadActions: async () => {
    const { isLoading, loaded } = get()
    if (isLoading || loaded) return
    try {
      set({ isLoading: true })
      const actions = await actionApi.list()
      set({ actions, isLoading: false, loaded: true })
    } catch (error) {
      console.error('加载 actions 失败:', error)
      set({ isLoading: false })
    }
  },
}))
