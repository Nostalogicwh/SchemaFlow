import { useUIStore } from '@/stores/uiStore'

const typeStyles = {
  success: 'bg-green-500 text-white',
  error: 'bg-red-500 text-white',
  info: 'bg-blue-500 text-white',
}

const typeIcons = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
}

export function Toast() {
  const toasts = useUIStore((state) => state.toasts)
  const removeToast = useUIStore((state) => state.removeToast)

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 max-w-[90vw]">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 min-w-[200px] max-w-md
            animate-slide-in ${typeStyles[toast.type]}
          `}
        >
          <span className="font-bold">{typeIcons[toast.type]}</span>
          <span className="flex-1 text-sm">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="opacity-70 hover:opacity-100 text-sm focus:outline-none focus:ring-2 focus:ring-white/50 rounded"
            aria-label="关闭通知"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
