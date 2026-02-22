/**
 * 工作流相关类型定义
 */

// 节点状态
export type NodeStatus = 'idle' | 'running' | 'completed' | 'failed'

// 节点分类
export type NodeCategory = 'base' | 'browser' | 'data' | 'control'

// 节点元数据（从后端 /api/actions 获取）
export interface ActionMetadata {
  name: string           // 节点唯一标识
  label: string          // 前端显示标签
  description: string    // 功能描述
  category: NodeCategory // 分类
  parameters: JsonSchema // 参数 JSON Schema
  inputs: string[]       // 输入端口
  outputs: string[]      // 输出端口
}

// JSON Schema 类型
export interface JsonSchema {
  type: string
  properties?: Record<string, JsonSchemaProperty>
  required?: string[]
}

export interface JsonSchemaProperty {
  type: string
  description?: string
  default?: unknown
  enum?: string[]
}

// 工作流节点
export interface WorkflowNode {
  id: string
  type: string
  label?: string
  config: Record<string, unknown>
  position?: { x: number; y: number }
  meta?: {
    generated_by?: 'manual' | 'ai' | 'recorded'
    original_prompt?: string
    recorded_from?: string
  }
}

// 工作流边（连线）
export interface WorkflowEdge {
  source: string
  target: string
}

// 工作流定义
export interface Workflow {
  id: string
  name: string
  description?: string
  version?: string
  created_at?: string
  updated_at?: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

// 工作流列表项
export interface WorkflowListItem {
  id: string
  name: string
  description?: string
  created_at?: string
  updated_at?: string
}

// WebSocket 消息类型
export type WSMessageType =
  | 'start_execution'
  | 'stop_execution'
  | 'user_input_response'
  | 'login_confirmed'
  | 'execution_started'
  | 'node_start'
  | 'node_complete'
  | 'screenshot'
  | 'user_input_required'
  | 'execution_complete'
  | 'error'
  | 'log'
  | 'storage_state_update'
  | 'require_manual_login'
  | 'login_confirmation_received'

// WebSocket 消息基础结构
export interface WSMessage {
  type: WSMessageType
  [key: string]: unknown
}

// 执行开始消息
export interface WSExecutionStarted extends WSMessage {
  type: 'execution_started'
  execution_id: string
  workflow_id: string
}

// 节点开始消息
export interface WSNodeStart extends WSMessage {
  type: 'node_start'
  node_id: string
  node_type: string
}

// 节点完成消息
export interface WSNodeComplete extends WSMessage {
  type: 'node_complete'
  node_id: string
  success: boolean
  result?: unknown
  error?: string
}

// 截图消息
export interface WSScreenshot extends WSMessage {
  type: 'screenshot'
  data: string  // base64
  timestamp: string
}

// 用户输入请求消息
export interface WSUserInputRequired extends WSMessage {
  type: 'user_input_required'
  node_id: string
  prompt: string
  timeout: number
}

// 执行完成消息
export interface WSExecutionComplete extends WSMessage {
  type: 'execution_complete'
  success: boolean
  duration?: number
  error?: string
}

// 日志消息
export interface WSLog extends WSMessage {
  type: 'log'
  level: 'info' | 'warning' | 'error'
  message: string
  timestamp: string
}

// 执行状态
export interface ExecutionState {
  executionId: string | null
  isRunning: boolean
  currentNodeId: string | null
  nodeStatuses: Record<string, NodeStatus>
  logs: WSLog[]
  screenshot: string | null
  userInputRequest: WSUserInputRequired | null
  nodeRecords: NodeExecutionRecord[]
}

// 节点执行记录
export interface NodeExecutionRecord {
  node_id: string
  node_type: string
  node_label: string
  status: string
  started_at: string | null
  finished_at: string | null
  duration_ms: number | null
  result: Record<string, unknown> | null
  error: string | null
  screenshot_base64: string | null
  logs: { timestamp: string; level: string; message: string }[]
}

// 执行记录（持久化）
export interface ExecutionRecord {
  execution_id: string
  workflow_id: string
  status: string
  started_at: string | null
  finished_at: string | null
  duration_ms: number | null
  total_nodes: number
  completed_nodes: number
  failed_nodes: number
  node_records: NodeExecutionRecord[]
}
