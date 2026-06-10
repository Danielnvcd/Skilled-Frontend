import { useState } from 'react'
import { Clock, ThumbsUp, ThumbsDown, PackageOpen, GripVertical } from 'lucide-react'
import { Badge } from '../../components/ui'

// Tablero kanban de solicitudes de material (vista alternativa a la tabla).
//
// Drag & drop con la API nativa de HTML5 — sin dependencias nuevas. Soltar una
// tarjeta en otra columna dispara `onDropEstado(solicitud, nuevoEstado)`; el
// dueño (SolicitudesMaterial) decide si eso es un PATCH directo de estatus o
// abrir el modal de entrega (APROBADA → ENTREGADA). El refresco del tablero
// llega solo por websocket: el backend emite `solicitud:changed` y el
// useResource de la página invalida — incluido el tablero de OTROS usuarios
// viendo la misma pantalla.
//
// Espejo de TRANSICIONES_VALIDAS del backend (inventario_api/solicitudes.py).
// Mantener sincronizado: si el server agrega una transición, agregarla aquí
// para que la columna se ilumine como destino válido. Un drop fuera del mapa
// ni siquiera se permite (el dragover no hace preventDefault), así que el
// usuario nunca ve el 409 de "transición inválida".
const TRANSICIONES = {
  PENDIENTE: ['APROBADA', 'RECHAZADA'],
  APROBADA: ['ENTREGADA', 'RECHAZADA', 'PENDIENTE'],
  RECHAZADA: ['PENDIENTE'],
  ENTREGADA: ['PENDIENTE'],
}

const COLUMNAS = [
  { key: 'PENDIENTE', label: 'Pendientes', icon: Clock, accent: 'border-t-amber-400' },
  { key: 'APROBADA', label: 'Aprobadas', icon: ThumbsUp, accent: 'border-t-emerald-400' },
  { key: 'RECHAZADA', label: 'Rechazadas', icon: ThumbsDown, accent: 'border-t-red-400' },
  { key: 'ENTREGADA', label: 'Entregadas', icon: PackageOpen, accent: 'border-t-blue-400' },
]

export default function SolicitudesKanban({
  solicitudes, isAdmin, onCardClick, onDropEstado, getStatusTone, isAprobadaConPendiente,
}) {
  // Tarjeta en vuelo: {id, estatus}. Vive en estado (no solo en dataTransfer)
  // porque dragover no puede leer dataTransfer por seguridad del browser, y
  // necesitamos saber el origen para iluminar solo columnas destino válidas.
  const [dragging, setDragging] = useState(null)
  const [overCol, setOverCol] = useState(null)

  const esDestinoValido = (colKey) =>
    dragging && colKey !== dragging.estatus && (TRANSICIONES[dragging.estatus] || []).includes(colKey)

  const porColumna = (key) => solicitudes.filter((s) => s.estatus === key)

  return (
    <div className="mt-4 flex gap-3 overflow-x-auto pb-2 items-start">
      {COLUMNAS.map((col) => {
        const Icon = col.icon
        const items = porColumna(col.key)
        const valido = esDestinoValido(col.key)
        const resaltada = valido && overCol === col.key
        return (
          <div
            key={col.key}
            onDragOver={(e) => {
              if (!valido) return
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              setOverCol(col.key)
            }}
            onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
            onDrop={(e) => {
              if (!valido) return
              e.preventDefault()
              const sol = solicitudes.find((s) => s.id === dragging.id)
              setDragging(null)
              setOverCol(null)
              if (sol) onDropEstado(sol, col.key)
            }}
            className={`flex-shrink-0 w-72 sm:w-80 rounded-xl border border-t-4 ${col.accent} transition-colors ${
              resaltada
                ? 'border-brand-400 dark:border-brand-600 bg-brand-50/60 dark:bg-brand-900/20'
                : valido
                  ? 'border-dashed border-brand-300 dark:border-brand-800 bg-white dark:bg-ink-900'
                  : 'border-ink-200 dark:border-ink-800 bg-ink-50/50 dark:bg-ink-950/30'
            }`}
          >
            <div className="px-3 py-2.5 flex items-center gap-2">
              <Icon size={15} className="text-ink-500 dark:text-ink-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-600 dark:text-ink-300">
                {col.label}
              </span>
              <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-ink-200/70 dark:bg-ink-800 text-[11px] font-bold text-ink-700 dark:text-ink-200">
                {items.length}
              </span>
            </div>

            <div className="px-2 pb-2 space-y-2 min-h-[120px] max-h-[65vh] overflow-y-auto scrollbar-thin">
              {items.length === 0 && (
                <div className="py-8 text-center text-xs text-ink-400 dark:text-ink-600 select-none">
                  {valido ? 'Suelta aquí' : 'Sin solicitudes'}
                </div>
              )}
              {items.map((s) => {
                const enVuelo = dragging?.id === s.id
                const parcial = isAprobadaConPendiente(s)
                return (
                  <div
                    key={s.id}
                    draggable={isAdmin}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/plain', String(s.id))
                      setDragging({ id: s.id, estatus: s.estatus })
                    }}
                    onDragEnd={() => { setDragging(null); setOverCol(null) }}
                    onClick={() => onCardClick(s)}
                    className={`group rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-3 shadow-sm transition-all cursor-pointer hover:border-brand-300 dark:hover:border-brand-700 hover:shadow ${
                      enVuelo ? 'opacity-40' : ''
                    } ${isAdmin ? 'active:cursor-grabbing' : ''}`}
                  >
                    <div className="flex items-center gap-1.5">
                      {isAdmin && (
                        <GripVertical
                          size={13}
                          className="text-ink-300 dark:text-ink-600 opacity-0 group-hover:opacity-100 transition-opacity -ml-1 cursor-grab"
                        />
                      )}
                      <span className="font-mono text-xs font-semibold text-brand-700 dark:text-brand-300">#{s.id}</span>
                      <span className="ml-auto text-[11px] text-ink-400 dark:text-ink-500">
                        {new Date(s.fecha_creacion).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-ink-900 dark:text-ink-100 truncate">
                      {s.solicitante_nombre}
                    </p>
                    <p className="text-xs text-ink-500 dark:text-ink-400 truncate">{s.proyecto || 'Sin proyecto'}</p>
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      <Badge tone={getStatusTone(s.estatus)} dot>{s.detalles?.length || 0} ítem{(s.detalles?.length || 0) === 1 ? '' : 's'}</Badge>
                      {parcial && (
                        <span className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold uppercase tracking-wide">
                          Entrega parcial
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
