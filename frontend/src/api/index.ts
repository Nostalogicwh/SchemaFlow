/**
 * API 封装层
 */
import axios from 'axios'
import type { Workflow, WorkflowListItem, ActionMetadata } from '@/types/workflow'

// axios 实例
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 工作流 API
export const workflowApi = {
  // 获取工作流列表
  list: async (): Promise<WorkflowListItem[]> => {
    const { data } = await api.get('/workflows')
    return data
  },

  // 获取工作流详情
  get: async (id: string): Promise<Workflow> => {
    const { data } = await api.get(`/workflows/${id}`)
    return data
  },

  // 创建工作流
  create: async (workflow: Omit<Workflow, 'id' | 'created_at' | 'updated_at'>): Promise<Workflow> => {
    const { data } = await api.post('/workflows', workflow)
    return data
  },

  // 更新工作流
  update: async (id: string, workflow: Partial<Workflow>): Promise<Workflow> => {
    const { data } = await api.put(`/workflows/${id}`, workflow)
    return data
  },

  // 删除工作流
  delete: async (id: string): Promise<void> => {
    await api.delete(`/workflows/${id}`)
  },

  // 执行工作流
  execute: async (id: string): Promise<{ execution_id: string }> => {
    const { data } = await api.post(`/workflows/${id}/execute`)
    return data
  },

  // 停止执行
  stop: async (executionId: string): Promise<void> => {
    await api.post(`/executions/${executionId}/stop`)
  },
}

// 节点 API
export const actionApi = {
  // 获取所有节点元数据
  list: async (): Promise<ActionMetadata[]> => {
    const { data } = await api.get('/actions')
    return data
  },
}

// AI 生成 API（预留）
export const aiApi = {
  // 生成工作流
  generate: async (prompt: string): Promise<Workflow> => {
    const { data } = await api.post('/ai/generate', { prompt })
    return data
  },
}

export default api
