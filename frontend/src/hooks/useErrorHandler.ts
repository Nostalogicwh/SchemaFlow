import { useCallback } from 'react'
import { toast } from '@/stores/uiStore'

export function useErrorHandler() {
  return useCallback((error: unknown, fallbackMessage = '操作失败') => {
    let message: string
    
    if (error instanceof Error) {
      message = error.message
    } else if (typeof error === 'string') {
      message = error
    } else if (error && typeof error === 'object' && 'message' in error) {
      message = String((error as { message: unknown }).message)
    } else {
      message = fallbackMessage
    }
    
    console.error('[Error]', error)
    toast.error(message)
  }, [])
}

export function withErrorHandler<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  handleError: (error: unknown, fallback: string) => void,
  fallbackMessage: string
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args)
    } catch (error) {
      handleError(error, fallbackMessage)
      throw error
    }
  }) as T
}

export default useErrorHandler
