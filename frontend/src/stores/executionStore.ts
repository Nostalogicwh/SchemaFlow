import { create } from 'zustand'
import { credentialStore, type StorageState } from '@/services/credentialStore'
import { useWorkflowStore } from './workflowStore'
import { workflowApi } from '@/api'
import { toast } from '@/stores/uiStore'
import type {
  ExecutionState,
  NodeStatus,
  NodeExecutionRecord,
  WSMessage,
  WSLog,
  WSUserInputRequired,
} from '@/types/workflow'

/**
 * 执行状态存储的状态部分
 */
interface ExecutionStoreState {
  /** WebSocket连接状态 */
  isConnected: boolean
  /** 执行状态详情 */
  executionState: ExecutionState
  /** 是否显示执行面板 */
  showPanel: boolean
  /** 执行模式：无头或有头浏览器 */
  executionMode: 'headless' | 'headed'
  /** 是否需要登录 */
  loginRequired: boolean
  /** 登录原因提示 */
  loginReason: string | null
  /** 登录页面URL */
  loginUrl: string | null
  /** 当前执行的工作流ID */
  currentWorkflowId: string | null
  /** WebSocket实例（私有） */
  _ws: WebSocket | null
}

/**
 * 执行状态存储的操作部分
 */
interface ExecutionStoreActions {
  /** 设置连接状态 */
  setConnected: (connected: boolean) => void
  /** 设置执行ID */
  setExecutionId: (id: string | null) => void
  /** 设置运行状态 */
  setRunning: (running: boolean) => void
  /**
   * 设置节点执行状态
   * @param nodeId - 节点ID
   * @param status - 执行状态
   */
  setNodeStatus: (nodeId: string, status: NodeStatus) => void
  /** 添加日志 */
  addLog: (log: WSLog) => void
  /** 设置截图 */
  setScreenshot: (screenshot: string | null) => void
  /** 设置用户输入请求 */
  setUserInputRequest: (request: WSUserInputRequired | null) => void
  /** 添加节点执行记录 */
  addNodeRecord: (record: NodeExecutionRecord) => void
  /** 设置面板显示状态 */
  setShowPanel: (show: boolean) => void
  /** 设置执行模式 */
  setExecutionMode: (mode: 'headless' | 'headed') => void
  /** 重置执行状态 */
  reset: () => void
  /**
   * 处理WebSocket消息
   * @param message - WebSocket消息对象
   */
  handleMessage: (message: WSMessage) => void
  /**
   * 设置登录需求
   * @param required - 是否需要登录
   * @param reason - 原因提示
   * @param url - 登录URL
   */
  setLoginRequired: (required: boolean, reason?: string | null, url?: string | null) => void
  /** 设置当前工作流ID */
  setCurrentWorkflowId: (id: string | null) => void
  /** 设置WebSocket实例 */
  setWebSocket: (ws: WebSocket | null) => void
  /**
   * 发送WebSocket消息
   * @param message - 要发送的消息
   */
  sendWS: (message: WSMessage) => void
}

type ExecutionStore = ExecutionStoreState & ExecutionStoreActions

/** 执行状态初始值 */
const initialExecutionState: ExecutionState = {
  executionId: null,
  isRunning: false,
  currentNodeId: null,
  nodeStatuses: {},
  logs: [],
  screenshot: null,
  userInputRequest: null,
  nodeRecords: [],
}

/**
 * 执行状态管理 Store
 * 管理工作流执行过程中的所有状态和WebSocket通信
 * @example
 * const { isConnected, executionState, handleMessage } = useExecutionStore()
 */
export const useExecutionStore = create<ExecutionStore>((set, get) => ({
  isConnected: false,
  executionState: initialExecutionState,
  showPanel: false,
  executionMode: 'headless',
  loginRequired: false,
  loginReason: null,
  loginUrl: null,
  currentWorkflowId: null,
  _ws: null,

  setConnected: (connected) => set({ isConnected: connected }),

  setExecutionId: (id) =>
    set((state) => ({
      executionState: { ...state.executionState, executionId: id },
    })),

  setRunning: (running) =>
    set((state) => ({
      executionState: { ...state.executionState, isRunning: running },
    })),

  setNodeStatus: (nodeId, status) =>
    set((state) => ({
      executionState: {
        ...state.executionState,
        nodeStatuses: { ...state.executionState.nodeStatuses, [nodeId]: status },
      },
    })),

  addLog: (log) =>
    set((state) => ({
      executionState: {
        ...state.executionState,
        logs: [...state.executionState.logs, log],
      },
    })),

  setScreenshot: (screenshot) =>
    set((state) => ({
      executionState: { ...state.executionState, screenshot },
    })),

  setUserInputRequest: (request) =>
    set((state) => ({
      executionState: { ...state.executionState, userInputRequest: request },
    })),

  addNodeRecord: (record) =>
    set((state) => ({
      executionState: {
        ...state.executionState,
        nodeRecords: [...state.executionState.nodeRecords, record],
      },
    })),

  setShowPanel: (show) => set({ showPanel: show }),

  setExecutionMode: (mode) => set({ executionMode: mode }),

  setLoginRequired: (required, reason = null, url = null) =>
    set({
      loginRequired: required,
      loginReason: reason,
      loginUrl: url,
    }),

  setCurrentWorkflowId: (id) =>
    set({ currentWorkflowId: id }),

  setWebSocket: (ws) => set({ _ws: ws }),

  sendWS: (message) => {
    const ws = get()._ws
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message))
    } else {
      console.warn('[sendWS] WebSocket 未连接，无法发送消息:', message.type)
    }
  },

  reset: () => set({ executionState: initialExecutionState }),

  /**
   * 处理来自后端的WebSocket消息
   * 根据消息类型更新执行状态
   */
  handleMessage: (message: WSMessage) => {
    const { setNodeStatus, addNodeRecord, addLog, setScreenshot, setUserInputRequest } = get()

    switch (message.type) {
      case 'execution_started':
        set((state) => ({
          executionState: {
            ...state.executionState,
            isRunning: true,
            nodeStatuses: {},
            logs: [],
            nodeRecords: [],
          },
        }))
        break

      case 'node_start':
        set((state) => ({
          executionState: {
            ...state.executionState,
            currentNodeId: message.node_id as string,
          },
        }))
        setNodeStatus(message.node_id as string, 'running')
        break

      case 'node_complete': {
        const status: NodeStatus = message.success ? 'completed' : 'failed'
        const record = message.record as NodeExecutionRecord | undefined
        setNodeStatus(message.node_id as string, status)
        if (record) {
          addNodeRecord(record)
        }
        break
      }

      case 'screenshot':
        setScreenshot(message.data as string)
        break

      case 'user_input_required':
        setUserInputRequest(message as WSUserInputRequired)
        break

      case 'log':
        addLog(message as WSLog)
        break

      case 'execution_complete':
        set((state) => ({
          executionState: {
            ...state.executionState,
            isRunning: false,
            currentNodeId: null,
            userInputRequest: null,
          },
        }))
        break

      case 'execution_cancelled':
        set((state) => ({
          executionState: {
            ...state.executionState,
            isRunning: false,
            currentNodeId: null,
            userInputRequest: null,
          },
        }))
        break

      case 'error':
        addLog({
          type: 'log',
          level: 'error',
          message: message.message as string,
          timestamp: new Date().toISOString(),
        })
        set((state) => ({
          executionState: { ...state.executionState, isRunning: false },
        }))
        break

      case 'storage_state_update':
        if (message.data && get().currentWorkflowId) {
          const state = message.data as StorageState
          console.log(`[executionStore] 收到凭证更新: cookies=${state.cookies?.length || 0}, origins=${state.origins?.length || 0}`)
          credentialStore.save(get().currentWorkflowId!, state)
        }
        break

      case 'require_manual_login':
        set({
          loginRequired: true,
          loginReason: message.reason as string | null,
          loginUrl: message.url as string | null
        })
        break

      case 'login_confirmation_received':
        set({ loginRequired: false })
        break

      case 'debug_locator_result':
        if (typeof window !== 'undefined') {
          const event = new CustomEvent('debugLocatorResult', {
            detail: {
              nodeId: message.node_id,
              success: message.success,
              selector: message.selector,
              confidence: message.confidence,
              method: message.method,
              reasoning: message.reasoning,
              error: message.error,
            }
          })
          window.dispatchEvent(event)
        }
        break

      case 'selector_update': {
        // AI 定位成功后回填选择器到工作流节点并自动保存
        const nodeId = message.node_id as string
        const selector = message.selector as string
        if (nodeId && selector) {
          console.log(`[executionStore] 收到选择器更新: node=${nodeId}, selector=${selector}`)
          const workflowStore = useWorkflowStore.getState()
          const currentWorkflow = workflowStore.currentWorkflow
          if (currentWorkflow) {
            const updatedNodes = currentWorkflow.nodes.map(node =>
              node.id === nodeId
                ? { ...node, config: { ...node.config, selector } }
                : node
            )
            const updatedWorkflow = { 
              ...currentWorkflow, 
              nodes: updatedNodes,
              updated_at: new Date().toISOString()
            }
            
            // 更新前端状态
            useWorkflowStore.setState({ currentWorkflow: updatedWorkflow })
            
            // 自动保存到后端
            workflowApi.update(updatedWorkflow.id, updatedWorkflow)
              .then(() => {
                console.log(`[executionStore] 选择器已自动保存: node=${nodeId}`)
              })
              .catch((error) => {
                console.error(`[executionStore] 自动保存失败:`, error)
                toast.error('选择器回填保存失败')
              })
          }
        }
        break
      }
    }
  },
}))
