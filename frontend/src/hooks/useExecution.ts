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

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const workflowIdRef = useRef<string | null>(null)

  const { setConnected, setExecutionId, reset, showPanel, setShowPanel, executionMode, setExecutionMode, executionState } =
    useExecutionStore()

  const connectRef = useRef<(executionId: string, workflowId?: string) => void>(() => {})

  const connect = useCallback(
    (executionId: string, workflowId?: string) => {
      if (wsRef.current) {
        wsRef.current.close()
      }

      if (workflowId) {
        workflowIdRef.current = workflowId
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.host
      const url = `${protocol}//${host}/api/ws/execution/${executionId}`

      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        setExecutionId(executionId)
      }

      ws.onclose = () => {
        setConnected(false)
        if (autoReconnect && executionState.isRunning) {
          reconnectTimerRef.current = window.setTimeout(() => {
            if (executionId) {
              connectRef.current(executionId)
            }
          }, reconnectInterval)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket 错误:', error)
      }

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data)
          useExecutionStore.getState().handleMessage(message)
        } catch (e) {
          console.error('解析 WebSocket 消息失败:', e)
        }
      }
    },
    [autoReconnect, reconnectInterval, setConnected, setExecutionId, executionState.isRunning]
  )

  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setConnected(false)
  }, [setConnected])

  const send = useCallback((message: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    }
  }, [])

  const startExecution = useCallback(
    async (workflowId?: string, mode: 'headless' | 'headed' = 'headless') => {
      const wfId = (typeof workflowId === 'string' ? workflowId : null) || workflowIdRef.current
      if (wfId) {
        // 从 IndexedDB 获取凭证
        const credentials = await credentialStore.get(wfId)
        send({ 
          type: 'start_execution', 
          workflow_id: wfId, 
          mode,
          injected_storage_state: credentials  // 可能为 null
        })
      } else {
        console.error('startExecution: 缺少 workflow_id')
      }
    },
    [send]
  )

  const stopExecution = useCallback(() => {
    send({ type: 'stop_execution' })
  }, [send])

  const respondUserInput = useCallback(
    (nodeId: string, action: 'continue' | 'cancel') => {
      send({
        type: 'user_input_response',
        node_id: nodeId,
        action,
      })
      useExecutionStore.getState().setUserInputRequest(null)
    },
    [send]
  )

  const confirmLogin = useCallback(
    (executionId: string) => {
      send({
        type: 'login_confirmed',
        execution_id: executionId
      })
    },
    [send]
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
    confirmLogin,  // 新增
    reset,
    showPanel,
    setShowPanel,
    executionMode,
    setExecutionMode,
  }
}
