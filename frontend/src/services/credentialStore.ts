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

// 按工作流 ID 存取凭证
export const credentialStore = {
  async get(workflowId: string): Promise<StorageState | null> {
    return store.getItem<StorageState>(`cred_${workflowId}`)
  },

  async save(workflowId: string, state: StorageState): Promise<void> {
    await store.setItem(`cred_${workflowId}`, state)
  },

  async remove(workflowId: string): Promise<void> {
    await store.removeItem(`cred_${workflowId}`)
  },

  async has(workflowId: string): Promise<boolean> {
    const val = await store.getItem(`cred_${workflowId}`)
    return val !== null
  },

  async clearAll(): Promise<void> {
    await store.clear()
  }
}
