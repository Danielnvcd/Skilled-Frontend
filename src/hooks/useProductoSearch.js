import { useEffect, useState } from 'react'
import { getProductosPaginado } from '../api/inventario'

/**
 * Typeahead de productos con paginación por PÁGINAS (server-side).
 *
 * En vez de un tope fijo (`limit: N`) que dejaba inalcanzables los resultados
 * de más, pide una página a la vez a `/productos/paginado` y expone el total y
 * el número de páginas para pintar un paginador numérico (Anterior/Siguiente).
 *
 *   const { opciones, loading, page, setPage, total, totalPages, size } =
 *     useProductoSearch({ q: debounced, categoria, enabled: open, pageSize: 50 })
 *
 * - `q` debe venir YA con debounce del caller (el hook no lo aplica).
 * - `enabled`: si false (p.ej. modal cerrado) no fetchea y devuelve vacío.
 * - `minChars`: caracteres mínimos para buscar (0 = busca aun con q vacío).
 * - `page` es 0-based (para encajar con el componente <Pagination>).
 * - Al cambiar q/categoría se vuelve a la página 0.
 */
export function useProductoSearch({
  q = '',
  categoria,
  enabled = true,
  pageSize = 50,
  minChars = 0,
} = {}) {
  const [page, setPage] = useState(0)
  const [data, setData] = useState({ items: [], total: 0, pages: 1 })
  const [loading, setLoading] = useState(false)

  const query = (q || '').trim()
  const catParam = categoria || undefined
  const activo = enabled && query.length >= minChars

  // Nueva búsqueda / filtro → de vuelta a la primera página.
  useEffect(() => { setPage(0) }, [query, catParam, activo, pageSize])

  useEffect(() => {
    if (!activo) {
      setData({ items: [], total: 0, pages: 1 })
      setLoading(false)
      return
    }
    let cancel = false
    setLoading(true)
    getProductosPaginado({ q: query, categoria: catParam, page: page + 1, perPage: pageSize })
      .then((res) => {
        if (cancel) return
        setData({
          items: Array.isArray(res?.items) ? res.items : [],
          total: res?.total ?? 0,
          pages: res?.pages ?? 1,
        })
      })
      .catch(() => { if (!cancel) setData({ items: [], total: 0, pages: 1 }) })
      .finally(() => { if (!cancel) setLoading(false) })
    return () => { cancel = true }
  }, [query, catParam, activo, page, pageSize])

  return {
    opciones: data.items,
    total: data.total,
    totalPages: data.pages,
    page,
    setPage,
    size: pageSize,
    loading,
  }
}

export default useProductoSearch
