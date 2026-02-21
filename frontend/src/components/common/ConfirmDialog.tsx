import { useUIStore } from '@/stores/uiStore'

export function ConfirmDialog() {
  const confirmDialog = useUIStore((state) => state.confirmDialog)

  if (!confirmDialog) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 animate-fade-in">
        <div className="p-4 border-b">
          <h3 className="font-bold text-gray-800">{confirmDialog.title}</h3>
        </div>
        <div className="p-4">
          <p className="text-sm text-gray-600">{confirmDialog.message}</p>
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button
            onClick={confirmDialog.onCancel}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
          >
            取消
          </button>
          <button
            onClick={confirmDialog.onConfirm}
            className="px-4 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  )
}
