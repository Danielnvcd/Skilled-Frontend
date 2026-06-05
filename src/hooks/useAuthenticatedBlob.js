import { useEffect, useRef, useState } from 'react'
import api from '../api/axios'

/**
 * Descarga recursos protegidos por JWT como blob y devuelve una object URL
 * para inyectar en `<img src>`, `<iframe src>`, `<video src>`, etc.
 *
 * El módulo mantiene tres estructuras:
 *
 *  - `blobCache`  LRU acotado (MAX_CACHE_SIZE) — al llenarse, las entradas
 *                 más viejas se revocan con URL.revokeObjectURL para que el
 *                 browser no acumule blobs en memoria al navegar páginas con
 *                 muchas imágenes.
 *  - `inflight`   Deduplica requests concurrentes: si N componentes piden el
 *                 mismo path simultáneamente, sólo se dispara UN axios.get
 *                 y todos suscriben a la misma promesa.
 *  - El cache es por sesión de browser. Recargas full traen lo nuevo.
 *
 * Dos hooks disponibles:
 *
 *  - useAuthenticatedBlob(path, mimeType?)      — fetch inmediato al montar.
 *  - useLazyAuthenticatedBlob(path, mimeType?)  — devuelve [url, ref]; el
 *    fetch sólo dispara cuando el elemento al que se le asigna `ref` entra
 *    (o queda dentro de 200px de) el viewport. Ideal para grids con
 *    decenas/cientos de thumbnails.
 */

const MAX_CACHE_SIZE = 80
const blobCache = new Map() // path → objectUrl  (insertion order = LRU order)
const inflight = new Map()  // path → Promise<objectUrl>

// Limpia todo el blob cache y revoca cada object URL. Llamar en login/logout:
// sin esto, fotos privadas de la cuenta anterior se mostraban un instante en
// la cuenta nueva (mismo path puede resolver a distinto contenido por JWT) y
// además leak de memoria por blobs no revocados.
export function clearBlobCache() {
  for (const url of blobCache.values()) {
    try { URL.revokeObjectURL(url) } catch { /* noop */ }
  }
  blobCache.clear()
  inflight.clear()
}

function touch(path) {
  // Mover al final del Map = marcar como "más reciente" en LRU
  if (blobCache.has(path)) {
    const v = blobCache.get(path)
    blobCache.delete(path)
    blobCache.set(path, v)
  }
}

function evictOldestIfFull() {
  while (blobCache.size >= MAX_CACHE_SIZE) {
    const oldestPath = blobCache.keys().next().value
    const oldUrl = blobCache.get(oldestPath)
    URL.revokeObjectURL(oldUrl)
    blobCache.delete(oldestPath)
  }
}

function fetchBlob(path, mimeType) {
  if (blobCache.has(path)) {
    touch(path)
    return Promise.resolve(blobCache.get(path))
  }
  if (inflight.has(path)) {
    return inflight.get(path)
  }
  const promise = api
    .get(path, { responseType: 'blob' })
    .then((res) => {
      const blob = mimeType ? new Blob([res.data], { type: mimeType }) : res.data
      const url = URL.createObjectURL(blob)
      evictOldestIfFull()
      blobCache.set(path, url)
      return url
    })
    .finally(() => {
      inflight.delete(path)
    })
  inflight.set(path, promise)
  return promise
}

export default function useAuthenticatedBlob(path, mimeType = null) {
  const [blobUrl, setBlobUrl] = useState(() => (path && blobCache.has(path) ? blobCache.get(path) : null))

  useEffect(() => {
    if (!path) {
      setBlobUrl(null)
      return
    }
    if (blobCache.has(path)) {
      touch(path)
      setBlobUrl(blobCache.get(path))
      return
    }
    let cancelled = false
    fetchBlob(path, mimeType)
      .then((url) => { if (!cancelled) setBlobUrl(url) })
      .catch(() => { if (!cancelled) setBlobUrl(null) })
    return () => { cancelled = true }
  }, [path, mimeType])

  return blobUrl
}

/**
 * Variante lazy: sólo dispara el fetch cuando el elemento al que se asigna
 * el ref entra (o queda cerca de) el viewport. Para grids con decenas/cientos
 * de thumbnails, evita disparar todas las requests a la vez.
 *
 * El fetch dispara desde un único useEffect — ni state intermedio `visible`
 * ni dos efectos en cadena. Eso evita un bug que aparecía al volver a la
 * página por back-navigation: el IntersectionObserver no siempre dispara
 * isIntersecting=true en el primer tick si el elemento ya estaba visible
 * cuando se monta, y el fetch quedaba colgado en `visible=false`.
 *
 * Robustecido con un check sincrónico de getBoundingClientRect: si al
 * instalar el observer el elemento ya está en (o cerca de) el viewport,
 * disparamos el fetch sin esperar al callback del observer.
 */
const LAZY_ROOT_MARGIN_PX = 200

function isNearViewport(el) {
  const rect = el.getBoundingClientRect()
  const vh = window.innerHeight || document.documentElement.clientHeight
  return rect.bottom > -LAZY_ROOT_MARGIN_PX && rect.top < vh + LAZY_ROOT_MARGIN_PX
}

export function useLazyAuthenticatedBlob(path, mimeType = null) {
  const [blobUrl, setBlobUrl] = useState(() => (path && blobCache.has(path) ? blobCache.get(path) : null))
  const ref = useRef(null)

  useEffect(() => {
    if (!path) {
      setBlobUrl(null)
      return
    }
    if (blobCache.has(path)) {
      touch(path)
      setBlobUrl(blobCache.get(path))
      return
    }

    let cancelled = false
    const startFetch = () => {
      fetchBlob(path, mimeType)
        .then((url) => { if (!cancelled) setBlobUrl(url) })
        .catch(() => { if (!cancelled) setBlobUrl(null) })
    }

    const el = ref.current
    // Si no tenemos elemento al que observar, no podemos hacer lazy — cargar directo.
    if (!el || typeof IntersectionObserver === 'undefined') {
      startFetch()
      return () => { cancelled = true }
    }

    // Check sincrónico: si ya está visible (caso típico al volver a la página
    // por back-navigation con scroll restaurado), arrancá el fetch sin esperar
    // al callback async del observer (que puede tardar un frame o no disparar
    // si el componente se desmonta antes).
    if (isNearViewport(el)) {
      startFetch()
      return () => { cancelled = true }
    }

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          obs.disconnect()
          startFetch()
        }
      },
      { rootMargin: `${LAZY_ROOT_MARGIN_PX}px` },
    )
    obs.observe(el)
    return () => {
      cancelled = true
      obs.disconnect()
    }
  }, [path, mimeType])

  return [blobUrl, ref]
}
