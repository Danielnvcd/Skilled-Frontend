import { useEffect, useState } from 'react'
import api from '../../api/axios'

/**
 * Renderiza una imagen cuyo endpoint requiere JWT.
 * Un `<img src="/api/...">` HTML no envía el header Authorization, por lo que
 * descargamos el blob con axios y mostramos la URL temporal.
 *
 * Props:
 *  - src: ruta relativa al baseURL de axios (ej. "/v1/herramientas-unidades/1/media/1")
 *  - fallback: nodo a mostrar si falla la carga (opcional)
 *  - className, alt y demás props se pasan al <img>.
 */
export default function AuthImage({ src, fallback = null, alt = '', className = '', ...rest }) {
  const [blobUrl, setBlobUrl] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!src) { setBlobUrl(null); return }
    let cancelled = false
    let revoke = null
    setError(false)
    api.get(src, { responseType: 'blob' })
      .then((res) => {
        if (cancelled) return
        const url = URL.createObjectURL(res.data)
        revoke = url
        setBlobUrl(url)
      })
      .catch(() => { if (!cancelled) setError(true) })
    return () => {
      cancelled = true
      if (revoke) URL.revokeObjectURL(revoke)
    }
  }, [src])

  if (error) return fallback
  if (!blobUrl) {
    return (
      <div className={`bg-ink-100 dark:bg-ink-800 animate-pulse ${className}`} aria-label="Cargando imagen…" />
    )
  }
  return <img src={blobUrl} alt={alt} className={className} {...rest} />
}
