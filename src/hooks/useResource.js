import { useCallback, useEffect, useRef, useState } from 'react'
import * as cache from '../utils/resourceCache'
import { useSocket } from '../context/SocketContext'

// Hook estilo SWR sobre nuestra caché en memoria.
//
//   useResource(key, fetcher, opts)
//     key:        string | [namespace, params]
//     fetcher:    () => Promise<data>
//     opts.staleMs:             ms hasta considerar la caché obsoleta (def. 30s)
//     opts.revalidateOnFocus:   refetch silencioso al volver a la pestaña/ruta
//     opts.invalidateOn:        eventos de Socket.IO que invalidan el namespace
//     opts.enabled:             si false, no se ejecuta el fetch
//
//   → { data, loading, error, refetch, isStale }
//
// Comportamiento:
//  - Si hay caché fresca (< staleMs): la devuelve sin pedir.
//  - Si hay caché vieja: la devuelve igual (no spinner) y refetchea en bg.
//  - Si no hay nada: spinner + fetch.
//  - Múltiples componentes con la misma clave comparten el mismo request
//    (dedupe vía inflight) y se re-renderizan al instante cuando llega data.

const DEFAULT_STALE_MS = 30_000

export function useResource(key, fetcher, opts = {}) {
  const {
    staleMs = DEFAULT_STALE_MS,
    revalidateOnFocus = true,
    invalidateOn = [],
    enabled = true,
  } = opts

  const serialKey = cache.serializeKey(key)
  const namespace = cache.namespaceOf(key)
  const { on } = useSocket()

  // Guardamos el fetcher en ref para que no participe en las deps de los
  // effects — así no re-disparamos fetches por re-renders del padre.
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const [, force] = useState(0)
  const rerender = useCallback(() => force((n) => n + 1), [])

  const fetchNow = useCallback(() => {
    if (!enabled) return Promise.resolve()
    const existing = cache.get(serialKey)
    if (existing?.inflight) return existing.inflight
    const p = Promise.resolve()
      .then(() => fetcherRef.current())
      .then((d) => { cache.set(serialKey, d); return d })
      .catch((err) => { cache.setError(serialKey, err); throw err })
    cache.setInflight(serialKey, p)
    return p
  }, [serialKey, enabled])

  // Suscripción a cambios de la caché. Si llega un 'invalidate' (vía socket),
  // refetcheamos automáticamente; en cualquier caso re-renderizamos.
  useEffect(() => {
    return cache.subscribe(serialKey, (type) => {
      if (type === 'invalidate' && enabled) {
        fetchNow().catch(() => {})
      }
      rerender()
    })
  }, [serialKey, enabled, fetchNow, rerender])

  // Fetch inicial al cambiar la clave, respetando staleMs.
  useEffect(() => {
    if (!enabled) return
    const e = cache.get(serialKey)
    const fresh = e && e.ts > 0 && Date.now() - e.ts < staleMs
    if (!fresh) fetchNow().catch(() => {})
  }, [serialKey, enabled, staleMs, fetchNow])

  // Revalidación al recuperar foco / volver a la pestaña, si está stale.
  useEffect(() => {
    if (!revalidateOnFocus || !enabled) return
    const check = () => {
      const e = cache.get(serialKey)
      const fresh = e && e.ts > 0 && Date.now() - e.ts < staleMs
      if (!fresh) fetchNow().catch(() => {})
    }
    const onVis = () => { if (document.visibilityState === 'visible') check() }
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [serialKey, revalidateOnFocus, enabled, staleMs, fetchNow])

  // Invalidación por Socket.IO. Cualquier evento de `invalidateOn` limpia el
  // namespace entero (ej. 'empleado:changed' → todos los `empleados:*`).
  const eventsKey = invalidateOn.join('|')
  useEffect(() => {
    if (!enabled || !namespace || invalidateOn.length === 0) return
    const offs = invalidateOn.map((ev) => on(ev, () => cache.invalidate(namespace)))
    return () => offs.forEach((off) => off && off())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespace, eventsKey, enabled, on])

  const entry = cache.get(serialKey)
  const data = entry?.data ?? null
  const error = entry?.error ?? null
  const loading = !data && !error && enabled

  return {
    data,
    loading,
    error,
    refetch: fetchNow,
    isStale: !entry || Date.now() - (entry.ts || 0) >= staleMs,
  }
}
