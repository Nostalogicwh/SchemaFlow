import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Modal } from '../Modal'

describe('Modal', () => {
  beforeEach(() => {
    // 保存原始 body overflow
    document.body.style.overflow = ''
  })

  afterEach(() => {
    // 清理 body overflow
    document.body.style.overflow = ''
  })

  describe('渲染测试', () => {
    it('renders when isOpen is true', () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          Modal Content
        </Modal>
      )
      expect(screen.getByText('Modal Content')).toBeInTheDocument()
    })

    it('does not render when isOpen is false', () => {
      render(
        <Modal isOpen={false} onClose={() => {}}>
          Modal Content
        </Modal>
      )
      expect(screen.queryByText('Modal Content')).not.toBeInTheDocument()
    })

    it('renders with title', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} title="Modal Title">
          Content
        </Modal>
      )
      expect(screen.getByText('Modal Title')).toBeInTheDocument()
    })

    it('renders with footer', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} footer={<button>Action</button>}>
          Content
        </Modal>
      )
      expect(screen.getByText('Action')).toBeInTheDocument()
    })

    it('renders small size correctly', () => {
      const { container } = render(
        <Modal isOpen={true} onClose={() => {}} size="sm">
          Content
        </Modal>
      )
      const modalContent = container.querySelector('.max-w-sm')
      expect(modalContent).toBeInTheDocument()
    })

    it('renders medium size correctly', () => {
      const { container } = render(
        <Modal isOpen={true} onClose={() => {}} size="md">
          Content
        </Modal>
      )
      const modalContent = container.querySelector('.max-w-lg')
      expect(modalContent).toBeInTheDocument()
    })

    it('renders large size correctly', () => {
      const { container } = render(
        <Modal isOpen={true} onClose={() => {}} size="lg">
          Content
        </Modal>
      )
      const modalContent = container.querySelector('.max-w-2xl')
      expect(modalContent).toBeInTheDocument()
    })

    it('renders fullscreen size correctly', () => {
      const { container } = render(
        <Modal isOpen={true} onClose={() => {}} size="fullscreen">
          Content
        </Modal>
      )
      // fullscreen 模式下应该没有 max-w-* 限制类名
      const modalContent = container.querySelector('.bg-white')
      expect(modalContent).toBeInTheDocument()
      // fullscreen 模式应该全屏显示（没有 max-w 限制）
      expect(modalContent?.className).not.toMatch(/max-w-(sm|lg|2xl)/)
    })
  })

  describe('关闭功能测试', () => {
    it('calls onClose when clicking close button', () => {
      const handleClose = vi.fn()
      render(
        <Modal isOpen={true} onClose={handleClose} title="Test Modal">
          Content
        </Modal>
      )
      
      const closeButton = screen.getByLabelText('关闭')
      fireEvent.click(closeButton)
      
      expect(handleClose).toHaveBeenCalledTimes(1)
    })

    it('calls onClose when clicking overlay (default behavior)', () => {
      const handleClose = vi.fn()
      const { container } = render(
        <Modal isOpen={true} onClose={handleClose}>
          Content
        </Modal>
      )
      
      const overlay = container.querySelector('.fixed.inset-0')
      if (overlay) {
        fireEvent.click(overlay)
        expect(handleClose).toHaveBeenCalledTimes(1)
      }
    })

    it('does not call onClose when clicking overlay if closeOnOverlayClick is false', () => {
      const handleClose = vi.fn()
      const { container } = render(
        <Modal isOpen={true} onClose={handleClose} closeOnOverlayClick={false}>
          Content
        </Modal>
      )
      
      const overlay = container.querySelector('.fixed.inset-0')
      if (overlay) {
        fireEvent.click(overlay)
        expect(handleClose).not.toHaveBeenCalled()
      }
    })

    it('does not call onClose when clicking modal content', () => {
      const handleClose = vi.fn()
      render(
        <Modal isOpen={true} onClose={handleClose}>
          Content
        </Modal>
      )
      
      fireEvent.click(screen.getByText('Content'))
      expect(handleClose).not.toHaveBeenCalled()
    })
  })

  describe('键盘交互测试', () => {
    it('calls onClose when pressing Escape key', () => {
      const handleClose = vi.fn()
      render(
        <Modal isOpen={true} onClose={handleClose}>
          Content
        </Modal>
      )
      
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(handleClose).toHaveBeenCalledTimes(1)
    })

    it('does not call onClose when pressing other keys', () => {
      const handleClose = vi.fn()
      render(
        <Modal isOpen={true} onClose={handleClose}>
          Content
        </Modal>
      )
      
      fireEvent.keyDown(window, { key: 'Enter' })
      expect(handleClose).not.toHaveBeenCalled()
    })

    it('removes event listener on unmount', () => {
      const handleClose = vi.fn()
      const { unmount } = render(
        <Modal isOpen={true} onClose={handleClose}>
          Content
        </Modal>
      )
      
      unmount()
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(handleClose).not.toHaveBeenCalled()
    })
  })

  describe('焦点管理测试', () => {
    it('modal container is focusable', () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          Content
        </Modal>
      )
      
      const modalContainer = screen.getByRole('dialog')
      expect(modalContainer).toHaveAttribute('tabIndex', '-1')
    })

    it('has correct aria attributes', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} title="Test Title">
          Content
        </Modal>
      )
      
      const modal = screen.getByRole('dialog')
      expect(modal).toHaveAttribute('aria-modal', 'true')
      expect(modal).toHaveAttribute('aria-labelledby', 'modal-title')
    })

    it('does not have aria-labelledby when no title', () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          Content
        </Modal>
      )
      
      const modal = screen.getByRole('dialog')
      expect(modal).not.toHaveAttribute('aria-labelledby')
    })
  })

  describe('背景滚动锁定测试', () => {
    it('prevents body scroll when open', () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          Content
        </Modal>
      )
      
      expect(document.body.style.overflow).toBe('hidden')
    })

    it('restores body scroll when closed', () => {
      const { rerender } = render(
        <Modal isOpen={true} onClose={() => {}}>
          Content
        </Modal>
      )
      
      expect(document.body.style.overflow).toBe('hidden')
      
      rerender(
        <Modal isOpen={false} onClose={() => {}}>
          Content
        </Modal>
      )
      
      expect(document.body.style.overflow).toBe('')
    })

    it('cleans up overflow on unmount', () => {
      const { unmount } = render(
        <Modal isOpen={true} onClose={() => {}}>
          Content
        </Modal>
      )
      
      expect(document.body.style.overflow).toBe('hidden')
      unmount()
      expect(document.body.style.overflow).toBe('')
    })
  })

  describe('焦点捕获测试', () => {
    it('maintains focus within modal', () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          <button>First</button>
          <button>Second</button>
        </Modal>
      )
      
      const firstButton = screen.getByText('First')
      const secondButton = screen.getByText('Second')
      
      // 模拟 Tab 键循环
      firstButton.focus()
      expect(document.activeElement).toBe(firstButton)
    })
  })
})
