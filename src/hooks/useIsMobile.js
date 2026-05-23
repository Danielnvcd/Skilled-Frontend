import { useEffect, useState } from 'react'

const UA_RE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i

function detect() {
  if (typeof window === 'undefined') return false
  // Combinamos user agent + viewport: cubre celulares por UA y casos
  // de ventana redimensionada a tamaño móvil en escritorio.
  const byUA = UA_RE.test(navigator.userAgent || '')
  const byViewport = window.matchMedia?.('(max-width: 768px)').matches ?? false
  return byUA || byViewport
}

export default function useIsMobile() {
  const [isMobile, setIsMobile] = useState(detect)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 768px)')
    const update = () => setIsMobile(detect())
    mq.addEventListener?.('change', update)
    window.addEventListener('resize', update)
    return () => {
      mq.removeEventListener?.('change', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return isMobile
}
