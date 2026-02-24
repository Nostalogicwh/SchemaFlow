/**
 * Tag 组件 - 分类标签组件
 * 用于显示节点分类：browser / data / control / ai / base
 */
import { twColors } from '@/constants/designTokens'

export type TagCategory = 'browser' | 'data' | 'control' | 'ai' | 'base'

export interface TagProps {
  category: TagCategory
  children: React.ReactNode
  size?: 'sm' | 'md'
  className?: string
}

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-2.5 py-1 text-sm gap-1.5',
}

const categoryIcons: Record<TagCategory, React.ReactNode> = {
  browser: (
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
        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
      />
    </svg>
  ),
  data: (
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
        d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
      />
    </svg>
  ),
  control: (
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
        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
      />
    </svg>
  ),
  ai: (
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
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  ),
  base: (
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
        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
      />
    </svg>
  ),
}

export function Tag({ category, children, size = 'md', className = '' }: TagProps) {
  const colors = twColors.category[category]

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-md
        border
        ${colors.bg} ${colors.border} ${colors.text}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {categoryIcons[category]}
      {children}
    </span>
  )
}

// 分类色块（用于节点头部或其他紧凑位置）
export interface CategoryDotProps {
  category: TagCategory
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const dotSizeClasses = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4',
}

export function CategoryDot({
  category,
  size = 'md',
  className = '',
}: CategoryDotProps) {
  const colors = twColors.category[category]

  return (
    <span
      className={`
        inline-block rounded-full
        ${dotSizeClasses[size]}
        ${colors.accent}
        ${className}
      `}
    />
  )
}

export default Tag
