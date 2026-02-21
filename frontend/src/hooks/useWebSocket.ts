/**
 * WebSocket 连接管理 Hook
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  WSMessage,
  WSLog,
  WSUserInputRequired,
  ExecutionState,
  NodeStatus,
} from '@/types/workflow'

interface UseWebSocketOptions {
  onMessage?: (message: WSMessage) => void
  autoReconnect?: boolean
  reconnectInterval?: number
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { onMessage, autoReconnect = true, reconnectInterval = 3000 } = options

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)

  const [isConnected, setIsConnected] = useState(false)
  const [executionState, setExecutionState] = useState<ExecutionState>({
    executionId: null,
    isRunning: false,
    currentNodeId: null,
    nodeStatuses: {},
    logs: [],
    screenshot: null,
    userInputRequest: null,
  })

  // 存储 workflow_id
  const workflowIdRef = useRef<string | null>(null)

  // 连接 WebSocket
  const connect = useCallback((executionId: string, workflowId?: string) => {
    // 关闭现有连接
    if (wsRef.current) {
      wsRef.current.close()
    }

    // 保存 workflow_id
    if (workflowId) {
      workflowIdRef.current = workflowId
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const url = `${protocol}//${host}/api/ws/execution/${executionId}`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setIsConnected(true)
      setExecutionState(prev => ({
        ...prev,
        executionId,
        isRunning: true,
      }))
    }

    ws.onclose = () => {
      setIsConnected(false)
      if (autoReconnect && executionState.isRunning) {
        reconnectTimerRef.current = window.setTimeout(() => {
          connect(executionId)
        }, reconnectInterval)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket 错误:', error)
    }

    ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data)
        handleMessage(message)
        onMessage?.(message)
      } catch (e) {
        console.error('解析 WebSocket 消息失败:', e)
      }
    }
  }, [autoReconnect, reconnectInterval, onMessage, executionState.isRunning])

  // 处理消息
  const handleMessage = useCallback((message: WSMessage) => {
    switch (message.type) {
      case 'execution_started':
        setExecutionState(prev => ({
          ...prev,
          isRunning: true,
          nodeStatuses: {},
          logs: [],
        }))
        break

      case 'node_start':
        setExecutionState(prev => ({
          ...prev,
          currentNodeId: message.node_id as string,
          nodeStatuses: {
            ...prev.nodeStatuses,
            [message.node_id as string]: 'running' as NodeStatus,
          },
        }))
        break

      case 'node_complete': {
        const status: NodeStatus = message.success ? 'completed' : 'failed'
        setExecutionState(prev => ({
          ...prev,
          nodeStatuses: {
            ...prev.nodeStatuses,
            [message.node_id as string]: status,
          },
        }))
        break
      }

      case 'screenshot':
        setExecutionState(prev => ({
          ...prev,
          screenshot: message.data as string,
        }))
        break

      case 'user_input_required':
        setExecutionState(prev => ({
          ...prev,
          userInputRequest: message as WSUserInputRequired,
        }))
        break

      case 'log':
        setExecutionState(prev => ({
          ...prev,
          logs: [...prev.logs, message as WSLog],
        }))
        break

      case 'execution_complete':
        setExecutionState(prev => ({
          ...prev,
          isRunning: false,
          currentNodeId: null,
          userInputRequest: null,
        }))
        break

      case 'error':
        setExecutionState(prev => ({
          ...prev,
          isRunning: false,
          logs: [
            ...prev.logs,
            {
              type: 'log',
              level: 'error',
              message: message.message as string,
              timestamp: new Date().toISOString(),
            },
          ],
        }))
        break
    }
  }, [])

  // 发送消息
  const send = useCallback((message: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    }
  }, [])

  // 开始执行
  const startExecution = useCallback((workflowId?: string) => {
    // 防止 React 事件对象被当作 workflowId 传入（从 onClick 直接调用时）
    const wfId = (typeof workflowId === 'string' ? workflowId : null) || workflowIdRef.current
    if (wfId) {
      send({ type: 'start_execution', workflow_id: wfId })
    } else {
      console.error('startExecution: 缺少 workflow_id')
    }
  }, [send])

  // 停止执行
  const stopExecution = useCallback(() => {
    send({ type: 'stop_execution' })
  }, [send])

  // 响应用户输入
  const respondUserInput = useCallback((nodeId: string, action: 'continue' | 'cancel') => {
    send({
      type: 'user_input_response',
      node_id: nodeId,
      action,
    })
    setExecutionState(prev => ({
      ...prev,
      userInputRequest: null,
    }))
  }, [send])

  // 断开连接
  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setIsConnected(false)
    setExecutionState(prev => ({
      ...prev,
      isRunning: false,
    }))
  }, [])

  // 重置状态
  const reset = useCallback(() => {
    setExecutionState({
      executionId: null,
      isRunning: false,
      currentNodeId: null,
      nodeStatuses: {},
      logs: [],
      screenshot: null,
      userInputRequest: null,
    })
  }, [])

  // 清理
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    isConnected,
    executionState,
    connect,
    disconnect,
    send,
    startExecution,
    stopExecution,
    respondUserInput,
    reset,
  }
}
