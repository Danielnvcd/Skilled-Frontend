import { useEffect, useRef } from 'react'
import Hls from 'hls.js'

/**
 * Video full-screen como fondo (HLS) con overlay opcional.
 * Usa hls.js con enableWorker:false para estabilidad en entornos sandbox.
 * En Safari (que soporta HLS nativo) se asigna el src directamente.
 */
export default function HlsBackground({
  src,
  overlayClassName = 'bg-black/55',
  className = '',
}) {
  const videoRef = useRef(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return

    let hls = null
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari / iOS — HLS nativo
      video.src = src
    } else if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: false })
      hls.loadSource(src)
      hls.attachMedia(video)
    } else {
      // Sin soporte: dejar el contenedor vacío (el overlay/gradiente sigue visible)
      return
    }

    const tryPlay = () => {
      const p = video.play()
      if (p && typeof p.catch === 'function') p.catch(() => {})
    }
    video.addEventListener('loadedmetadata', tryPlay, { once: true })

    return () => {
      video.removeEventListener('loadedmetadata', tryPlay)
      if (hls) hls.destroy()
      try { video.pause() } catch {}
    }
  }, [src])

  return (
    <div className={`fixed inset-0 -z-10 overflow-hidden pointer-events-none ${className}`}>
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className={`absolute inset-0 ${overlayClassName}`} />
    </div>
  )
}
