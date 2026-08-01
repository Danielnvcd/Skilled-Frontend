import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search } from 'lucide-react'
import { buscarTrabajadores } from '../api/inventario'

// Typeahead de trabajadores (busca server-side en inventario_api). Compartido por
// Entrega Directa y el formulario de Movimientos (partes del comprobante). `value` es el
// trabajador seleccionado (o null); `onSelect` recibe el trabajador elegido.
//
// La lista se pinta en un portal a `document.body` y no como `absolute` dentro
// del campo. Dentro de un Modal el cuerpo tiene `overflow-y-auto`, así que una
// lista absoluta se recortaba contra el borde del modal justo cuando el campo
// quedaba abajo; y `position: fixed` tampoco basta, porque el modal se anima
// con `transform` y un ancestro transformado vuelve a ser el marco de
// referencia de lo fijo. En el body no hay ancestro que recorte.
const ALTO_MAX = 240   // el max-h-60 de antes, ahora como tope del cálculo
const MARGEN = 8       // aire contra el borde de la ventana

export default function TrabajadorPicker({ value, onSelect, placeholder = 'Busca por nombre o nº de empleado…' }) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [opciones, setOpciones] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pos, setPos] = useState(null)
  const boxRef = useRef(null)
  const menuRef = useRef(null)

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

  // Ancla la lista al campo. Se abre hacia arriba solo si abajo no cabe y
  // arriba sobra más sitio, que es el caso del campo pegado al pie del modal.
  const recalcular = useCallback(() => {
    const el = boxRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const abajo = window.innerHeight - r.bottom - MARGEN
    const arriba = r.top - MARGEN
    const haciaArriba = abajo < 160 && arriba > abajo
    setPos({
      left: r.left,
      width: r.width,
      maxHeight: Math.min(ALTO_MAX, Math.max(120, haciaArriba ? arriba : abajo)),
      ...(haciaArriba ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) { setPos(null); return }
    recalcular()
    // En captura para enterarse también del scroll de contenedores internos
    // (el cuerpo del Modal), no solo del de la ventana.
    window.addEventListener('scroll', recalcular, true)
    window.addEventListener('resize', recalcular)
    return () => {
      window.removeEventListener('scroll', recalcular, true)
      window.removeEventListener('resize', recalcular)
    }
  }, [open, recalcular])

  useEffect(() => {
    // La lista vive fuera del campo en el DOM, así que hay que perdonar los dos
    // sitios: si no, el mousedown sobre una opción cerraba el menú antes de que
    // el click llegara a registrarse y no se podía elegir a nadie.
    const onDoc = (e) => {
      if (boxRef.current?.contains(e.target)) return
      if (menuRef.current?.contains(e.target)) return
      setOpen(false)
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
      {open && pos && createPortal(
        // z por encima del z-[100] del Modal: si no, la lista queda debajo del
        // propio modal que la abrió.
        <div
          ref={menuRef}
          style={pos}
          className="fixed z-[110] overflow-y-auto scrollbar-thin rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 shadow-lg"
        >
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
        </div>,
        document.body,
      )}
    </div>
  )
}
