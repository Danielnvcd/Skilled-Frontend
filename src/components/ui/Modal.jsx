import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-6xl',
}

export default function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  children,
  footer,
  closeOnBackdrop = true,
  hideHeader = false,
  bodyClassName = '',
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm"
        onClick={() => closeOnBackdrop && onClose?.()}
      />
      <div
        className={`relative w-full ${sizes[size]} bg-white dark:bg-ink-900 rounded-xl shadow-modal border border-ink-200 dark:border-ink-800 animate-scale-in flex flex-col max-h-[calc(100vh-3rem)]`}
        onClick={(e) => e.stopPropagation()}
      >
        {!hideHeader && (
          <div className="flex items-start justify-between gap-4 px-5 sm:px-6 py-4 border-b border-ink-200 dark:border-ink-800">
            <div className="min-w-0">
              {title && <h2 className="text-base font-semibold text-ink-900 dark:text-ink-100 truncate">{title}</h2>}
              {description && <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">{description}</p>}
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800 hover:text-ink-700 dark:hover:text-ink-200 focus-ring"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className={`px-5 sm:px-6 py-5 overflow-y-auto scrollbar-thin ${bodyClassName}`}>
          {children}
        </div>
        {footer && (
          <div className="px-5 sm:px-6 py-4 border-t border-ink-200 dark:border-ink-800 bg-ink-50/50 dark:bg-ink-950/30 rounded-b-xl flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
