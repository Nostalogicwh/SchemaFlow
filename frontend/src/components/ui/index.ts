/** UI组件库导出文件
 * 
 * 统一导出所有表单组件
 * 
 * 使用示例:
 * ```tsx
 * import { Input, Select, Textarea, FormField } from '@/components/ui'
 * ```
 */

export { Input, type InputProps } from './Input'
export { Select, type SelectProps, type SelectOption } from './Select'
export { Textarea, type TextareaProps } from './Textarea'
export { FormField, type FormFieldProps, type LabelPosition } from './FormField'

// P3 - Modal + Badge + Tag 组件
export { Modal, type ModalProps } from './Modal'
export { Badge, DotBadge, type BadgeProps, type BadgeStatus, type DotBadgeProps } from './Badge'
export { Tag, CategoryDot, type TagProps, type TagCategory, type CategoryDotProps } from './Tag'
