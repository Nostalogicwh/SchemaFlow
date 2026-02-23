import { create } from 'zustand'
import { actionApi } from '@/api'
import type { ActionMetadata } from '@/types/workflow'

interface ActionState {
  actions: ActionMetadata[]
  isLoading: boolean
  loaded: boolean
  loadActions: () => Promise<void>
}

export const useActionStore = create<ActionState>((set, get) => ({
  actions: [],
  isLoading: false,
  loaded: false,

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
