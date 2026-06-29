import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Paginación server-side acumulativa ("Mostrar más" que pide la siguiente página
 * al backend, no recorta un array ya traído). Pensado para catálogos grandes
 * (miles de filas) donde un `limit` fijo deja registros inalcanzables.
 *
 *   const { items, loading, loadingMore, hasMore, loadMore, refresh, error } =
 *     useServerPagination(
 *       (skip, limit) => getProductos({ q, skip, limit }),  // debe devolver un array
 *       `${q}`,                // depKey: string que, al cambiar, reinicia a la pág. 0
 *       { pageSize: 100 },
 *     )
 *
 * - `fetchPage(skip, limit)` se invoca siempre con la última versión (closure
 *   fresca) gracias a un ref, así puedes cerrar sobre filtros sin re-suscribir.
 * - `depKey` debe ser un string estable (serializa tus filtros). Cuando cambia,
 *   se descarta lo cargado y se vuelve a la primera página.
 * - `hasMore` es true mientras la última página vino llena (== pageSize).
 * - `refresh()` recarga desde la página 0 (útil para eventos de websocket).
 */
export function useServerPagination(fetchPage, depKey, { pageSize = 100 } = {}) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)

  const skipRef = useRef(0)
  const fetchRef = useRef(fetchPage)
  fetchRef.current = fetchPage

  // Carga / reinicio: al cambiar depKey (filtros) o al refrescar (tick).
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    skipRef.current = 0
    Promise.resolve(fetchRef.current(0, pageSize))
      .then((data) => {
        if (cancelled) return
        const arr = Array.isArray(data) ? data : []
        setItems(arr)
        skipRef.current = arr.length
        setHasMore(arr.length === pageSize)
      })
      .catch((e) => { if (!cancelled) setError(e) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [depKey, tick, pageSize])

  const loadMore = useCallback(() => {
    if (loadingMore) return
    setLoadingMore(true)
    Promise.resolve(fetchRef.current(skipRef.current, pageSize))
      .then((data) => {
        const arr = Array.isArray(data) ? data : []
        setItems((prev) => [...prev, ...arr])
        skipRef.current += arr.length
        setHasMore(arr.length === pageSize)
      })
      .catch((e) => setError(e))
      .finally(() => setLoadingMore(false))
  }, [loadingMore, pageSize])

  const refresh = useCallback(() => setTick((t) => t + 1), [])

  return { items, loading, loadingMore, hasMore, error, loadMore, refresh }
}

export default useServerPagination
