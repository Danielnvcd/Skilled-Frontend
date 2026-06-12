import { useEffect } from 'react'
import toast from 'react-hot-toast'
import {
  Banknote, CalendarClock, HandCoins, Settings2, TrendingUp, Wallet,
} from 'lucide-react'
import { PageHeader, Skeleton, Badge, EmptyState } from '../../components/ui'
import { obtenerPanelFinanzas } from '../../api/finanzas'
import { extractApiError } from '../../utils/apiError'
import { useResource } from '../../hooks/useResource'

function fmtMoney(n) {
  return (n ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
}

function fmtFecha(iso) {
  if (!iso) return ''
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

// Mismo patrón visual que el StatCard del Dashboard admin: chip neutro
// monocromo + valor protagonista. Sin drill-down: el rol finanzas (v1) solo
// tiene este panel, no las listas detrás de cada número.
function StatCard({ label, value, sub, Icon }) {
  return (
    <div className="bg-white dark:bg-ink-900 rounded-xl border border-ink-200 dark:border-ink-800 p-5 flex items-center gap-4">
      <div className="h-12 w-12 rounded-lg inline-flex items-center justify-center flex-shrink-0 bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200">
        <Icon size={22} strokeWidth={1.8} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">{label}</p>
        <p className="text-2xl font-semibold tabular-nums text-ink-900 dark:text-ink-100 mt-1 leading-none truncate" title={String(value)}>
          {value}
        </p>
        {sub && <p className="text-[11px] text-ink-500 dark:text-ink-400 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

export default function FinanzasPanel() {
  const { data, loading, error } = useResource(
    'finanzas-panel',
    () => obtenerPanelFinanzas(),
    // Eventos post-commit del backend: prenómina guardada/cerrada, abonos o
    // altas de préstamo, y descuentos de ajuste — todos mueven los agregados.
    { staleMs: 120_000, invalidateOn: ['prenomina:changed', 'prestamo:changed', 'ajuste:changed'] },
  )

  useEffect(() => {
    if (error) toast.error(extractApiError(error, 'Error al cargar el panel financiero'))
  }, [error])

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-16 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    )
  }

  const semanas = data?.ultimas_semanas ?? []
  const maxTotal = Math.max(...semanas.map((s) => s.total), 1)
  const enProceso = data?.semana_en_proceso

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Wallet}
        title="Panel financiero"
        description="Dispersión de nómina, préstamos por recuperar y ajustes pendientes."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={`Dispersado ${new Date().getFullYear()}`}
          value={fmtMoney(data?.dispersado_anual?.total)}
          sub={`${data?.dispersado_anual?.semanas ?? 0} semana(s) aprobada(s)`}
          Icon={TrendingUp}
        />
        <StatCard
          label="Última semana pagada"
          value={fmtMoney(data?.ultima_semana?.total)}
          sub={data?.ultima_semana
            ? `Semana del ${fmtFecha(data.ultima_semana.fecha_str)} · ${data.ultima_semana.trabajadores} trabajador(es)`
            : 'Sin semanas aprobadas'}
          Icon={Banknote}
        />
        <StatCard
          label="Préstamos por recuperar"
          value={fmtMoney(data?.prestamos?.por_recuperar)}
          sub={`${data?.prestamos?.activos ?? 0} préstamo(s) activo(s)`}
          Icon={HandCoins}
        />
        <StatCard
          label="Ajustes Inbursa por cobrar"
          value={fmtMoney(data?.ajustes_pendientes?.monto)}
          sub={`${data?.ajustes_pendientes?.registros ?? 0} descuento(s) pendiente(s)`}
          Icon={Settings2}
        />
      </div>

      {/* Próximo egreso: la semana con reportes cerrados aún sin aprobar */}
      {enProceso && (
        <div className="bg-white dark:bg-ink-900 rounded-xl border border-ink-200 dark:border-ink-800 border-l-[3px] border-l-amber-500 p-4 flex items-center gap-4 flex-wrap">
          <div className="h-10 w-10 rounded-lg inline-flex items-center justify-center flex-shrink-0 bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300">
            <CalendarClock size={18} strokeWidth={1.8} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">
              Nómina en proceso — semana del {fmtFecha(enProceso.fecha_str)}
            </p>
            <p className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">
              {enProceso.estado === 'ABIERTA'
                ? `Cálculo en edición · egreso estimado ${fmtMoney(enProceso.total_estimado)}`
                : 'Reportes de horas cerrados, cálculo aún no generado'}
            </p>
          </div>
          <Badge tone={enProceso.estado === 'ABIERTA' ? 'warning' : 'brand'} dot>
            {enProceso.estado === 'ABIERTA' ? 'En edición' : 'Por calcular'}
          </Badge>
        </div>
      )}

      {/* Dispersión semanal: barras CSS simples (sin librería de charts — el
          panel debe ser ligero; si crece, migrar a CorporateCharts). */}
      <div className="bg-white dark:bg-ink-900 rounded-xl border border-ink-200 dark:border-ink-800 p-4">
        <div className="flex items-center gap-2 pb-3 mb-3 border-b border-ink-100 dark:border-ink-800/80 text-ink-800 dark:text-ink-200 font-semibold text-sm">
          <Banknote size={15} className="text-ink-400 dark:text-ink-500" strokeWidth={2} />
          Dispersión por semana
          <span className="text-[11px] font-normal text-ink-500 dark:text-ink-400">
            últimas {semanas.length} semana(s) aprobada(s)
          </span>
        </div>
        {semanas.length === 0 ? (
          <EmptyState
            icon={Banknote}
            title="Sin nóminas aprobadas"
            description="Cuando el administrador cierre una prenómina, la dispersión aparecerá aquí."
          />
        ) : (
          <ul className="space-y-2">
            {semanas.map((s) => (
              <li key={s.fecha_str} className="flex items-center gap-3">
                <span className="w-28 flex-shrink-0 text-xs text-ink-600 dark:text-ink-300 tabular-nums">
                  {fmtFecha(s.fecha_str)}
                </span>
                <div className="flex-1 h-5 bg-ink-50 dark:bg-ink-800/60 rounded overflow-hidden">
                  <div
                    className="h-full bg-brand-500/80 dark:bg-brand-500/60 rounded transition-all duration-500"
                    style={{ width: `${Math.max((s.total / maxTotal) * 100, 2)}%` }}
                  />
                </div>
                <span className="w-28 flex-shrink-0 text-right text-xs font-semibold tabular-nums text-ink-800 dark:text-ink-100">
                  {fmtMoney(s.total)}
                </span>
                <span className="w-16 flex-shrink-0 text-right text-[11px] text-ink-500 dark:text-ink-400 tabular-nums">
                  {s.trabajadores} trab.
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
