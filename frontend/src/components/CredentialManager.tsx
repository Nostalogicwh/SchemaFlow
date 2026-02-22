import { useState, useEffect } from 'react'
import { Trash2, CheckCircle, Circle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { credentialStore } from '@/services/credentialStore'

interface CredentialManagerProps {
  workflowId: string
  domain?: string
}

export function CredentialManager({ workflowId, domain = '目标网站' }: CredentialManagerProps) {
  const [hasCredential, setHasCredential] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkCredential()
  }, [workflowId])

  const checkCredential = async () => {
    const exists = await credentialStore.has(workflowId)
    setHasCredential(exists)
    setLoading(false)
  }

  const handleClear = async () => {
    if (confirm('清除后下次运行将需要重新登录，确认清除吗？')) {
      await credentialStore.remove(workflowId)
      setHasCredential(false)
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-500">加载中...</div>
  }

  return (
    <div className="p-4 border border-gray-200 rounded-lg bg-white">
      <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
        <span>🔐</span> 登录凭证
      </h3>

      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-2">
          {hasCredential ? (
            <>
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm text-gray-700">{domain} (已保存)</span>
            </>
          ) : (
            <>
              <Circle className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500">{domain} (无凭证)</span>
            </>
          )}
        </div>

        {hasCredential && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-red-500 hover:text-red-600"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-2">
        凭证仅保存在浏览器本地缓存中，服务端不予留存
      </p>
    </div>
  )
}
