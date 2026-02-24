import { create } from 'zustand'
import { credentialStore, type StorageState } from '@/services/credentialStore'
import { useWorkflowStore } from './workflowStore'
import type {
  ExecutionState,
  NodeStatus,
  NodeExecutionRecord,
  WSMessage,
  WSLog,
  WSUserInputRequired,
} from '@/types/workflow'

interface ExecutionStoreState {
  isConnected: boolean
  executionState: ExecutionState
  showPanel: boolean
  executionMode: 'headless' | 'headed'
  loginRequired: boolean
  loginReason: string | null
  loginUrl: string | null
  currentWorkflowId: string | null
  _ws: WebSocket | null
}

interface ExecutionStoreActions {
  setConnected: (connected: boolean) => void
  setExecutionId: (id: string | null) => void
  setRunning: (running: boolean) => void
  setNodeStatus: (nodeId: string, status: NodeStatus) => void
  addLog: (log: WSLog) => void
  setScreenshot: (screenshot: string | null) => void
  setUserInputRequest: (request: WSUserInputRequired | null) => void
  addNodeRecord: (record: NodeExecutionRecord) => void
  setShowPanel: (show: boolean) => void
  setExecutionMode: (mode: 'headless' | 'headed') => void
  reset: () => void
  handleMessage: (message: WSMessage) => void
  setLoginRequired: (required: boolean, reason?: string | null, url?: string | null) => void
  setCurrentWorkflowId: (id: string | null) => void
  setWebSocket: (ws: WebSocket | null) => void
  sendWS: (message: WSMessage) => void
}

type ExecutionStore = ExecutionStoreState & ExecutionStoreActions

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

      case 'selector_update':
        // AI 定位成功后回填选择器到工作流节点
        {
          const nodeId = message.node_id as string
          const selector = message.selector as string
          if (nodeId && selector) {
            console.log(`[executionStore] 收到选择器更新: node=${nodeId}, selector=${selector}`)
            // 更新 workflowStore 中的 currentWorkflow
            const workflowStore = useWorkflowStore.getState()
            const currentWorkflow = workflowStore.currentWorkflow
            if (currentWorkflow) {
              const updatedNodes = currentWorkflow.nodes.map(node =>
                node.id === nodeId
                  ? { ...node, config: { ...node.config, selector } }
                  : node
              )
              const updatedWorkflow = { ...currentWorkflow, nodes: updatedNodes }
              // 更新 currentWorkflow（不自动保存，让用户手动保存）
              useWorkflowStore.setState({ currentWorkflow: updatedWorkflow })
              console.log(`[executionStore] 节点 ${nodeId} 的选择器已更新: ${selector}`)
            }
          }
        }
        break
    }
  },
}))
