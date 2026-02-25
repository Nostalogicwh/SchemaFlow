import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import ImageViewer from '../ImageViewer'

describe('ImageViewer', () => {
  const defaultProps = {
    src: 'https://example.com/image.jpg',
    isOpen: true,
    onClose: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('渲染测试', () => {
    it('renders when isOpen is true', () => {
      render(<ImageViewer {...defaultProps} />)
      expect(screen.getByRole('img', { name: '预览' })).toBeInTheDocument()
    })

    it('does not render when isOpen is false', () => {
      render(<ImageViewer {...defaultProps} isOpen={false} />)
      expect(screen.queryByRole('img', { name: '预览' })).not.toBeInTheDocument()
    })

    it('shows download button when downloadable is true', () => {
      render(<ImageViewer {...defaultProps} downloadable={true} />)
      expect(screen.getByTitle('下载')).toBeInTheDocument()
    })

    it('hides download button when downloadable is false', () => {
      render(<ImageViewer {...defaultProps} downloadable={false} />)
      expect(screen.queryByTitle('下载')).not.toBeInTheDocument()
    })

    it('renders zoom controls', () => {
      render(<ImageViewer {...defaultProps} />)
      expect(screen.getByTitle('缩小')).toBeInTheDocument()
      expect(screen.getByTitle('放大')).toBeInTheDocument()
      expect(screen.getByTitle('重置')).toBeInTheDocument()
    })

    it('renders close button', () => {
      render(<ImageViewer {...defaultProps} />)
      expect(screen.getByTitle('关闭')).toBeInTheDocument()
    })
  })

  describe('关闭功能测试', () => {
    it('calls onClose when backdrop is clicked', () => {
      const handleClose = vi.fn()
      const { container } = render(
        <ImageViewer {...defaultProps} onClose={handleClose} />
      )

      const backdrop = container.querySelector('.fixed.inset-0')
      if (backdrop) {
        fireEvent.click(backdrop)
        expect(handleClose).toHaveBeenCalledTimes(1)
      }
    })

    it('calls onClose when close button is clicked', () => {
      const handleClose = vi.fn()
      render(<ImageViewer {...defaultProps} onClose={handleClose} />)

      fireEvent.click(screen.getByTitle('关闭'))
      expect(handleClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('键盘交互测试', () => {
    it('calls onClose when ESC key is pressed', () => {
      const handleClose = vi.fn()
      render(<ImageViewer {...defaultProps} onClose={handleClose} />)

      fireEvent.keyDown(window, { key: 'Escape' })
      expect(handleClose).toHaveBeenCalledTimes(1)
    })

    it('does not call onClose when other keys are pressed', () => {
      const handleClose = vi.fn()
      render(<ImageViewer {...defaultProps} onClose={handleClose} />)

      fireEvent.keyDown(window, { key: 'Enter' })
      expect(handleClose).not.toHaveBeenCalled()
    })

    it('removes event listener on unmount', () => {
      const handleClose = vi.fn()
      const { unmount } = render(
        <ImageViewer {...defaultProps} onClose={handleClose} />
      )

      unmount()
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(handleClose).not.toHaveBeenCalled()
    })

    it('does not listen for ESC when closed', () => {
      const handleClose = vi.fn()
      render(<ImageViewer {...defaultProps} isOpen={false} onClose={handleClose} />)

      fireEvent.keyDown(window, { key: 'Escape' })
      expect(handleClose).not.toHaveBeenCalled()
    })
  })

  describe('缩放功能测试', () => {
    it('zooms in when zoom in button is clicked', () => {
      render(<ImageViewer {...defaultProps} />)

      fireEvent.click(screen.getByTitle('放大'))
      expect(screen.getByText('125%')).toBeInTheDocument()
    })

    it('zooms out when zoom out button is clicked', () => {
      render(<ImageViewer {...defaultProps} />)

      fireEvent.click(screen.getByTitle('缩小'))
      expect(screen.getByText('75%')).toBeInTheDocument()
    })

    it('resets zoom when reset button is clicked', () => {
      render(<ImageViewer {...defaultProps} />)

      fireEvent.click(screen.getByTitle('放大'))
      fireEvent.click(screen.getByTitle('放大'))
      expect(screen.getByText('150%')).toBeInTheDocument()

      fireEvent.click(screen.getByTitle('重置'))
      expect(screen.getByText('100%')).toBeInTheDocument()
    })
  })
})
