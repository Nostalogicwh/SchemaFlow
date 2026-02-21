/** Textarea组件 - 统一的多行文本输入框
 * 
 * 功能特性：
 * - 支持 rows 配置
 * - 统一的resize行为（只允许垂直resize）
 * - 支持 autoResize（自动根据内容调整高度）
 */

import { forwardRef, useEffect, useRef, useState } from 'react'
import { cn } from '@/utils'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** 行数 */
  rows?: number
  /** 错误提示文本 */
  error?: string
  /** 是否处于错误状态 */
  hasError?: boolean
  /** 是否自动调整高度 */
  autoResize?: boolean
  /** 最小行数（autoResize时有效） */
  minRows?: number
  /** 最大行数（autoResize时有效） */
  maxRows?: number
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ 
    rows = 4,
    error,
    hasError,
    autoResize = false,
    minRows = 3,
    maxRows = 10,
    value,
    onChange,
    className,
    disabled,
    style,
    ...props 
  }, ref) => {
    const internalRef = useRef<HTMLTextAreaElement>(null)
    const textareaRef = (ref as React.RefObject<HTMLTextAreaElement>) || internalRef
    const [internalValue, setInternalValue] = useState('')
    const isControlled = value !== undefined
    const currentValue = isControlled ? value : internalValue
    const showError = hasError !== undefined ? hasError : !!error

    // 自动调整高度
    useEffect(() => {
      if (autoResize && textareaRef.current) {
        const textarea = textareaRef.current
        
        // 重置高度以获取准确的scrollHeight
        textarea.style.height = 'auto'
        
        // 计算行高
        const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 22
        const minHeight = minRows * lineHeight
        const maxHeight = maxRows * lineHeight
        
        // 设置新高度
        const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight)
        textarea.style.height = `${newHeight}px`
      }
    }, [currentValue, autoResize, minRows, maxRows])

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!isControlled) {
        setInternalValue(e.target.value)
      }
      onChange?.(e)
    }

    return (
      <div className="relative w-full">
        {/* 文本域主体 */}
        <textarea
          ref={textareaRef}
          rows={autoResize ? minRows : rows}
          value={currentValue}
          onChange={handleChange}
          disabled={disabled}
          className={cn(
            // 基础样式
            'w-full px-3 py-2',
            'bg-white text-neutral-900 text-sm',
            'border rounded-md',
            'transition-all duration-150 ease-out',
            
            // 边框样式
            showError 
              ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
              : 'border-neutral-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
            
            // 禁用状态
            disabled && 'bg-neutral-50 text-neutral-400 cursor-not-allowed',
            
            // resize行为 - 只允许垂直调整
            'resize-y',
            
            // 占位符样式
            'placeholder:text-neutral-400',
            
            // 自定义类名
            className
          )}
          style={{
            ...style,
            ...(autoResize && { overflow: 'hidden' })
          }}
          {...props}
        />

        {/* 错误提示 */}
        {error && (
          <p className="mt-1 text-xs text-red-600">{error}</p>
        )}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'

export default Textarea
