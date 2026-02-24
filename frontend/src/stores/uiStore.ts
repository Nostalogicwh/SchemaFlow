import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface UIState {
  toasts: Toast[]
  addToast: (type: ToastType, message: string, duration?: number) => void
  removeToast: (id: string) => void
  confirmDialog: {
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
    onCancel: () => void
  } | null
  showConfirm: (title: string, message: string) => Promise<boolean>
  closeConfirm: (result: boolean) => void
}

let toastId = 0
let confirmResolve: ((result: boolean) => void) | null = null

export const useUIStore = create<UIState>((set, get) => ({
  toasts: [],
  confirmDialog: null,

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

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },

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

  closeConfirm: (result) => {
    set({ confirmDialog: null })
    if (confirmResolve) {
      confirmResolve(result)
      confirmResolve = null
    }
  },
}))

export const toast = {
  success: (message: string, duration?: number) => useUIStore.getState().addToast('success', message, duration),
  error: (message: string, duration?: number) => useUIStore.getState().addToast('error', message, duration),
  info: (message: string, duration?: number) => useUIStore.getState().addToast('info', message, duration),
}

export const confirm = (title: string, message: string) => useUIStore.getState().showConfirm(title, message)
