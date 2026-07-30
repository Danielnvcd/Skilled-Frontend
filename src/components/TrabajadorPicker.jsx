import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { buscarTrabajadores } from '../api/inventario'

// Typeahead de trabajadores (busca server-side en inventario_api). Compartido por
// Entrega Directa y el formulario de Movimientos (partes del vale). `value` es el
// trabajador seleccionado (o null); `onSelect` recibe el trabajador elegido.
export default function TrabajadorPicker({ value, onSelect, placeholder = 'Busca por nombre o nº de empleado…' }) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [opciones, setOpciones] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (!open) return
    let cancel = false
    setLoading(true)
    buscarTrabajadores({ q: debounced, limit: 20 })
      .then((res) => { if (!cancel) setOpciones(res) })
      .catch(() => { if (!cancel) setOpciones([]) })
      .finally(() => { if (!cancel) setLoading(false) })
    return () => { cancel = true }
  }, [debounced, open])

  useEffect(() => {
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const displayValue = open ? query : (value ? value.nombre_completo : '')

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
        <input
          type="text"
          value={displayValue}
          onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="block w-full h-10 pl-9 pr-3 rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm text-ink-900 dark:text-ink-100 placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
        />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 shadow-lg">
          {loading ? (
            <div className="px-3 py-3 text-sm text-ink-400">Buscando…</div>
          ) : opciones.length === 0 ? (
            <div className="px-3 py-3 text-sm text-ink-400">Sin coincidencias</div>
          ) : (
            opciones.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => { onSelect(t); setQuery(''); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 hover:bg-ink-50 dark:hover:bg-ink-800"
              >
                <span className="min-w-0 truncate text-ink-800 dark:text-ink-100">{t.nombre_completo}</span>
                <span className="text-[11px] text-ink-500 tabular-nums flex-shrink-0">
                  #{t.no_empleado}{t.puesto ? ` · ${t.puesto}` : ''}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
