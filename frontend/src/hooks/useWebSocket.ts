/**
 * WebSocket 连接管理 Hook
 * 独立的 WebSocket 管理，用于非执行场景
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  WSMessage,
  WSLog,
  WSUserInputRequired,
  ExecutionState,
  NodeStatus,
  NodeExecutionRecord,
} from '@/types/workflow'

/** useWebSocket 选项 */
interface UseWebSocketOptions {
  /** 消息回调 */
  onMessage?: (message: WSMessage) => void
  /** 选择器更新回调（AI定位成功后） */
  onSelectorUpdate?: (nodeId: string, selector: string) => void
  /** 是否自动重连，默认 true */
  autoReconnect?: boolean
  /** 重连间隔（毫秒），默认 3000 */
  reconnectInterval?: number
}

/**
 * WebSocket 连接管理 Hook
 * 管理 WebSocket 连接、消息处理和状态同步
 * @param options - 配置选项
 * @returns WebSocket 控制方法
 * @example
 * const { connect, send, isConnected } = useWebSocket({
 *   onMessage: (msg) => console.log(msg)
 * })
 */
export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { onMessage, onSelectorUpdate, autoReconnect = true, reconnectInterval = 3000 } = options

  /** WebSocket 实例引用 */
  const wsRef = useRef<WebSocket | null>(null)
  /** 重连定时器引用 */
  const reconnectTimerRef = useRef<number | null>(null)
  /** connect 函数引用，用于重连 */
  const connectRef = useRef<(executionId: string, workflowId?: string) => void>(() => {})

  /** 连接状态 */
  const [isConnected, setIsConnected] = useState(false)
  /** 执行状态 */
  const [executionState, setExecutionState] = useState<ExecutionState>({
    executionId: null,
    isRunning: false,
    currentNodeId: null,
    nodeStatuses: {},
    logs: [],
    screenshot: null,
    userInputRequest: null,
    nodeRecords: [],
  })

  /** 工作流ID引用（用于重连） */
  const workflowIdRef = useRef<string | null>(null)

  /**
   * 处理 WebSocket 消息
   * 根据消息类型更新执行状态
   */
  const handleMessage = useCallback((message: WSMessage) => {
    switch (message.type) {
      case 'execution_started':
        setExecutionState(prev => ({
          ...prev,
          isRunning: true,
          nodeStatuses: {},
          logs: [],
          nodeRecords: [],
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
        const record = message.record as NodeExecutionRecord | undefined
        setExecutionState(prev => ({
          ...prev,
          nodeStatuses: {
            ...prev.nodeStatuses,
            [message.node_id as string]: status,
          },
          nodeRecords: record
            ? [...prev.nodeRecords, record]
            : prev.nodeRecords,
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

      case 'selector_update': {
        // AI 定位成功后回填选择器
        const nodeId = message.node_id as string
        const selector = message.selector as string
        if (nodeId && selector && onSelectorUpdate) {
          onSelectorUpdate(nodeId, selector)
        }
        break
      }
    }
  }, [onSelectorUpdate])

  /**
   * 建立 WebSocket 连接
   * @param executionId - 执行ID
   * @param workflowId - 工作流ID（可选）
   */
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
          connectRef.current(executionId)
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
  }, [autoReconnect, reconnectInterval, onMessage, executionState.isRunning, handleMessage])

  /**
   * 同步 connect 函数到 ref
   */
  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  /**
   * 发送 WebSocket 消息
   * @param message - 消息对象
   */
  const send = useCallback((message: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    }
  }, [])

  /**
   * 开始执行工作流
   * @param workflowId - 工作流ID
   * @param mode - 执行模式
   */
  const startExecution = useCallback((workflowId?: string, mode: 'headless' | 'headed' = 'headless') => {
    // 防止 React 事件对象被当作 workflowId 传入（从 onClick 直接调用时）
    const wfId = (typeof workflowId === 'string' ? workflowId : null) || workflowIdRef.current
    if (wfId) {
      send({ type: 'start_execution', workflow_id: wfId, mode })
    } else {
      console.error('startExecution: 缺少 workflow_id')
    }
  }, [send])

  /**
   * 停止执行
   */
  const stopExecution = useCallback(() => {
    send({ type: 'stop_execution' })
  }, [send])

  /**
   * 响应用户输入请求
   * @param nodeId - 节点ID
   * @param action - 用户操作
   */
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

  /**
   * 断开 WebSocket 连接
   */
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

  /**
   * 重置执行状态
   */
  const reset = useCallback(() => {
    setExecutionState({
      executionId: null,
      isRunning: false,
      currentNodeId: null,
      nodeStatuses: {},
      logs: [],
      screenshot: null,
      userInputRequest: null,
      nodeRecords: [],
    })
  }, [])

  /**
   * 组件卸载时断开连接
   */
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
