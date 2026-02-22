export interface AsyncActionOptions<T> {
  onStart?: () => void
  onSuccess?: (result: T) => void
  onError?: (error: Error) => void
}

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

export const STORE_NAMING = {
  SET_PREFIX: 'set',
  UPDATE_PREFIX: 'update',
  RESET_ACTION: 'reset',
} as const
