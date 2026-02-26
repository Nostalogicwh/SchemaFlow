/**
 * API 封装层
 * 统一封装 HTTP 请求，提供类型安全的 API 调用
 */
import axios from 'axios'
import type { Workflow, WorkflowListItem, ActionMetadata, ExecutionRecord, WorkflowNode, WorkflowEdge } from '@/types/workflow'

/** axios 实例配置 */
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * 工作流 API
 * 提供工作流的 CRUD 和执行操作
 */
export const workflowApi = {
  /**
   * 获取工作流列表
   * @returns 工作流列表项数组
   */
  list: async (): Promise<WorkflowListItem[]> => {
    const { data } = await api.get('/workflows')
    return data
  },

  /**
   * 获取工作流详情
   * @param id - 工作流ID
   * @returns 完整工作流对象
   */
  get: async (id: string): Promise<Workflow> => {
    const { data } = await api.get(`/workflows/${id}`)
    return data
  },

  /**
   * 创建工作流
   * @param workflow - 工作流数据（不含系统生成字段）
   * @returns 创建后的工作流对象
   */
  create: async (workflow: Omit<Workflow, 'id' | 'created_at' | 'updated_at'>): Promise<Workflow> => {
    const { data } = await api.post('/workflows', workflow)
    return data
  },

  /**
   * 更新工作流
   * @param id - 工作流ID
   * @param workflow - 要更新的字段
   * @returns 更新后的工作流对象
   */
  update: async (id: string, workflow: Partial<Workflow>): Promise<Workflow> => {
    const { data } = await api.put(`/workflows/${id}`, workflow)
    return data
  },

  /**
   * 删除工作流
   * @param id - 工作流ID
   */
  delete: async (id: string): Promise<void> => {
    await api.delete(`/workflows/${id}`)
  },

  /**
   * 执行工作流
   * @param id - 工作流ID
   * @returns 执行ID
   */
  execute: async (id: string): Promise<{ execution_id: string }> => {
    const { data } = await api.post(`/workflows/${id}/execute`)
    return data
  },

  /**
   * 停止执行
   * @param executionId - 执行ID
   */
  stop: async (executionId: string): Promise<void> => {
    await api.post(`/executions/${executionId}/stop`)
  },

  /**
   * 获取最近一次执行记录
   * @param id - 工作流ID
   * @returns 执行记录或 null
   */
  getLastExecution: async (id: string): Promise<{ execution: ExecutionRecord | null }> => {
    const { data } = await api.get(`/workflows/${id}/last-execution`)
    return data
  },
}

/**
 * 节点动作 API
 * 获取可用的节点动作类型
 */
export const actionApi = {
  /**
   * 获取所有节点动作元数据
   * @returns 动作元数据数组
   */
  list: async (): Promise<ActionMetadata[]> => {
    const { data } = await api.get('/actions')
    return data
  },
}

/**
 * AI 编排 API
 * 使用 AI 自动生成工作流
 */
export const aiApi = {
  /**
   * 根据自然语言描述生成工作流节点和连线
   * @param prompt - 自然语言描述
   * @returns 生成的节点和连线
   */
  generateWorkflow: async (prompt: string): Promise<{ nodes: WorkflowNode[]; edges: WorkflowEdge[] }> => {
    const { data } = await api.post('/ai/generate-workflow', { prompt }, { timeout: 600000 })
    return data
  },
}

export default api
