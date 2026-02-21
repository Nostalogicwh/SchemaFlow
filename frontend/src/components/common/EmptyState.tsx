import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export interface EmptyStateProps {
  /**
   * 图标组件（Lucide图标）
   */
  icon?: LucideIcon
  /**
   * 图标类名
   */
  iconClassName?: string
  /**
   * 标题
   */
  title: string
  /**
   * 描述文本
   */
  description?: string
  /**
   * 操作按钮配置
   */
  action?: {
    label: string
    onClick: () => void
    variant?: 'primary' | 'secondary' | 'ghost'
  }
  /**
   * 紧凑模式（减少内边距）
   */
  compact?: boolean
  /**
   * 自定义类名
   */
  className?: string
}

/**
 * EmptyState 空状态组件
 *
 * 用于显示页面或面板的空状态提示
 *
 * @example
 * // 基础用法
 * <EmptyState
 *   icon={Inbox}
 *   title="暂无数据"
 *   description="当前没有可显示的内容"
 * />
 *
 * @example
 * // 带操作按钮
 * <EmptyState
 *   icon={Plus}
 *   title="创建第一个工作流"
 *   description="开始构建您的自动化流程"
 *   action={{ label: "创建工作流", onClick: handleCreate }}
 * />
 *
 * @example
 * // 紧凑模式
 * <EmptyState
 *   icon={FileX}
 *   title="未选择节点"
 *   compact
 * />
 */
export function EmptyState({
  icon: Icon,
  iconClassName,
  title,
  description,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={[
        'flex flex-col items-center justify-center text-center',
        'transition-all duration-300 ease-out animate-fade-in',
        compact ? 'p-4' : 'p-8',
        className,
      ].join(' ')}
    >
      {Icon && (
        <div
          className={[
            'flex items-center justify-center rounded-full bg-neutral-100',
            'transition-all duration-200 ease-out',
            compact ? 'w-12 h-12 mb-3' : 'w-16 h-16 mb-4',
            iconClassName,
          ].join(' ')}
        >
          <Icon
            className={[
              'text-neutral-400',
              compact ? 'w-6 h-6' : 'w-8 h-8',
            ].join(' ')}
          />
        </div>
      )}

      <h3
        className={[
          'font-semibold text-neutral-900',
          'transition-colors duration-150',
          compact ? 'text-sm' : 'text-base',
        ].join(' ')}
      >
        {title}
      </h3>

      {description && (
        <p
          className={[
            'text-neutral-500',
            'transition-colors duration-150',
            compact ? 'mt-1 text-xs' : 'mt-2 text-sm',
          ].join(' ')}
        >
          {description}
        </p>
      )}

      {action && (
        <div className={compact ? 'mt-3' : 'mt-5'}>
          <Button
            onClick={action.onClick}
            variant={action.variant ?? 'primary'}
            size={compact ? 'sm' : 'md'}
          >
            {action.label}
          </Button>
        </div>
      )}
    </div>
  )
}
