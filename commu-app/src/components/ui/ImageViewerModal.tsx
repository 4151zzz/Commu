import { useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react'

interface ImageViewerModalProps {
  images: string[]
  currentIndex: number
  open: boolean
  onClose: () => void
  onIndexChange?: (index: number) => void
}

export function ImageViewerModal({
  images,
  currentIndex,
  open,
  onClose,
  onIndexChange,
}: ImageViewerModalProps) {
  const hasMultiple = images.length > 1

  const handlePrev = useCallback(() => {
    if (!hasMultiple || !onIndexChange) return
    const prev = currentIndex === 0 ? images.length - 1 : currentIndex - 1
    onIndexChange(prev)
  }, [currentIndex, images.length, hasMultiple, onIndexChange])

  const handleNext = useCallback(() => {
    if (!hasMultiple || !onIndexChange) return
    const next = currentIndex === images.length - 1 ? 0 : currentIndex + 1
    onIndexChange(next)
  }, [currentIndex, images.length, hasMultiple, onIndexChange])

  // Keyboard navigation (Escape to close, Left/Right arrows to browse)
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowLeft') {
        handlePrev()
      } else if (e.key === 'ArrowRight') {
        handleNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'auto'
    }
  }, [open, onClose, handlePrev, handleNext])

  if (!open || images.length === 0) return null

  const currentImage = images[currentIndex] || images[0]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Top action bar */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
        {hasMultiple && (
          <span className="text-white/80 bg-zinc-900/80 px-3 py-1.5 rounded-full text-xs font-mono border border-zinc-700/50">
            {currentIndex + 1} / {images.length}
          </span>
        )}
        
        {/* Open original / Download */}
        <a
          href={currentImage}
          download="commu-image.jpg"
          target="_blank"
          rel="noreferrer"
          className="w-10 h-10 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white flex items-center justify-center border border-zinc-700/50 transition-all active:scale-95"
          title="ดาวน์โหลด / เปิดรูปภาพเต็ม"
        >
          <Download className="w-4 h-4" />
        </a>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white flex items-center justify-center border border-zinc-700/50 transition-all active:scale-95"
          title="ปิด (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation - Left */}
      {hasMultiple && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            handlePrev()
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white flex items-center justify-center border border-zinc-700/50 transition-all active:scale-95 shadow-xl"
          title="รูปก่อนหน้า"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Image Preview Card */}
      <div
        className="relative max-w-4xl max-h-[85vh] w-full flex items-center justify-center p-2"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={currentImage}
          alt="Preview"
          className="max-w-full max-h-[82vh] object-contain rounded-2xl shadow-2xl border border-zinc-700/40 bg-zinc-950/50"
        />
      </div>

      {/* Navigation - Right */}
      {hasMultiple && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleNext()
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white flex items-center justify-center border border-zinc-700/50 transition-all active:scale-95 shadow-xl"
          title="รูปถัดไป"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}
    </div>
  )
}
