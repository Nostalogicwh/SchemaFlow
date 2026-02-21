import { cn } from '@/utils'

export type SkeletonVariant = 'text' | 'circle' | 'rect'

export interface SkeletonProps {
  /**
   * 骨架屏变体类型
   * @default 'text'
   */
  variant?: SkeletonVariant
  /**
   * 宽度，可以是数字（px）或字符串（CSS值）
   */
  width?: string | number
  /**
   * 高度，可以是数字（px）或字符串（CSS值）
   */
  height?: string | number
  /**
   * 自定义类名
   */
  className?: string
  /**
   * 动画效果
   * @default 'pulse'
   */
  animation?: 'pulse' | 'shimmer' | 'none'
  /**
   * 行数（仅variant为text时有效）
   * @default 1
   */
  lines?: number
}

/**
 * Skeleton 骨架屏组件
 *
 * 用于在数据加载时显示占位符，提供流畅的加载体验
 *
 * @example
 * // 文本行
 * <Skeleton />
 *
 * @example
 * // 圆形头像
 * <Skeleton variant="circle" width={40} height={40} />
 *
 * @example
 * // 矩形图片
 * <Skeleton variant="rect" width="100%" height={200} />
 *
 * @example
 * // 多行文本
 * <Skeleton variant="text" lines={3} />
 *
 * @example
 * // 闪烁动画
 * <Skeleton variant="rect" width={200} height={100} animation="shimmer" />
 */
export function Skeleton({
  variant = 'text',
  width,
  height,
  className,
  animation = 'pulse',
  lines = 1,
}: SkeletonProps) {
  const getWidthStyle = (): React.CSSProperties['width'] => {
    if (width === undefined) return undefined
    return typeof width === 'number' ? `${width}px` : width
  }

  const getHeightStyle = (): React.CSSProperties['height'] => {
    if (height === undefined) return undefined
    return typeof height === 'number' ? `${height}px` : height
  }

  const baseClasses = cn(
    'bg-neutral-200',
    animation === 'pulse' && 'animate-pulse',
    animation === 'shimmer' && 'animate-shimmer',
    className
  )

  const variantClasses: Record<SkeletonVariant, string> = {
    text: 'rounded',
    circle: 'rounded-full',
    rect: 'rounded-md',
  }

  const renderSkeleton = () => (
    <div
      className={cn(baseClasses, variantClasses[variant])}
      style={{
        width: getWidthStyle(),
        height: getHeightStyle(),
      }}
    />
  )

  if (variant === 'text' && lines > 1) {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={cn(
              baseClasses,
              variantClasses[variant],
              // 最后一行宽度稍短，模拟真实文本效果
              index === lines - 1 && lines > 1 && 'w-4/5'
            )}
            style={{
              width: getWidthStyle(),
              height: height ?? 16,
            }}
          />
        ))}
      </div>
    )
  }

  return renderSkeleton()
}

/**
 * 骨架屏卡片容器
 * 用于创建包含多个骨架屏元素的布局
 */
export interface SkeletonCardProps {
  /**
   * 子元素
   */
  children: React.ReactNode
  /**
   * 自定义类名
   */
  className?: string
  /**
   * 动画效果
   * @default 'pulse'
   */
  animation?: 'pulse' | 'shimmer' | 'none'
}

export function SkeletonCard({
  children,
  className,
  animation = 'pulse',
}: SkeletonCardProps) {
  return (
    <div
      className={cn(
        'p-4 bg-white border border-neutral-200 rounded-lg',
        animation === 'pulse' && 'animate-pulse',
        animation === 'shimmer' && 'animate-shimmer',
        className
      )}
    >
      {children}
    </div>
  )
}

/**
 * 预设的骨架屏列表项组件
 * 用于快速创建列表加载效果
 */
export interface SkeletonListItemProps {
  /**
   * 是否显示头像
   * @default true
   */
  hasAvatar?: boolean
  /**
   * 是否显示副标题
   * @default true
   */
  hasSubtitle?: boolean
  /**
   * 是否显示右侧内容
   * @default false
   */
  hasAction?: boolean
  /**
   * 自定义类名
   */
  className?: string
  /**
   * 动画效果
   * @default 'pulse'
   */
  animation?: 'pulse' | 'shimmer' | 'none'
}

export function SkeletonListItem({
  hasAvatar = true,
  hasSubtitle = true,
  hasAction = false,
  className,
  animation = 'pulse',
}: SkeletonListItemProps) {
  const itemClass = cn(
    'flex items-center gap-3 p-3',
    animation === 'pulse' && 'animate-pulse',
    className
  )

  return (
    <div className={itemClass}>
      {hasAvatar && (
        <Skeleton variant="circle" width={40} height={40} animation="none" />
      )}
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton variant="text" width="60%" height={16} animation="none" />
        {hasSubtitle && (
          <Skeleton variant="text" width="40%" height={12} animation="none" />
        )}
      </div>
      {hasAction && (
        <Skeleton variant="rect" width={24} height={24} animation="none" />
      )}
    </div>
  )
}

/**
 * 预设的骨架屏表格组件
 * 用于快速创建表格加载效果
 */
export interface SkeletonTableProps {
  /**
   * 行数
   * @default 5
   */
  rows?: number
  /**
   * 列数
   * @default 4
   */
  columns?: number
  /**
   * 是否显示表头
   * @default true
   */
  hasHeader?: boolean
  /**
   * 自定义类名
   */
  className?: string
  /**
   * 动画效果
   * @default 'pulse'
   */
  animation?: 'pulse' | 'shimmer' | 'none'
}

export function SkeletonTable({
  rows = 5,
  columns = 4,
  hasHeader = true,
  className,
  animation = 'pulse',
}: SkeletonTableProps) {
  const tableClass = cn(
    'w-full',
    animation === 'pulse' && 'animate-pulse',
    className
  )

  return (
    <div className={tableClass}>
      {hasHeader && (
        <div className="flex gap-4 pb-3 border-b border-neutral-200">
          {Array.from({ length: columns }).map((_, index) => (
            <div key={index} className="flex-1">
              <Skeleton variant="text" width="80%" height={16} animation="none" />
            </div>
          ))}
        </div>
      )}
      <div className="space-y-3 pt-3">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex gap-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div key={colIndex} className="flex-1">
                <Skeleton
                  variant="text"
                  width={`${60 + Math.random() * 40}%`}
                  height={14}
                  animation="none"
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default Skeleton
