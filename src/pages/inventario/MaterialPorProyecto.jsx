import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  PackageOpen, RefreshCw, Search, Layers, Warehouse, ChevronRight,
} from 'lucide-react'
import {
  PageHeader, Button, Card, Input, Skeleton, EmptyState, InfoTip,
} from '../../components/ui'
import { getResumenAsignacion } from '../../api/inventario'
import { extractApiError } from '../../utils/apiError'
import { useResource } from '../../hooks/useResource'

const money = (v) =>
  (Number(v) || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN',
                                             maximumFractionDigits: 0 })
const num = (v) =>
  (Number(v) || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 })

/**
 * Tarjeta de un proyecto (o de General).
 *
 * Tres números y nada más: cuántos materiales distintos, cuántas unidades y
 * cuánto valen. Es lo justo para decidir dónde entrar — cualquier dato extra
 * aquí compite con esa decisión en vez de ayudarla.
 */
function TarjetaProyecto({ t, onClick }) {
  const general = t.es_general
  const vacio = t.materiales === 0

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'group text-left rounded-xl border p-4 transition-all focus-ring',
        'hover:-translate-y-0.5 hover:shadow-card',
        general
          // General se ve distinto a propósito: no es un proyecto más, es el
          // stock libre del que sale casi toda asignación.
          ? 'border-brand-500/30 bg-gradient-to-br from-brand-50 to-white dark:from-brand-900/20 dark:to-ink-900 ring-1 ring-brand-500/20'
          : 'border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 hover:border-brand-400/50',
      ].join(' ')}
    >
      <div className="flex items-start gap-2.5">
        <div className={[
          'shrink-0 rounded-lg p-2',
          general
            ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
            : 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400',
        ].join(' ')}>
          {general ? <Warehouse size={16} /> : <Layers size={16} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className={[
            'font-bold text-sm truncate',
            general ? 'text-brand-800 dark:text-brand-200' : 'text-ink-900 dark:text-ink-100 font-mono',
          ].join(' ')}>
            {t.numero_proyecto}
          </div>
          <div className="text-xs text-ink-500 truncate">{t.nombre || '—'}</div>
        </div>
        <ChevronRight
          size={16}
          className="shrink-0 text-ink-300 group-hover:text-brand-500 transition-colors mt-1"
        />
      </div>

      {vacio ? (
        <p className="mt-3 text-xs text-ink-400 italic">
          Sin material apartado — entra para asignarle.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div>
            <div className="text-base font-extrabold tabular-nums leading-tight text-ink-900 dark:text-ink-100">
              {t.materiales}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-ink-400 font-semibold">Materiales</div>
          </div>
          <div>
            <div className="text-base font-extrabold tabular-nums leading-tight text-ink-900 dark:text-ink-100">
              {num(t.unidades)}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-ink-400 font-semibold">Unidades</div>
          </div>
          <div>
            <div className="text-base font-extrabold tabular-nums leading-tight text-emerald-700 dark:text-emerald-300 truncate">
              {money(t.valor)}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-ink-400 font-semibold">Valor</div>
          </div>
        </div>
      )}
    </button>
  )
}

export default function MaterialPorProyecto() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [refrescando, setRefrescando] = useState(false)

  const { data, loading, error, refetch } = useResource(
    ['resumen-asignacion'],
    () => getResumenAsignacion(),
    {
      staleMs: 30_000,
      // Cualquier movimiento de stock cambia estos números, no solo los de esta
      // pantalla: una entrega hecha desde Solicitudes también mueve buckets.
      invalidateOn: ['producto:changed', 'movimiento:changed', 'proyecto:changed'],
    },
  )

  useEffect(() => {
    if (error) toast.error(extractApiError(error, 'Error al cargar el resumen'))
  }, [error])

  // `loading` de useResource es `!data && !error`: nunca es true al refrescar.
  // Sin este estado propio el botón no da señal y la gente vuelve a hacer clic
  // hasta toparse con el límite de peticiones.
  const refrescar = async () => {
    if (refrescando) return
    setRefrescando(true)
    try { await refetch() } finally { setRefrescando(false) }
  }

  const tarjetas = data?.tarjetas ?? []

  const filtradas = useMemo(() => {
    const s = search.trim().toLowerCase()
    if (!s) return tarjetas
    // General se queda siempre visible: es el origen de casi toda asignación y
    // esconderlo por un filtro de texto rompe el flujo principal.
    return tarjetas.filter((t) =>
      t.es_general ||
      t.numero_proyecto?.toLowerCase().includes(s) ||
      t.nombre?.toLowerCase().includes(s),
    )
  }, [tarjetas, search])

  const proyectos = tarjetas.filter((t) => !t.es_general)
  const conMaterial = proyectos.filter((t) => t.materiales > 0).length

  return (
    <div>
      <PageHeader
        icon={PackageOpen}
        title="Material por proyecto"
        description="Qué material tiene apartado cada obra, y cómo asignárselo."
        actions={
          <Button
            variant="secondary"
            leftIcon={<RefreshCw size={14} className={refrescando ? 'animate-spin' : ''} />}
            onClick={refrescar}
            disabled={refrescando}
          >
            {refrescando ? 'Actualizando…' : 'Actualizar'}
          </Button>
        }
      />

      <Card className="mt-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            type="search"
            leftIcon={<Search size={15} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar proyecto por número o nombre…"
            wrapperClassName="flex-1 min-w-[220px] max-w-md"
          />
          {!loading && (
            <span className="text-xs text-ink-500 tabular-nums inline-flex items-center gap-1.5">
              {conMaterial} de {proyectos.length} proyectos con material apartado
              <InfoTip text="Salen todos los proyectos activos, incluso los que aún no tienen nada: entrar en uno vacío es justo el punto de partida para asignarle." />
            </span>
          )}
        </div>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : tarjetas.length === 0 ? (
        <EmptyState
          icon={PackageOpen}
          title="Sin proyectos activos"
          description="No hay proyectos activos a los que asignar material. Crea uno desde el módulo de Proyectos."
        />
      ) : filtradas.length <= 1 && search.trim() ? (
        <EmptyState
          icon={Search}
          title="Sin coincidencias"
          description="Ningún proyecto activo coincide con la búsqueda."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-4">
          {filtradas.map((t) => (
            <TarjetaProyecto
              key={t.proyecto_id ?? 'general'}
              t={t}
              onClick={() => navigate(
                // General tiene su propia pantalla dentro de la sección: es el
                // origen del flujo (llega material, se guarda libre, se
                // reparte), así que sacar al usuario de aquí para verlo dejaba
                // el camino principal a medias.
                t.es_general
                  ? '/inventario/material-proyecto/general'
                  : `/inventario/material-proyecto/${t.proyecto_id}`,
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}
