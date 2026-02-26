import { create } from 'zustand'

/** Toast 消息类型 */
export type ToastType = 'success' | 'error' | 'info'

/** Toast 消息对象 */
export interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

/** UI 状态接口 */
interface UIState {
  /** 当前显示的 Toast 列表 */
  toasts: Toast[]
  /**
   * 添加 Toast
   * @param type - 消息类型
   * @param message - 消息内容
   * @param duration - 显示时长（毫秒），默认3000
   */
  addToast: (type: ToastType, message: string, duration?: number) => void
  /** 移除指定 Toast */
  removeToast: (id: string) => void
  /** 确认对话框状态 */
  confirmDialog: {
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
    onCancel: () => void
  } | null
  /**
   * 显示确认对话框
   * @param title - 标题
   * @param message - 内容
   * @returns Promise，用户点击确认返回 true，取消返回 false
   */
  showConfirm: (title: string, message: string) => Promise<boolean>
  /**
   * 关闭确认对话框
   * @param result - 用户选择的结果
   */
  closeConfirm: (result: boolean) => void
}

let toastId = 0
let confirmResolve: ((result: boolean) => void) | null = null

/**
 * UI 状态管理 Store
 * 管理 Toast 消息和确认对话框
 * @example
 * const { toasts, showConfirm } = useUIStore()
 */
export const useUIStore = create<UIState>((set, get) => ({
  toasts: [],
  confirmDialog: null,

  /**
   * 添加 Toast 消息
   * 自动在指定时间后消失
   */
  addToast: (type, message, duration = 3000) => {
    const id = `toast-${++toastId}`
    set((state) => ({
      toasts: [...state.toasts, { id, type, message, duration }],
    }))

    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id)
      }, duration)
    }
  },

  /**
   * 移除指定 Toast
   */
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },

  /**
   * 显示确认对话框
   * 返回 Promise，用户操作后 resolve
   */
  showConfirm: (title, message) => {
    return new Promise<boolean>((resolve) => {
      confirmResolve = resolve
      set({
        confirmDialog: {
          isOpen: true,
          title,
          message,
          onConfirm: () => get().closeConfirm(true),
          onCancel: () => get().closeConfirm(false),
        },
      })
    })
  },

  /**
   * 关闭确认对话框并回调结果
   */
  closeConfirm: (result) => {
    set({ confirmDialog: null })
    if (confirmResolve) {
      confirmResolve(result)
      confirmResolve = null
    }
  },
}))

/**
 * Toast 快捷方法
 * @example
 * toast.success('操作成功')
 * toast.error('操作失败')
 */
export const toast = {
  success: (message: string, duration?: number) => useUIStore.getState().addToast('success', message, duration),
  error: (message: string, duration?: number) => useUIStore.getState().addToast('error', message, duration),
  info: (message: string, duration?: number) => useUIStore.getState().addToast('info', message, duration),
}

/**
 * 确认对话框快捷方法
 * @example
 * const confirmed = await confirm('删除确认', '确定删除此项？')
 */
export const confirm = (title: string, message: string) => useUIStore.getState().showConfirm(title, message)
