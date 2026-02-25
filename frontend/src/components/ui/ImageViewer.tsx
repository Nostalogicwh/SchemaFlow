import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { X, Download, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'

interface ImageViewerProps {
  src: string
  isOpen: boolean
  onClose: () => void
  downloadable?: boolean
  filename?: string
}

function ImageViewer({ src, isOpen, onClose, downloadable = false, filename = 'image.jpg' }: ImageViewerProps) {
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const resetTransform = useCallback(() => {
    setScale(1)
    setTranslate({ x: 0, y: 0 })
  }, [])

  useEffect(() => {
    if (isOpen) {
      resetTransform()
    }
  }, [isOpen, resetTransform])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setScale(prev => Math.min(Math.max(0.5, prev + delta), 5))
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    setIsDragging(true)
    setDragStart({ x: e.clientX - translate.x, y: e.clientY - translate.y })
  }, [translate])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return
    setTranslate({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }, [isDragging, dragStart])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleDoubleClick = useCallback(() => {
    resetTransform()
  }, [resetTransform])

  const handleDownload = useCallback(() => {
    const link = document.createElement('a')
    link.href = src.startsWith('data:') ? src : src
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [src, filename])

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }, [onClose])

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 5))
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5))

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <button
          onClick={handleZoomOut}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
          title="缩小"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <span className="text-white text-sm min-w-[60px] text-center">{Math.round(scale * 100)}%</span>
        <button
          onClick={handleZoomIn}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
          title="放大"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button
          onClick={resetTransform}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
          title="重置"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
        {downloadable && (
          <button
            onClick={handleDownload}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
            title="下载"
          >
            <Download className="w-5 h-5" />
          </button>
        )}
        <button
          onClick={onClose}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
          title="关闭"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          src={src}
          alt="预览"
          className="max-w-none select-none"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transition: isDragging ? 'none' : 'transform 0.1s ease-out'
          }}
          onDoubleClick={handleDoubleClick}
          draggable={false}
        />
      </div>
    </div>
  )
}

export default memo(ImageViewer)
