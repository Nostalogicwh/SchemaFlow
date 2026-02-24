import localforage from 'localforage'

const store = localforage.createInstance({
  name: 'schemaflow',
  storeName: 'credentials'
})

export interface StorageState {
  cookies: Array<{
    name: string
    value: string
    domain: string
    path: string
    expires: number
    httpOnly: boolean
    secure: boolean
    sameSite: string
  }>
  origins: Array<{
    origin: string
    localStorage: Array<{ name: string; value: string }>
  }>
}

export const credentialStore = {
  async get(workflowId: string): Promise<StorageState | null> {
    const val = await store.getItem<StorageState>(`cred_${workflowId}`)
    if (val) {
      console.log(`[credentialStore] 读取凭证: workflow=${workflowId}, cookies=${val.cookies?.length || 0}, origins=${val.origins?.length || 0}`)
    } else {
      console.log(`[credentialStore] 无历史凭证: workflow=${workflowId}`)
    }
    return val
  },

  async save(workflowId: string, state: StorageState): Promise<void> {
    await store.setItem(`cred_${workflowId}`, state)
    console.log(`[credentialStore] 保存凭证: workflow=${workflowId}, cookies=${state.cookies?.length || 0}, origins=${state.origins?.length || 0}`)
  },

  async remove(workflowId: string): Promise<void> {
    await store.removeItem(`cred_${workflowId}`)
    console.log(`[credentialStore] 删除凭证: workflow=${workflowId}`)
  },

  async has(workflowId: string): Promise<boolean> {
    const val = await store.getItem(`cred_${workflowId}`)
    return val !== null
  },

  async clearAll(): Promise<void> {
    await store.clear()
    console.log(`[credentialStore] 清空所有凭证`)
  }
}
