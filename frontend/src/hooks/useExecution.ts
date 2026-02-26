import { useCallback, useEffect, useRef } from 'react'
import { useExecutionStore } from '@/stores/executionStore'
import { credentialStore } from '@/services/credentialStore'
import type { WSMessage } from '@/types/workflow'

/** useExecution Hook 选项 */
interface UseExecutionOptions {
  /** 是否自动重连，默认 true */
  autoReconnect?: boolean
  /** 重连间隔（毫秒），默认 3000 */
  reconnectInterval?: number
}

/**
 * 工作流执行 Hook
 * 管理 WebSocket 连接、执行控制和用户交互
 * @param options - 配置选项
 * @returns 执行控制方法
 * @example
 * const { connect, startExecution, stopExecution } = useExecution()
 */
export function useExecution(options: UseExecutionOptions = {}) {
  const { autoReconnect = true, reconnectInterval = 3000 } = options

  /** 重连定时器引用 */
  const reconnectTimerRef = useRef<number | null>(null)
  /** 工作流ID引用（用于重连） */
  const workflowIdRef = useRef<string | null>(null)
  /** 执行ID引用（用于重连） */
  const executionIdRef = useRef<string | null>(null)

  const {
    setConnected,
    setExecutionId,
    reset,
    showPanel,
    setShowPanel,
    executionMode,
    setExecutionMode,
    executionState,
    setWebSocket,
    sendWS,
    setCurrentWorkflowId,
  } = useExecutionStore()

  /** connect 函数的引用，用于重连时调用 */
  const connectRef = useRef<(executionId: string, workflowId?: string) => void>(() => {})

  /**
   * 建立 WebSocket 连接
   * @param executionId - 执行ID
   * @param workflowId - 工作流ID（可选）
   */
  const connect = useCallback(
    (executionId: string, workflowId?: string) => {
      const oldWs = useExecutionStore.getState()._ws
      if (oldWs) {
        oldWs.close()
      }

      if (workflowId) {
        workflowIdRef.current = workflowId
        setCurrentWorkflowId(workflowId)
      }
      executionIdRef.current = executionId

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.host
      const url = `${protocol}//${host}/api/ws/execution/${executionId}`

      const ws = new WebSocket(url)
      setWebSocket(ws)

      ws.onopen = () => {
        setConnected(true)
        setExecutionId(executionId)
        console.log(`[WebSocket] 已连接: ${executionId}`)
      }

      ws.onclose = () => {
        setConnected(false)
        console.log(`[WebSocket] 已断开`)
        if (autoReconnect && useExecutionStore.getState().executionState.isRunning) {
          reconnectTimerRef.current = window.setTimeout(() => {
            const execId = executionIdRef.current
            if (execId) {
              connectRef.current(execId)
            }
          }, reconnectInterval)
        }
      }

      ws.onerror = (error) => {
        console.error('[WebSocket] 错误:', error)
      }

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data)
          useExecutionStore.getState().handleMessage(message)
        } catch (e) {
          console.error('[WebSocket] 解析消息失败:', e)
        }
      }
    },
    [autoReconnect, reconnectInterval, setConnected, setExecutionId, setWebSocket, setCurrentWorkflowId]
  )

  /**
   * 同步 connect 函数到 ref，供重连使用
   */
  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  /**
   * 断开 WebSocket 连接
   */
  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
    }
    const ws = useExecutionStore.getState()._ws
    if (ws) {
      ws.close()
      setWebSocket(null)
    }
    setConnected(false)
  }, [setConnected, setWebSocket])

  /**
   * 开始执行工作流
   * @param workflowId - 工作流ID（可选，默认使用当前连接的）
   * @param mode - 执行模式
   */
  const startExecution = useCallback(
    async (workflowId?: string, mode: 'headless' | 'headed' = 'headless') => {
      const wfId = (typeof workflowId === 'string' ? workflowId : null) || workflowIdRef.current
      if (wfId) {
        // 获取已保存的凭证
        const credentials = await credentialStore.get(wfId)
        if (credentials) {
          console.log(`[startExecution] 注入凭证: workflow=${wfId}, cookies=${credentials.cookies?.length || 0}`)
        } else {
          console.log(`[startExecution] 无历史凭证: workflow=${wfId}`)
        }
        sendWS({
          type: 'start_execution',
          workflow_id: wfId,
          mode,
          injected_storage_state: credentials
        })
      } else {
        console.error('startExecution: 缺少 workflow_id')
      }
    },
    [sendWS]
  )

  /**
   * 停止执行
   * @param executionId - 执行ID（可选）
   */
  const stopExecution = useCallback(
    async (executionId?: string) => {
      sendWS({ type: 'stop_execution' })

      const execId = executionId || executionState.executionId
      if (execId) {
        try {
          await fetch(`/api/executions/${execId}/stop`, { method: 'POST' })
        } catch (e) {
          console.error('REST stop 失败:', e)
        }
      }
    },
    [sendWS, executionState.executionId]
  )

  /**
   * 响应用户输入请求
   * @param nodeId - 节点ID
   * @param action - 用户操作：继续或取消
   */
  const respondUserInput = useCallback(
    (nodeId: string, action: 'continue' | 'cancel') => {
      console.log(`[respondUserInput] 发送响应: node_id=${nodeId}, action=${action}`)
      sendWS({
        type: 'user_input_response',
        node_id: nodeId,
        action,
      })
      useExecutionStore.getState().setUserInputRequest(null)
    },
    [sendWS]
  )

  /**
   * 确认登录完成
   * @param executionId - 执行ID
   */
  const confirmLogin = useCallback(
    (executionId: string) => {
      sendWS({
        type: 'login_confirmed',
        execution_id: executionId
      })
    },
    [sendWS]
  )

  /**
   * 组件卸载时断开连接
   */
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    connect,
    disconnect,
    startExecution,
    stopExecution,
    respondUserInput,
    confirmLogin,
    reset,
    showPanel,
    setShowPanel,
    executionMode,
    setExecutionMode,
  }
}
