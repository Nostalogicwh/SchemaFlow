import { useCallback, useEffect, useRef } from 'react'
import { useExecutionStore } from '@/stores/executionStore'
import { credentialStore } from '@/services/credentialStore'
import type { WSMessage } from '@/types/workflow'

interface UseExecutionOptions {
  autoReconnect?: boolean
  reconnectInterval?: number
}

export function useExecution(options: UseExecutionOptions = {}) {
  const { autoReconnect = true, reconnectInterval = 3000 } = options

  const reconnectTimerRef = useRef<number | null>(null)
  const workflowIdRef = useRef<string | null>(null)
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

  const connectRef = useRef<(executionId: string, workflowId?: string) => void>(() => {})

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

  useEffect(() => {
    connectRef.current = connect
  }, [connect])

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

  const startExecution = useCallback(
    async (workflowId?: string, mode: 'headless' | 'headed' = 'headless') => {
      const wfId = (typeof workflowId === 'string' ? workflowId : null) || workflowIdRef.current
      if (wfId) {
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

  const confirmLogin = useCallback(
    (executionId: string) => {
      sendWS({
        type: 'login_confirmed',
        execution_id: executionId
      })
    },
    [sendWS]
  )

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
