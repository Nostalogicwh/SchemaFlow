/**
 * Modal 组件 - 统一弹窗组件
 * 支持多种尺寸、焦点捕获、键盘交互
 */
import { useEffect, useRef, useCallback } from 'react'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'fullscreen'
  children: React.ReactNode
  footer?: React.ReactNode
  closeOnOverlayClick?: boolean
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  fullscreen: 'max-w-none w-full h-full m-0 rounded-none',
}

export function Modal({
  isOpen,
  onClose,
  title,
  size = 'md',
  children,
  footer,
  closeOnOverlayClick = true,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<Element | null>(null)

  // 保存之前的焦点元素
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement
      // 聚焦到modal容器
      modalRef.current?.focus()
      // 防止背景滚动
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      // 恢复之前的焦点
      if (previousActiveElement.current instanceof HTMLElement) {
        previousActiveElement.current.focus()
      }
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // ESC键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  // 简单的焦点管理
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'Tab') return

      const focusableElements = modalRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (!focusableElements || focusableElements.length === 0) return

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault()
        lastElement.focus()
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault()
        firstElement.focus()
      }
    },
    []
  )

  // 点击遮罩关闭
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && closeOnOverlayClick) {
        onClose()
      }
    },
    [closeOnOverlayClick, onClose]
  )

  if (!isOpen) return null

  const isFullscreen = size === 'fullscreen'

  return (
      <div
        className={`
          fixed inset-0 z-50 flex items-center justify-center bg-black/50
          animate-fade-in
          ${isFullscreen ? 'p-0' : 'p-4'}
        `}
        onClick={handleOverlayClick}
      >
        <div
          ref={modalRef}
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          className={`
            bg-white rounded-lg shadow-lg overflow-hidden
            w-full animate-scale-in
            transition-all duration-200 ease-out
            ${isFullscreen ? '' : sizeClasses[size]}
          `}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? 'modal-title' : undefined}
        >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
            <h3
              id="modal-title"
              className="text-lg font-semibold text-neutral-900"
            >
              {title}
            </h3>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-blue-400/50"
              aria-label="关闭"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="p-4">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-4 py-3 border-t border-neutral-200 bg-neutral-50">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export default Modal
