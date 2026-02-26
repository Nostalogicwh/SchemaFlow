/**
 * 异步操作选项
 */
export interface AsyncActionOptions<T> {
  /** 操作开始时的回调 */
  onStart?: () => void
  /** 操作成功时的回调 */
  onSuccess?: (result: T) => void
  /** 操作失败时的回调 */
  onError?: (error: Error) => void
}

/**
 * 创建异步操作包装器
 * 自动处理回调和错误
 * @param fn - 异步函数
 * @param options - 选项配置
 * @returns 包装后的函数
 * @example
 * const fetchData = createAsyncAction(api.getData, {
 *   onSuccess: (data) => console.log(data)
 * })
 */
export function createAsyncAction<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  options?: AsyncActionOptions<T>
) {
  return async (...args: Args): Promise<T | null> => {
    try {
      options?.onStart?.()
      const result = await fn(...args)
      options?.onSuccess?.(result)
      return result
    } catch (error) {
      options?.onError?.(error as Error)
      return null
    }
  }
}

/**
 * 创建带 loading 状态的异步操作
 * 自动管理 loading 状态
 * @param set - Zustand 的 set 函数
 * @param fn - 异步函数
 * @param options - 选项配置，可指定 loadingKey
 * @returns 包装后的函数
 * @example
 * const fetchData = createLoadingAsyncAction(set, api.getData, {
 *   loadingKey: 'isFetching'
 * })
 */
export function createLoadingAsyncAction<T, Args extends unknown[]>(
  set: (partial: Record<string, unknown>) => void,
  fn: (...args: Args) => Promise<T>,
  options?: AsyncActionOptions<T> & { loadingKey?: string }
) {
  const loadingKey = options?.loadingKey || 'isLoading'
  return async (...args: Args): Promise<T | null> => {
    try {
      set({ [loadingKey]: true })
      options?.onStart?.()
      const result = await fn(...args)
      options?.onSuccess?.(result)
      return result
    } catch (error) {
      options?.onError?.(error as Error)
      return null
    } finally {
      set({ [loadingKey]: false })
    }
  }
}

/**
 * Store 命名规范常量
 */
export const STORE_NAMING = {
  /** Set 方法前缀 */
  SET_PREFIX: 'set',
  /** Update 方法前缀 */
  UPDATE_PREFIX: 'update',
  /** 重置方法名 */
  RESET_ACTION: 'reset',
} as const
