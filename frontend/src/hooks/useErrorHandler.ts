import { useCallback } from 'react'
import { toast } from '@/stores/uiStore'

/**
 * 错误处理 Hook
 * 统一处理错误并显示 Toast 提示
 * @returns 错误处理函数
 * @example
 * const handleError = useErrorHandler()
 * try {
 *   await someAsyncOperation()
 * } catch (error) {
 *   handleError(error, '操作失败')
 * }
 */
export function useErrorHandler() {
  return useCallback((error: unknown, fallbackMessage = '操作失败') => {
    let message: string
    
    // 提取错误消息
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

/**
 * 带错误处理的函数包装器
 * 自动捕获函数执行中的错误并处理
 * @param fn - 要包装的异步函数
 * @param handleError - 错误处理函数
 * @param fallbackMessage - 默认错误消息
 * @returns 包装后的函数
 * @example
 * const fetchData = withErrorHandler(
 *   api.getData,
 *   handleError,
 *   '获取数据失败'
 * )
 */
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
