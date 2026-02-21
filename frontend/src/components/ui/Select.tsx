/** Select组件 - 统一的选择下拉框
 * 
 * 功能特性：
 * - 支持下拉选项
 * - 支持 placeholder
 * - 统一的箭头样式
 * - 支持 disabled
 */

import { forwardRef, useId } from 'react'
import { cn } from '@/utils'
import { ChevronDown } from 'lucide-react'

export interface SelectOption {
  /** 选项值 */
  value: string
  /** 选项标签 */
  label: string
  /** 是否禁用 */
  disabled?: boolean
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  /** 选项列表 */
  options: SelectOption[]
  /** placeholder文本 */
  placeholder?: string
  /** 错误提示文本 */
  error?: string
  /** 是否处于错误状态 */
  hasError?: boolean
  /** 值变化回调 */
  onChange?: (value: string) => void
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ 
    options,
    placeholder,
    error,
    hasError,
    value,
    onChange,
    className,
    disabled,
    ...props 
  }, ref) => {
    const id = useId()
    const showError = hasError !== undefined ? hasError : !!error

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange?.(e.target.value)
    }

    return (
      <div className="relative w-full">
        {/* 选择框主体 */}
        <div className="relative">
          <select
            ref={ref}
            id={id}
            value={value}
            onChange={handleChange}
            disabled={disabled}
            className={cn(
              // 基础样式
              'w-full px-3 py-2 pr-10',
              'bg-white text-neutral-900 text-sm',
              'border rounded-md',
              'appearance-none',
              'transition-all duration-150 ease-out',
              
              // 边框样式
              showError 
                ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                : 'border-neutral-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
              
              // 禁用状态
              disabled && 'bg-neutral-50 text-neutral-400 cursor-not-allowed',
              
              // 占位符样式
              (!value || value === '') && 'text-neutral-400',
              
              // 自定义类名
              className
            )}
            {...props}
          >
            {/* placeholder选项 */}
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            
            {/* 选项列表 */}
            {options.map((option) => (
              <option 
                key={option.value} 
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))}
          </select>

          {/* 下拉箭头图标 */}
          <div 
            className={cn(
              'absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none',
              'transition-colors duration-150',
              disabled ? 'text-neutral-300' : 'text-neutral-500'
            )}
          >
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <p className="mt-1 text-xs text-red-600">{error}</p>
        )}
      </div>
    )
  }
)

Select.displayName = 'Select'

export default Select
