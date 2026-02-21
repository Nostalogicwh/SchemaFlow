/**
 * 工具函数
 */

/**
 * 条件类名合并函数
 * 类似于clsx + tailwind-merge的简化版
 */
export function cn(...inputs: (string | undefined | null | false)[]): string {
  return inputs.filter(Boolean).join(' ')
}
