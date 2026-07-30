import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PackageMinus, ChevronRight } from 'lucide-react'
import { getProductosBajoMinimo } from '../api/inventario'
import { useResource } from '../hooks/useResource'

// Cuántos productos listamos en el dropdown antes de resumir con "… y N más".
const MAX_VISIBLES = 6

/**
 * Campana de productos bajo mínimo.
 *
 * Vive en la navbar para que la alerta acompañe al almacenista por toda la app
 * y no solo en la portada de inventario, que era donde estaba antes como tira.
 *
 * Es una campana aparte de `AlertasBell` a propósito: aquélla está limitada a
 * admin, y el bajo mínimo le importa sobre todo al rol `inventario`.
 */
export default function BajoMinimoBell() {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)
  const navigate = useNavigate()

  // Mismo criterio de caché que AlertasBell: el bajo mínimo cambia con los
  // movimientos, así que invalidamos con los eventos que alteran existencias.
  const { data: rawData, loading, refetch } = useResource(
    ['productos', 'bajo-minimo'],
    getProductosBajoMinimo,
    {
      staleMs: 60_000,
      invalidateOn: ['producto:changed', 'movimiento:changed'],
    },
  )
  const productos = Array.isArray(rawData) ? rawData : []
  const total = productos.length

  // Cerrar dropdown al hacer click fuera.
  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (!wrapperRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const goTo = (url) => {
    setOpen(false)
    navigate(url)
  }

  const badgeText = total > 99 ? '99+' : String(total)
  const visibles = productos.slice(0, MAX_VISIBLES)

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); if (!open) refetch() }}
        aria-label={`Productos bajo mínimo${total ? `: ${total}` : ''}`}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 focus-ring transition-colors"
        title={
          total
            ? `${total} producto${total === 1 ? '' : 's'} bajo mínimo`
            : 'Sin productos bajo mínimo'
        }
      >
        <PackageMinus size={18} />
        {total > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold inline-flex items-center justify-center leading-none">
            {badgeText}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Productos bajo mínimo"
          className="absolute right-0 top-[calc(100%+6px)] z-40 w-[360px] max-w-[calc(100vw-32px)] bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-lg shadow-lg max-h-[80vh] overflow-y-auto"
        >
          <header className="sticky top-0 bg-white dark:bg-ink-900 border-b border-ink-100 dark:border-ink-800 px-3 py-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-ink-900 dark:text-ink-100">
              Bajo mínimo {total > 0 ? `(${total})` : ''}
            </span>
            {loading && <span className="text-[10px] text-ink-400">cargando…</span>}
          </header>

          {total === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-ink-500 dark:text-ink-400">
              Todo con existencia suficiente.
            </div>
          ) : (
            <>
              <div className="divide-y divide-ink-100 dark:divide-ink-800">
                {visibles.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => goTo(`/inventario/productos/${p.id}/kardex`)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-ink-50 dark:hover:bg-ink-800/60 transition-colors"
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-ink-900 dark:text-ink-100">
                        {p.descripcion}
                      </span>
                      <span className="block text-[11px] text-ink-500 dark:text-ink-400 truncate">
                        {p.codigo}
                      </span>
                    </span>
                    <span className="text-[11px] font-semibold tabular-nums text-amber-700 dark:text-amber-300 flex-shrink-0">
                      {p.stock_actual}/{p.stock_minimo} {p.unidad}
                    </span>
                    <ChevronRight size={14} className="text-ink-400 flex-shrink-0" />
                  </button>
                ))}
              </div>
              {total > visibles.length && (
                <div className="px-3 pt-2 text-[11px] text-ink-500 dark:text-ink-400">
                  … y {total - visibles.length} más
                </div>
              )}
              <div className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => goTo('/inventario/bajo-minimo')}
                  className="w-full inline-flex items-center justify-center gap-1 rounded-md border border-ink-200 dark:border-ink-700 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-700 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-ink-800/60 transition-colors"
                >
                  Ver todos <ChevronRight size={13} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
