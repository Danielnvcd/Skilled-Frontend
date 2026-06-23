import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { getProductos } from '../api/inventario'

/**
 * Buscador de productos con búsqueda server-side (typeahead).
 *
 * Escala a miles de productos: NO descarga el catálogo completo, consulta el
 * backend con ?q= por cada término (debounce 300ms) y devuelve el producto
 * completo al seleccionarlo.
 *
 * Props:
 *   - value:      producto seleccionado (objeto) o null. En modo "agregar a
 *                 lista" deja value=null y se limpia tras cada selección.
 *   - onSelect:   (producto) => void
 *   - label:      etiqueta (null para ocultarla)
 *   - placeholder
 *   - excludeIds: Set o array de ids a deshabilitar (ya agregados)
 *   - autoFocus
 *   - categoria:  acota la búsqueda a una categoría (opcional)
 */
export default function ProductoPicker({
  value = null,
  onSelect,
  label = 'Producto',
  placeholder = 'Busca por código o descripción…',
  excludeIds,
  autoFocus = false,
  categoria,
}) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [opciones, setOpciones] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const boxRef = useRef(null)

  const excluded = excludeIds instanceof Set ? excludeIds : new Set(excludeIds || [])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (!open) return
    let cancel = false
    setLoading(true)
    getProductos({ q: debounced, categoria, limit: 50 })
      .then((res) => { if (!cancel) setOpciones(res) })
      .catch(() => { if (!cancel) setOpciones([]) })
      .finally(() => { if (!cancel) setLoading(false) })
    return () => { cancel = true }
  }, [debounced, open, categoria])

  useEffect(() => {
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const pick = (p) => {
    if (excluded.has(p.id)) return
    onSelect(p)
    setQuery('')
    setOpen(false)
  }

  const displayValue = open
    ? query
    : (value ? `${value.codigo} — ${value.descripcion}` : '')

  return (
    <div ref={boxRef} className="relative">
      {label && (
        <label className="block text-sm font-medium text-ink-700 dark:text-ink-200 mb-1">{label}</label>
      )}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
        <input
          type="text"
          value={displayValue}
          autoFocus={autoFocus}
          onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="block w-full h-10 pl-9 pr-3 rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm text-ink-900 dark:text-ink-100 placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
        />
      </div>
      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 shadow-lg">
          {loading ? (
            <div className="px-3 py-3 text-sm text-ink-400">Buscando…</div>
          ) : opciones.length === 0 ? (
            <div className="px-3 py-3 text-sm text-ink-400">Sin coincidencias</div>
          ) : (
            opciones.map((p) => {
              const dis = excluded.has(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pick(p)}
                  disabled={dis}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 ${
                    dis ? 'opacity-40 cursor-not-allowed' : 'hover:bg-ink-50 dark:hover:bg-ink-800'
                  }`}
                >
                  <span className="min-w-0 truncate">
                    <span className="font-mono text-xs text-brand-700 dark:text-brand-300">{p.codigo}</span>{' '}
                    <span className="text-ink-800 dark:text-ink-100">{p.descripcion}</span>
                  </span>
                  <span className="text-[11px] text-ink-500 tabular-nums flex-shrink-0">
                    {p.stock_actual} {p.unidad}
                  </span>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
