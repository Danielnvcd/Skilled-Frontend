import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  PieChart, Search, ChevronRight, TrendingUp, TrendingDown,
  Wallet, FileSpreadsheet, CalendarRange, UserCircle2,
} from 'lucide-react'
import {
  PageHeader, Button, Input, Pagination, EmptyState, Skeleton, Badge,
} from '../../components/ui'
import { listarProyectoTotal, exportarExcelProyecto } from '../../api/proyectoTotal'
import { extractApiError } from '../../utils/apiError'
import { useResource } from '../../hooks/useResource'

const PER_PAGE = 20

const fmtMoney = (n) => new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN', maximumFractionDigits: 2,
}).format(Number(n) || 0)

function fmtFechaCompleta(iso) {
  if (!iso) return ''
  try {
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    const d = new Date(iso + 'T00:00:00')
    return `${d.getDate()} de ${meses[d.getMonth()]}, ${d.getFullYear()}`
  } catch {
    return iso
  }
}

function Money({ value, mutedZero = false, className = '' }) {
  const n = Number(value) || 0
  if (n === 0 && mutedZero) {
    return <span className="text-ink-300 dark:text-ink-700">—</span>
  }
  return <span className={`font-mono tabular-nums ${className}`}>{fmtMoney(n)}</span>
}

function Kpi({ tone, label, value, Icon }) {
  const tones = {
    success: {
      wrap: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800/60',
      iconWrap: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-800/40 dark:text-emerald-300',
      value: 'text-emerald-700 dark:text-emerald-300',
    },
    danger: {
      wrap: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/60',
      iconWrap: 'bg-red-100 text-red-700 dark:bg-red-800/40 dark:text-red-300',
      value: 'text-red-700 dark:text-red-300',
    },
    info: {
      wrap: 'bg-sky-50 border-sky-200 dark:bg-sky-900/20 dark:border-sky-800/60',
      iconWrap: 'bg-sky-100 text-sky-700 dark:bg-sky-800/40 dark:text-sky-300',
      value: 'text-sky-700 dark:text-sky-300',
    },
  }
  const t = tones[tone]
  return (
    <div className={`rounded-lg border p-4 flex items-center gap-3 ${t.wrap}`}>
      <div className={`h-10 w-10 rounded-lg inline-flex items-center justify-center flex-shrink-0 ${t.iconWrap}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 dark:text-ink-400">{label}</div>
        <div className={`text-lg font-bold tabular-nums truncate ${t.value}`}>{fmtMoney(value)}</div>
      </div>
    </div>
  )
}

function SemanasTable({ semanas, grand }) {
  return (
    <div className="overflow-x-auto border border-ink-200 dark:border-ink-800 rounded-lg scrollbar-thin">
      <table className="w-full text-xs min-w-[1100px]">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide font-bold">
            <th rowSpan={2} className="px-2 py-2 text-left bg-ink-50 dark:bg-ink-800/60 text-ink-600 dark:text-ink-300 border-b border-ink-200 dark:border-ink-700">Semana</th>
            <th rowSpan={2} className="px-2 py-2 text-center bg-ink-50 dark:bg-ink-800/60 text-ink-600 dark:text-ink-300 border-b border-ink-200 dark:border-ink-700">Trab.</th>
            <th colSpan={4} className="px-2 py-2 text-center bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-800/60 border-r-2 border-r-emerald-300 dark:border-r-emerald-700/60">
              <span className="inline-flex items-center gap-1.5"><TrendingUp size={12} /> Percepciones</span>
            </th>
            <th colSpan={6} className="px-2 py-2 text-center bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-b border-red-200 dark:border-red-800/60 border-r-2 border-r-red-300 dark:border-r-red-700/60">
              <span className="inline-flex items-center gap-1.5"><TrendingDown size={12} /> Deducciones</span>
            </th>
            <th rowSpan={2} className="px-2 py-2 text-right bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 border-b border-sky-200 dark:border-sky-800/60">Neto</th>
          </tr>
          <tr className="text-[11px] font-semibold text-ink-700 dark:text-ink-200">
            <th className="px-2 py-2 text-right bg-emerald-50/70 dark:bg-emerald-900/10 border-b-2 border-ink-200 dark:border-ink-700">Viáticos</th>
            <th className="px-2 py-2 text-right bg-emerald-50/70 dark:bg-emerald-900/10 border-b-2 border-ink-200 dark:border-ink-700">Festivos</th>
            <th className="px-2 py-2 text-right bg-emerald-50/70 dark:bg-emerald-900/10 border-b-2 border-ink-200 dark:border-ink-700">Dep. Otros</th>
            <th className="px-2 py-2 text-right bg-emerald-50/70 dark:bg-emerald-900/10 border-b-2 border-ink-200 dark:border-ink-700 border-r-2 border-r-emerald-300 dark:border-r-emerald-700/60">Dep. Prést.</th>
            <th className="px-2 py-2 text-right bg-red-50/70 dark:bg-red-900/10 border-b-2 border-ink-200 dark:border-ink-700">INFONAVIT</th>
            <th className="px-2 py-2 text-right bg-red-50/70 dark:bg-red-900/10 border-b-2 border-ink-200 dark:border-ink-700">Aj. INBURSA</th>
            <th className="px-2 py-2 text-right bg-red-50/70 dark:bg-red-900/10 border-b-2 border-ink-200 dark:border-ink-700">Desc. Otros</th>
            <th className="px-2 py-2 text-right bg-red-50/70 dark:bg-red-900/10 border-b-2 border-ink-200 dark:border-ink-700">Desc. Prést.</th>
            <th className="px-2 py-2 text-right bg-red-50/70 dark:bg-red-900/10 border-b-2 border-ink-200 dark:border-ink-700">Incidencias</th>
            <th className="px-2 py-2 text-right bg-red-50/70 dark:bg-red-900/10 border-b-2 border-ink-200 dark:border-ink-700 border-r-2 border-r-red-300 dark:border-r-red-700/60">Recup. Manual</th>
          </tr>
        </thead>
        <tbody>
          {semanas.map((w, idx) => (
            <tr key={idx} className="border-b border-ink-100 dark:border-ink-800 hover:bg-ink-50 dark:hover:bg-ink-800/40">
              <td className="px-2 py-2 text-left font-medium text-ink-700 dark:text-ink-200 whitespace-nowrap">{fmtFechaCompleta(w.fecha_inicio)}</td>
              <td className="px-2 py-2 text-center font-semibold text-ink-500 dark:text-ink-400">{w.num_trabajadores}</td>
              <td className="px-2 py-2 text-right bg-emerald-50/30 dark:bg-emerald-900/5"><Money value={w.pago_viaticos} mutedZero /></td>
              <td className="px-2 py-2 text-right bg-emerald-50/30 dark:bg-emerald-900/5"><Money value={w.pago_festivos} mutedZero /></td>
              <td className="px-2 py-2 text-right bg-emerald-50/30 dark:bg-emerald-900/5"><Money value={w.depositos_otros} mutedZero /></td>
              <td className="px-2 py-2 text-right bg-emerald-50/30 dark:bg-emerald-900/5 border-r-2 border-r-emerald-200 dark:border-r-emerald-800/60"><Money value={w.depositos_prestamos} mutedZero /></td>
              <td className="px-2 py-2 text-right bg-red-50/30 dark:bg-red-900/5"><Money value={w.descuento_infonavit} mutedZero /></td>
              <td className="px-2 py-2 text-right bg-red-50/30 dark:bg-red-900/5"><Money value={w.ajuste_inbursa} mutedZero /></td>
              <td className="px-2 py-2 text-right bg-red-50/30 dark:bg-red-900/5"><Money value={w.descuentos_otros} mutedZero /></td>
              <td className="px-2 py-2 text-right bg-red-50/30 dark:bg-red-900/5"><Money value={w.descuento_prestamos} mutedZero /></td>
              <td className="px-2 py-2 text-right bg-red-50/30 dark:bg-red-900/5"><Money value={w.descuento_incidencias} mutedZero /></td>
              <td className="px-2 py-2 text-right bg-red-50/30 dark:bg-red-900/5 border-r-2 border-r-red-200 dark:border-r-red-800/60"><Money value={w.recuperacion_manual} mutedZero /></td>
              <td className="px-2 py-2 text-right bg-sky-50/40 dark:bg-sky-900/10 font-bold text-sky-700 dark:text-sky-300"><Money value={w.total_a_pagar} /></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-bold text-[11px]">
            <td className="px-2 py-2.5 text-left uppercase tracking-wider text-ink-500 dark:text-ink-400 bg-ink-50 dark:bg-ink-800/60 border-t-2 border-ink-300 dark:border-ink-700">Acumulado</td>
            <td className="px-2 py-2.5 text-center bg-ink-50 dark:bg-ink-800/60 border-t-2 border-ink-300 dark:border-ink-700">{grand.trabajadores_count}</td>
            <td className="px-2 py-2.5 text-right bg-emerald-100/60 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border-t-2 border-ink-300 dark:border-ink-700"><Money value={grand.pago_viaticos} /></td>
            <td className="px-2 py-2.5 text-right bg-emerald-100/60 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border-t-2 border-ink-300 dark:border-ink-700"><Money value={grand.pago_festivos} /></td>
            <td className="px-2 py-2.5 text-right bg-emerald-100/60 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border-t-2 border-ink-300 dark:border-ink-700"><Money value={grand.depositos_otros} /></td>
            <td className="px-2 py-2.5 text-right bg-emerald-100/60 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border-t-2 border-ink-300 dark:border-ink-700 border-r-2 border-r-emerald-300 dark:border-r-emerald-700/60"><Money value={grand.depositos_prestamos} /></td>
            <td className="px-2 py-2.5 text-right bg-red-100/60 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-t-2 border-ink-300 dark:border-ink-700"><Money value={grand.descuento_infonavit} /></td>
            <td className="px-2 py-2.5 text-right bg-red-100/60 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-t-2 border-ink-300 dark:border-ink-700"><Money value={grand.ajuste_inbursa} /></td>
            <td className="px-2 py-2.5 text-right bg-red-100/60 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-t-2 border-ink-300 dark:border-ink-700"><Money value={grand.descuentos_otros} /></td>
            <td className="px-2 py-2.5 text-right bg-red-100/60 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-t-2 border-ink-300 dark:border-ink-700"><Money value={grand.descuento_prestamos} /></td>
            <td className="px-2 py-2.5 text-right bg-red-100/60 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-t-2 border-ink-300 dark:border-ink-700"><Money value={grand.descuento_incidencias} /></td>
            <td className="px-2 py-2.5 text-right bg-red-100/60 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-t-2 border-ink-300 dark:border-ink-700 border-r-2 border-r-red-300 dark:border-r-red-700/60"><Money value={grand.recuperacion_manual} /></td>
            <td className="px-2 py-2.5 text-right bg-sky-200/60 dark:bg-sky-900/40 text-sky-900 dark:text-sky-200 text-sm border-t-2 border-ink-300 dark:border-ink-700"><Money value={grand.total_a_pagar} /></td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function ProyectoCard({ pd }) {
  const [open, setOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const { proyecto, semanas, num_semanas, grand } = pd

  const handleExport = async () => {
    setExporting(true)
    try {
      await exportarExcelProyecto(proyecto.id)
    } catch (err) {
      toast.error(extractApiError(err, 'Error al exportar Excel'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="bg-white dark:bg-ink-900 rounded-xl border border-ink-200 dark:border-ink-800 mb-4 overflow-hidden shadow-card hover:shadow-elevated transition-shadow">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 border-l-4 border-l-brand-500 hover:bg-ink-50 dark:hover:bg-ink-800/40 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
            open
              ? 'bg-brand-500 text-white rotate-90'
              : 'bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300'
          }`}>
            <ChevronRight size={14} />
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold text-ink-900 dark:text-ink-100 truncate">
              Proyecto {proyecto.numero_proyecto}
            </p>
            <p className="text-xs text-ink-500 dark:text-ink-400 truncate flex items-center gap-1">
              {proyecto.nombre || 'Sin nombre'}
              {proyecto.coordinador && (
                <>
                  <span className="mx-1">·</span>
                  <UserCircle2 size={11} />
                  <span>{proyecto.coordinador.full_name}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <Badge tone="brand" leftIcon={<CalendarRange size={11} />}>
            {num_semanas} semana{num_semanas !== 1 ? 's' : ''}
          </Badge>
          <span className="text-base font-bold tabular-nums text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800/60 px-3 py-1 rounded-md">
            {fmtMoney(grand.total_a_pagar)}
          </span>
        </div>
      </button>

      {open && (
        <div className="border-t border-ink-200 dark:border-ink-800 p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Kpi tone="success" label="Total percepciones" value={grand.total_percepciones} Icon={TrendingUp} />
            <Kpi tone="danger" label="Total deducciones" value={grand.total_deducciones} Icon={TrendingDown} />
            <Kpi tone="info" label="Neto depositado" value={grand.total_a_pagar} Icon={Wallet} />
          </div>

          <div className="flex justify-end">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<FileSpreadsheet size={14} />}
              loading={exporting}
              onClick={handleExport}
            >
              Exportar Excel
            </Button>
          </div>

          <SemanasTable semanas={semanas} grand={grand} />
        </div>
      )}
    </div>
  )
}

export default function ProyectoTotal() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10))
  const [q, setQ] = useState(searchParams.get('q') || '')
  const [qInput, setQInput] = useState(q)

  const {
    data: rawData,
    loading,
    error,
  } = useResource(
    ['proyecto-total', { page, q }],
    () => listarProyectoTotal({ page, q, perPage: PER_PAGE }),
    { staleMs: 60_000 },
  )
  const data = rawData ?? { items: [], total: 0, page: 1, pages: 1 }

  useEffect(() => {
    if (error) toast.error(extractApiError(error, 'Error al cargar proyectos'))
  }, [error])

  useEffect(() => {
    const next = new URLSearchParams()
    if (q) next.set('q', q)
    if (page !== 1) next.set('page', String(page))
    setSearchParams(next, { replace: true })
  }, [q, page])

  const onSearch = (e) => {
    e.preventDefault()
    setPage(1)
    setQ(qInput.trim())
  }

  return (
    <>
      <PageHeader
        icon={PieChart}
        title="Proyecto Total"
        description="Resumen acumulado de nómina por proyecto — todas las semanas procesadas."
      />

      <form onSubmit={onSearch} className="mb-4 flex flex-col sm:flex-row gap-2 sm:items-end max-w-md">
        <Input
          wrapperClassName="flex-1"
          label="Buscar"
          placeholder="Proyecto o número"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          leftIcon={<Search size={15} />}
        />
        <div className="flex gap-2">
          <Button type="submit" variant="primary">Buscar</Button>
          {q && (
            <Button type="button" variant="ghost" onClick={() => { setQInput(''); setQ(''); setPage(1) }}>
              Limpiar
            </Button>
          )}
        </div>
      </form>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={PieChart}
          title="Sin datos disponibles"
          description={q
            ? 'Ningún proyecto coincide con la búsqueda.'
            : 'Aún no existen proyectos con nóminas procesadas y cerradas.'}
        />
      ) : (
        <>
          {data.items.map((pd) => (
            <ProyectoCard key={pd.proyecto.id} pd={pd} />
          ))}

          <Pagination
            page={(data.page || 1) - 1}
            totalPages={data.pages || 1}
            totalElements={data.total ?? 0}
            size={data.per_page || PER_PAGE}
            onChange={(newZeroPage) => setPage(newZeroPage + 1)}
          />
        </>
      )}
    </>
  )
}
