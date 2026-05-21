import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Download, ZoomIn, ZoomOut, RotateCcw, Maximize2 } from 'lucide-react'
import useAuthenticatedBlob from '../../hooks/useAuthenticatedBlob'

export default function ImageViewer({ open, src, alt = 'Vista previa', filename, onClose, authPath }) {
  const [zoom, setZoom] = useState(1)
  const isPdf = (filename || authPath || src || '').toLowerCase().endsWith('.pdf')
  // Si el recurso es privado (authPath !== null) bajamos vía axios con JWT y
  // usamos la blob URL. Sin esto, <img src> e <iframe src> no mandan el header
  // Authorization y el backend responde 401.
  const blobUrl = useAuthenticatedBlob(open && authPath ? authPath : null, isPdf ? 'application/pdf' : null)
  const displaySrc = authPath ? blobUrl : src

  useEffect(() => {
    if (!open) return
    setZoom(1)
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

  const handleDownload = () => {
    if (!displaySrc) return
    const a = document.createElement('a')
    a.href = displaySrc
    a.download = filename || 'imagen'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return createPortal(
    <div className="fixed inset-0 z-[120] flex flex-col bg-ink-950/95 animate-fade-in">
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/10 text-white">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{alt}</p>
          {filename && <p className="text-xs text-white/60 truncate">{filename}</p>}
        </div>
        <div className="flex items-center gap-1">
          {!isPdf && (
            <>
              <button
                onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.25).toFixed(2)))}
                className="h-9 w-9 inline-flex items-center justify-center rounded-md text-white/80 hover:bg-white/10 focus-ring"
                aria-label="Reducir"
              >
                <ZoomOut size={18} />
              </button>
              <span className="text-xs text-white/70 w-12 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}
                className="h-9 w-9 inline-flex items-center justify-center rounded-md text-white/80 hover:bg-white/10 focus-ring"
                aria-label="Ampliar"
              >
                <ZoomIn size={18} />
              </button>
              <button
                onClick={() => setZoom(1)}
                className="h-9 w-9 inline-flex items-center justify-center rounded-md text-white/80 hover:bg-white/10 focus-ring"
                aria-label="Restablecer"
              >
                <RotateCcw size={18} />
              </button>
              <div className="w-px h-6 bg-white/10 mx-1" />
            </>
          )}
          <button
            onClick={() => displaySrc && window.open(displaySrc, '_blank', 'noopener,noreferrer')}
            className="h-9 w-9 inline-flex items-center justify-center rounded-md text-white/80 hover:bg-white/10 focus-ring"
            aria-label="Abrir en pestaña"
          >
            <Maximize2 size={18} />
          </button>
          <button
            onClick={handleDownload}
            className="h-9 w-9 inline-flex items-center justify-center rounded-md text-white/80 hover:bg-white/10 focus-ring"
            aria-label="Descargar"
          >
            <Download size={18} />
          </button>
          <div className="w-px h-6 bg-white/10 mx-1" />
          <button
            onClick={onClose}
            className="h-9 w-9 inline-flex items-center justify-center rounded-md text-white hover:bg-white/10 focus-ring"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>
      </div>
      <div
        className={`flex-1 overflow-auto flex items-center justify-center ${isPdf ? 'p-0 sm:p-4' : 'p-4 sm:p-8'}`}
        onClick={onClose}
      >
        {!displaySrc ? (
          <div className="flex flex-col items-center gap-3 text-white/70" onClick={(e) => e.stopPropagation()}>
            <svg className="animate-spin h-8 w-8" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
              <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <p className="text-sm">Cargando…</p>
          </div>
        ) : isPdf ? (
          <iframe
            src={`${displaySrc}#toolbar=1&navpanes=0`}
            title={alt}
            className="w-full h-full bg-white rounded-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onLoad={(e) => {
              // Prevenir clics dentro del iframe si es posible (cross-origin lo bloquea, pero ayuda si es local)
              e.currentTarget.contentWindow?.document?.addEventListener('click', (ev) => ev.stopPropagation())
            }}
          />
        ) : (
          <img
            src={displaySrc}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            style={{ transform: `scale(${zoom})`, transition: 'transform 150ms ease' }}
            className="max-w-full max-h-full object-contain shadow-2xl select-none"
            draggable={false}
            decoding="async"
          />
        )}
      </div>
    </div>,
    document.body
  )
}
