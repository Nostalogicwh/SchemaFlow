/** FormField组件 - 表单字段容器
 * 
 * 功能特性：
 * - Label + 输入组件 + 错误提示的统一容器
 * - 支持 label、required、error、helpText
 * - 自动关联 htmlFor 和 id
 * - 统一布局（label在上或左）
 */

import { useId, cloneElement, isValidElement, ReactElement } from 'react'
import { cn } from '@/utils'

export type LabelPosition = 'top' | 'left'

export interface FormFieldProps {
  /** 字段标签 */
  label?: string
  /** 是否必填 */
  required?: boolean
  /** 错误提示文本 */
  error?: string
  /** 帮助文本 */
  helpText?: string
  /** 标签位置 */
  labelPosition?: LabelPosition
  /** 标签宽度（labelPosition为left时有效） */
  labelWidth?: number | string
  /** 子元素（输入组件） */
  children: ReactElement
  /** 自定义类名 */
  className?: string
  /** 标签自定义类名 */
  labelClassName?: string
}

export function FormField({
  label,
  required = false,
  error,
  helpText,
  labelPosition = 'top',
  labelWidth = 120,
  children,
  className,
  labelClassName,
}: FormFieldProps) {
  const fieldId = useId()
  const showError = !!error

  // 给子元素注入id和error状态
  const childWithProps = isValidElement(children)
    ? cloneElement(children, {
        id: fieldId,
        hasError: showError,
        // 保留子元素原有的onChange等属性
        ...(children.props as object),
      } as Record<string, unknown>)
    : children

  return (
    <div
      className={cn(
        // 基础布局
        labelPosition === 'left' 
          ? 'flex items-start gap-4' 
          : 'flex flex-col gap-1.5',
        className
      )}
    >
      {/* 标签区域 */}
      {label && (
        <label
          htmlFor={fieldId}
          className={cn(
            // 基础样式
            'text-xs font-medium leading-5',
            'text-neutral-700',
            'flex items-center',
            
            // 布局样式
            labelPosition === 'left' && 'flex-shrink-0 pt-2',
            
            // 自定义类名
            labelClassName
          )}
          style={labelPosition === 'left' ? { width: labelWidth, minWidth: labelWidth } : undefined}
        >
          {label}
          {required && (
            <span className="text-red-500 ml-1">*</span>
          )}
        </label>
      )}

      {/* 输入区域 */}
      <div className="flex-1">
        {childWithProps}
        
        {/* 帮助文本 */}
        {helpText && !error && (
          <p className="mt-1 text-xs text-neutral-500">{helpText}</p>
        )}
        
        {/* 错误提示 */}
        {error && (
          <p className="mt-1 text-xs text-red-600">{error}</p>
        )}
      </div>
    </div>
  )
}

export default FormField
