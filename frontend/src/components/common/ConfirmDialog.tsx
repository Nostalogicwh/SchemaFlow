import { useUIStore } from '@/stores/uiStore'
import { useEffect, useRef } from 'react'

export function ConfirmDialog() {
  const confirmDialog = useUIStore((state) => state.confirmDialog)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (confirmDialog && confirmButtonRef.current) {
      // 自动聚焦确认按钮
      confirmButtonRef.current.focus()
    }
  }, [confirmDialog])

  if (!confirmDialog) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 animate-fade-in">
        <div className="p-4 border-b border-gray-200">
          <h3 id="confirm-title" className="font-bold text-gray-800">{confirmDialog.title}</h3>
        </div>
        <div className="p-4">
          <p id="confirm-message" className="text-sm text-gray-600">{confirmDialog.message}</p>
        </div>
        <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={confirmDialog.onCancel}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-label="取消操作"
          >
            取消
          </button>
          <button
            ref={confirmButtonRef}
            onClick={confirmDialog.onConfirm}
            className="px-4 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400"
            aria-label="确认操作"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  )
}
