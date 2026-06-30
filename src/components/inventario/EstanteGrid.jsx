import { useMemo } from 'react'
import { AlertTriangle, Package } from 'lucide-react'

// Render visual de un estante físico (Pausa 11).
//
// Dibuja un mueble tipo rack: marco con postes laterales, `filas` niveles
// apilados (cada uno con su "tabla"/plank debajo) y `columnas` compartimentos
// separados por divisiones verticales. En cada compartimento van los productos
// colocados ahí (chips con su cantidad).
//
// Escala: las celdas tienen un ANCHO MÍNIMO; si hay muchas columnas el mueble
// hace scroll horizontal en vez de encoger las celdas a nada. Cada celda tiene
// ALTURA FIJA con scroll interno, así un compartimento con muchos productos no
// deforma la rejilla.
//
// Presentacional: la lógica de edición vive en el padre; aquí solo se
// selecciona una celda (modo edición) y se resaltan productos (modo atención).
//
// Props:
//   filas, columnas        — dimensiones de la rejilla
//   placements             — [{ producto_id, producto:{codigo,descripcion}, fila, columna, cantidad }]
//   selectedCell           — { fila, columna } | null   (edición)
//   onCellClick(f, c)      — click en celda (edición)
//   highlightProductoIds   — iterable de producto_id a resaltar (atención)
//   sobranteProductoIds    — iterable de producto_id que necesitan reacomodo
//   compact                — versión mini (preview en tabla)
export default function EstanteGrid({
  filas = 1,
  columnas = 1,
  placements = [],
  selectedCell = null,
  onCellClick,
  highlightProductoIds,
  sobranteProductoIds,
  compact = false,
  fit = false,        // reparte columnas al ancho disponible, sin scrolls
}) {
  const f = Math.max(1, Number(filas) || 1)
  const c = Math.max(1, Number(columnas) || 1)
  const editable = typeof onCellClick === 'function'

  const highlight = useMemo(
    () => new Set([...(highlightProductoIds || [])].map(Number)),
    [highlightProductoIds],
  )
  const sobrante = useMemo(
    () => new Set([...(sobranteProductoIds || [])].map(Number)),
    [sobranteProductoIds],
  )

  // Indexa colocaciones por celda "f:c". Los "sin ubicar" no entran en la rejilla.
  const porCelda = useMemo(() => {
    const map = new Map()
    for (const p of placements) {
      if (p.fila == null || p.columna == null) continue
      const key = `${p.fila}:${p.columna}`
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(p)
    }
    return map
  }, [placements])

  // ── Mini preview (tabla): rack diminuto sin chips ──────────────────────────
  if (compact) {
    const gridCols = { gridTemplateColumns: `repeat(${c}, minmax(0, 1fr))` }
    return (
      <div className="inline-flex flex-col gap-px rounded-sm border border-ink-300 dark:border-ink-700 bg-ink-200/50 dark:bg-ink-800 p-0.5 max-w-full overflow-hidden">
        {Array.from({ length: Math.min(f, 6) }).map((_, ri) => (
          <div key={ri} className="grid gap-px" style={gridCols}>
            {Array.from({ length: Math.min(c, 10) }).map((__, ci) => {
              const items = porCelda.get(`${ri + 1}:${ci + 1}`) || []
              return (
                <div
                  key={ci}
                  className={`h-2 w-2.5 rounded-[1px] ${items.length ? 'bg-brand-400' : 'bg-white dark:bg-ink-900'}`}
                />
              )
            })}
          </div>
        ))}
      </div>
    )
  }

  // ── Estante completo ───────────────────────────────────────────────────────
  const niveles = Array.from({ length: f }, (_, i) => i + 1)
  const labelW = 26          // ancho de la columna de etiquetas de nivel
  const minCellW = 88        // ancho mínimo por compartimento (modo editor)
  const cellBodyH = 64       // alto fijo del contenido de cada celda (modo editor)
  const maxChips = fit ? 8 : null  // en modo fit, sin scroll: cap de chips + "+N"
  // Si hay muchas columnas, el cuerpo crece por encima del contenedor → scroll-x.
  const bodyMinW = c * minCellW
  const gridCols = {
    gridTemplateColumns: fit
      ? `repeat(${c}, minmax(0, 1fr))`          // reparte al ancho disponible
      : `repeat(${c}, minmax(${minCellW}px, 1fr))`,
  }

  return (
    <div className={`select-none ${fit ? '' : 'overflow-x-auto'}`}>
      {/* en modo fit no forzamos min-width (sin scroll horizontal) */}
      <div style={fit ? undefined : { minWidth: labelW + 28 + bodyMinW }}>
        {/* Mueble: postes laterales + niveles apilados (las etiquetas F/Col
            viven dentro para alinearse siempre con sus celdas) */}
        <div className="flex rounded-md bg-gradient-to-b from-ink-200 to-ink-300 dark:from-ink-800 dark:to-ink-900 p-[6px] shadow-inner ring-1 ring-ink-300 dark:ring-ink-700">
          <div className="w-1.5 rounded-l bg-gradient-to-r from-ink-400 to-ink-300 dark:from-ink-950 dark:to-ink-700 flex-shrink-0" />

          <div className="flex-1 flex flex-col">
            {/* Encabezado de columnas */}
            <div className="flex mb-0.5">
              <div className="flex-shrink-0" style={{ width: labelW }} />
              <div className="flex-1 grid gap-0 px-1.5" style={gridCols}>
                {Array.from({ length: c }).map((_, ci) => (
                  <div key={ci} className="text-center text-[10px] font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400 truncate">
                    Col {ci + 1}
                  </div>
                ))}
              </div>
            </div>

            {niveles.map((fila) => (
              <div key={fila} className="flex">
                {/* Etiqueta de nivel, alineada al centro de las celdas */}
                <div className="flex-shrink-0 flex items-center justify-center" style={{ width: labelW, ...(fit ? {} : { height: cellBodyH + 6 }) }}>
                  <span className="text-[10px] font-mono font-semibold text-ink-500 dark:text-ink-400">F{fila}</span>
                </div>

                <div className="flex-1 relative">
                  {/* Compartimentos del nivel */}
                  <div className="grid gap-0 px-1.5 pt-1.5" style={gridCols}>
                    {Array.from({ length: c }).map((_, ci) => {
                      const columna = ci + 1
                      const items = porCelda.get(`${fila}:${columna}`) || []
                      const isSelected = selectedCell?.fila === fila && selectedCell?.columna === columna
                      const hasHighlight = items.some((it) => highlight.has(Number(it.producto_id)))
                      const Tag = editable ? 'button' : 'div'
                      return (
                        <Tag
                          key={columna}
                          type={editable ? 'button' : undefined}
                          onClick={editable ? () => onCellClick(fila, columna) : undefined}
                          title={`Columna ${columna}, Fila ${fila}${items.length ? ` — ${items.length} producto(s)` : ''}`}
                          className={[
                            'relative rounded-sm text-left transition-colors px-1 py-1 flex flex-col',
                            ci < c - 1 ? 'border-r border-dashed border-ink-300/70 dark:border-ink-700/70' : '',
                            editable ? 'cursor-pointer hover:bg-brand-50/60 dark:hover:bg-brand-900/20' : '',
                            isSelected
                              ? 'bg-brand-100/70 dark:bg-brand-900/30 ring-1 ring-inset ring-brand-500'
                              : hasHighlight
                                ? 'bg-emerald-100/70 dark:bg-emerald-900/30 ring-1 ring-inset ring-emerald-500'
                                : '',
                          ].join(' ')}
                          style={fit ? { minHeight: 40 } : { height: cellBodyH }}
                        >
                          {items.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center min-h-[28px]">
                              <Package size={16} className="text-ink-300/70 dark:text-ink-700" />
                            </div>
                          ) : (
                            <div className={fit ? 'space-y-1' : 'flex-1 overflow-y-auto space-y-1 pr-0.5 scrollbar-thin'}>
                              {(maxChips ? items.slice(0, maxChips) : items).map((it) => {
                                const necesitaReacomodo = sobrante.has(Number(it.producto_id))
                                const resaltado = highlight.has(Number(it.producto_id))
                                return (
                                  <div
                                    key={it.producto_id}
                                    title={`${it.producto?.codigo || ''} ${it.producto?.descripcion || ''}`.trim()}
                                    className={[
                                      'flex items-center gap-1 px-1.5 py-1 rounded text-[11px] leading-tight shadow-sm',
                                      resaltado
                                        ? 'bg-emerald-500 text-white font-semibold'
                                        : 'bg-white dark:bg-ink-800 text-ink-700 dark:text-ink-200 border border-ink-200/80 dark:border-ink-700',
                                    ].join(' ')}
                                  >
                                    {necesitaReacomodo && (
                                      <AlertTriangle size={11} className={`flex-shrink-0 ${resaltado ? 'text-white' : 'text-amber-500'}`} />
                                    )}
                                    <span className="font-mono truncate flex-1 min-w-0">
                                      {it.producto?.codigo || `#${it.producto_id}`}
                                    </span>
                                    <span className="tabular-nums opacity-80 flex-shrink-0">×{formatQty(it.cantidad)}</span>
                                  </div>
                                )
                              })}
                              {maxChips && items.length > maxChips && (
                                <span className="block text-[10px] text-ink-500 dark:text-ink-400 pl-1">
                                  +{items.length - maxChips} más
                                </span>
                              )}
                            </div>
                          )}
                          {!fit && items.length > 1 && (
                            <span className="absolute top-0.5 right-1 text-[9px] font-bold text-ink-400 dark:text-ink-500 pointer-events-none">
                              {items.length}
                            </span>
                          )}
                        </Tag>
                      )
                    })}
                  </div>

                  {/* Tabla / plank del nivel */}
                  <div className="h-2 mt-1 mb-2 rounded-sm bg-gradient-to-b from-ink-400 to-ink-500 dark:from-ink-600 dark:to-ink-800 shadow-[0_1px_2px_rgba(0,0,0,0.25)]">
                    <div className="h-px bg-white/40 dark:bg-white/10 rounded-t-sm" />
                  </div>
                </div>
              </div>
              ))}
            </div>

            <div className="w-1.5 rounded-r bg-gradient-to-l from-ink-400 to-ink-300 dark:from-ink-950 dark:to-ink-700 flex-shrink-0" />
          </div>

        {/* Patas del mueble */}
        <div className="flex">
          <div style={{ width: labelW + 6 }} className="flex-shrink-0" />
          <div className="flex-1 flex justify-between px-2">
            <div className="w-2 h-2 bg-ink-400 dark:bg-ink-700 rounded-b-sm" />
            <div className="w-2 h-2 bg-ink-400 dark:bg-ink-700 rounded-b-sm" />
          </div>
        </div>
      </div>
    </div>
  )
}

function formatQty(v) {
  const n = Number(v) || 0
  return n % 1 === 0 ? n : n.toFixed(2)
}
