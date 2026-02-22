import { create } from 'zustand'
import { credentialStore, type StorageState } from '@/services/credentialStore'
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
  // 新增：登录态相关状态
  loginRequired: boolean
  loginReason: string | null
  loginUrl: string | null
  currentWorkflowId: string | null
  // 新增：视图模式
  viewMode: 'debug' | 'compact'
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
  // 新增
  setLoginRequired: (required: boolean, reason?: string | null, url?: string | null) => void
  setCurrentWorkflowId: (id: string | null) => void
  setViewMode: (mode: 'debug' | 'compact') => void
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
  // 新增
  loginRequired: false,
  loginReason: null,
  loginUrl: null,
  currentWorkflowId: null,
  viewMode: 'debug',  // 默认调试模式

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

  setViewMode: (mode) => set({ viewMode: mode }),

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
        // 保存后端下发的最新凭证
        if (message.data && get().currentWorkflowId) {
          credentialStore.save(get().currentWorkflowId!, message.data as StorageState)
        }
        break

      case 'require_manual_login':
        // 设置状态，触发 UI 显示人机协同面板
        set({
          loginRequired: true,
          loginReason: message.reason as string | null,
          loginUrl: message.url as string | null
        })
        break

      case 'login_confirmation_received':
        // 登录确认已收到，可以隐藏登录面板
        set({ loginRequired: false })
        break
    }
  },
}))
