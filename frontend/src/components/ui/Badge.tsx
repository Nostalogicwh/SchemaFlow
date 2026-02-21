/**
 * Badge 组件 - 状态标识组件
 * 用于显示节点执行状态：running / completed / failed / pending
 */
import { twColors } from '@/constants/designTokens'

export type BadgeStatus = 'running' | 'completed' | 'failed' | 'pending'

export interface BadgeProps {
  status: BadgeStatus
  size?: 'sm' | 'md'
  className?: string
}

const statusConfig: Record<
  BadgeStatus,
  {
    label: string
    bgClass: string
    textClass: string
    icon: React.ReactNode
    animate?: string
  }
> = {
  running: {
    label: '执行中',
    bgClass: twColors.status.info.bg,
    textClass: twColors.status.info.text,
    animate: 'animate-pulse',
    icon: (
      <svg
        className="w-3 h-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
    ),
  },
  completed: {
    label: '已完成',
    bgClass: twColors.status.success.bg,
    textClass: twColors.status.success.text,
    icon: (
      <svg
        className="w-3 h-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={3}
          d="M5 13l4 4L19 7"
        />
      </svg>
    ),
  },
  failed: {
    label: '失败',
    bgClass: twColors.status.error.bg,
    textClass: twColors.status.error.text,
    icon: (
      <svg
        className="w-3 h-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={3}
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    ),
  },
  pending: {
    label: '等待中',
    bgClass: 'bg-gray-100',
    textClass: 'text-gray-600',
    icon: (
      <svg
        className="w-3 h-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
}

const sizeClasses = {
  sm: {
    wrapper: 'px-2 py-0.5 text-xs gap-1',
    dot: 'w-1.5 h-1.5',
  },
  md: {
    wrapper: 'px-2.5 py-1 text-sm gap-1.5',
    dot: 'w-2 h-2',
  },
}

export function Badge({ status, size = 'md', className = '' }: BadgeProps) {
  const config = statusConfig[status]
  const sizeClass = sizeClasses[size]

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full
        ${config.bgClass} ${config.textClass} ${sizeClass.wrapper}
        ${config.animate || ''}
        ${className}
      `}
    >
      <span className={`flex-shrink-0 ${config.animate || ''}`}>
        {config.icon}
      </span>
      {config.label}
    </span>
  )
}

// 简化版圆点徽章（用于紧凑空间）
export interface DotBadgeProps {
  status: BadgeStatus
  size?: 'sm' | 'md'
  className?: string
}

export function DotBadge({ status, size = 'md', className = '' }: DotBadgeProps) {
  const config = statusConfig[status]
  const sizeClass = sizeClasses[size]

  return (
    <span
      className={`
        inline-block rounded-full
        ${sizeClass.dot}
        ${config.animate || ''}
        ${className}
      `}
      style={{
        backgroundColor:
          status === 'running'
            ? '#3B82F6'
            : status === 'completed'
            ? '#22C55E'
            : status === 'failed'
            ? '#EF4444'
            : '#6B7280',
      }}
    />
  )
}

export default Badge
