import { create } from 'zustand'
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
    }
  },
}))
