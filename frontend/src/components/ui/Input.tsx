/** Input组件 - 统一的文本输入框
 * 
 * 功能特性：
 * - 支持多种类型: text | number | password | email
 * - 支持前缀图标
 * - 支持清除按钮
 * - 支持错误状态
 * - 统一的focus状态(ring效果)
 */

import { forwardRef, useState } from 'react'
import { cn } from '@/utils'
import { X, type LucideIcon } from 'lucide-react'

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** 输入框类型 */
  type?: 'text' | 'number' | 'password' | 'email'
  /** 前缀图标组件 */
  prefixIcon?: LucideIcon
  /** 是否显示清除按钮 */
  clearable?: boolean
  /** 错误提示文本 */
  error?: string
  /** 是否处于错误状态 */
  hasError?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ 
    type = 'text', 
    prefixIcon: PrefixIcon, 
    clearable = false, 
    error,
    hasError,
    value,
    onChange,
    className,
    disabled,
    ...props 
  }, ref) => {
    const [internalValue, setInternalValue] = useState('')
    const isControlled = value !== undefined
    const currentValue = isControlled ? value : internalValue
    const showError = hasError !== undefined ? hasError : !!error

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isControlled) {
        setInternalValue(e.target.value)
      }
      onChange?.(e)
    }

    const handleClear = () => {
      if (!isControlled) {
        setInternalValue('')
      }
      // 触发一个change事件来通知父组件
      const event = {
        target: { value: '' }
      } as React.ChangeEvent<HTMLInputElement>
      onChange?.(event)
    }

    const hasValue = currentValue !== '' && currentValue !== undefined && currentValue !== null

    return (
      <div className="relative w-full">
        {/* 前缀图标 */}
        {PrefixIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <PrefixIcon className="w-4 h-4 text-neutral-400" />
          </div>
        )}

        {/* 输入框主体 */}
        <input
          ref={ref}
          type={type}
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
            
            // 前缀图标时的左内边距
            PrefixIcon && 'pl-10',
            
            // 清除按钮时的右内边距
            clearable && 'pr-9',
            
            // 禁用状态
            disabled && 'bg-neutral-50 text-neutral-400 cursor-not-allowed',
            
            // 占位符样式
            'placeholder:text-neutral-400',
            
            // 自定义类名
            className
          )}
          {...props}
        />

        {/* 清除按钮 */}
        {clearable && hasValue && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className={cn(
              'absolute right-3 top-1/2 -translate-y-1/2',
              'p-0.5 rounded-full',
              'text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100',
              'transition-colors duration-150',
              'focus:outline-none focus:ring-2 focus:ring-blue-500/20'
            )}
            tabIndex={-1}
            aria-label="清除"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* 错误提示 */}
        {error && (
          <p className="mt-1 text-xs text-red-600">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input
