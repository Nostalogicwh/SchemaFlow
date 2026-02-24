interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  label?: string
  fullScreen?: boolean
}

export function LoadingSpinner({ size = 'md', label, fullScreen = false }: LoadingSpinnerProps) {
  const sizeMap = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  }

  const spinner = (
    <div className="flex items-center justify-center">
      <div
        className={`${sizeMap[size]} border-gray-200 border-t-blue-500 rounded-full animate-spin`}
      />
      {label && <span className="ml-2 text-sm text-gray-500">{label}</span>}
    </div>
  )

  if (fullScreen) {
    return <div className="w-full h-full flex items-center justify-center">{spinner}</div>
  }

  return spinner
}
