import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  FileText, Calendar, FolderOpen, ChartBar, FileSpreadsheet,
  CheckCircle2, CalendarX, X,
} from 'lucide-react'
import {
  PageHeader, Button, Pagination, EmptyState, Skeleton, Badge,
} from '../../components/ui'
import { listarHistorico, exportarExcelHistorico } from '../../api/historico'
import { extractApiError } from '../../utils/apiError'

const PER_PAGE = 20
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function fmtFechaCompleta(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso + 'T00:00:00')
    return `${d.getDate()} de ${MESES[d.getMonth()]}, ${d.getFullYear()}`
  } catch {
    return iso
  }
}

function SemanaCard({ semana, onExport, exportingFecha }) {
  const navigate = useNavigate()
  const isExporting = exportingFecha === semana.fecha_inicio
  const fechaIso = semana.fecha_inicio
  const proyectos = semana.proyectos || []
  const visibleProyectos = proyectos.slice(0, 4)
  const restoProyectos = proyectos.length - 4

  return (
    <div className="grid grid-cols-1 md:grid-cols-[160px_1fr_auto] bg-white dark:bg-ink-900 rounded-xl border border-ink-200 dark:border-ink-800 border-l-4 border-l-brand-500 mb-3 overflow-hidden shadow-card hover:shadow-elevated hover:-translate-y-px transition-all">
      {/* Date panel */}
      <div className="bg-gradient-to-br from-brand-600 to-brand-700 text-white px-4 py-5 flex flex-col items-center justify-center text-center">
        <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">Semana</div>
        <div className="text-sm font-bold mt-1 leading-snug break-words">
          {fmtFechaCompleta(fechaIso)}
        </div>
        <div className="mt-2 inline-flex items-center gap-1 bg-white/20 text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
          <FolderOpen size={11} />
          {proyectos.length} proyecto{proyectos.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Projects */}
      <div className="p-4 border-r border-ink-200 dark:border-ink-800 flex flex-col justify-center gap-1.5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400 mb-1">
          Proyectos consolidados
        </div>
        {visibleProyectos.map((p) => (
          <div key={p.id} className="flex items-center gap-2 text-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500 flex-shrink-0" />
            <div className="min-w-0">
              <span className="font-semibold text-ink-900 dark:text-ink-100">{p.nombre || `Proyecto ${p.numero_proyecto}`}</span>
              <span className="text-ink-500 dark:text-ink-400 text-xs">
                {' · '}
                {p.coordinador ? p.coordinador.full_name : 'Sin asignar'}
              </span>
            </div>
          </div>
        ))}
        {restoProyectos > 0 && (
          <div className="pl-4 text-xs italic text-ink-500 dark:text-ink-400">+ {restoProyectos} más…</div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 flex flex-col items-end justify-center gap-2 min-w-[180px]">
        <Badge tone="success" leftIcon={<CheckCircle2 size={11} />}>Pagada / Cerrada</Badge>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<ChartBar size={14} />}
          onClick={() => navigate(`/historico/${fechaIso}`)}
        >
          Ver desglose
        </Button>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<FileSpreadsheet size={14} />}
          loading={isExporting}
          onClick={() => onExport(fechaIso)}
        >
          Exportar Excel
        </Button>
      </div>
    </div>
  )
}

export default function HistoricoList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10))
  const [searchDate, setSearchDate] = useState(searchParams.get('search_date') || '')
  const [data, setData] = useState({ items: [], total: 0, page: 1, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [exportingFecha, setExportingFecha] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listarHistorico({ page, searchDate, perPage: PER_PAGE })
      .then((res) => { if (!cancelled) setData(res) })
      .catch((err) => {
        if (cancelled) return
        toast.error(extractApiError(err, 'Error al cargar histórico'))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [page, searchDate])

  useEffect(() => {
    const next = new URLSearchParams()
    if (searchDate) next.set('search_date', searchDate)
    if (page !== 1) next.set('page', String(page))
    setSearchParams(next, { replace: true })
  }, [searchDate, page])

  const onExport = async (fecha) => {
    setExportingFecha(fecha)
    try {
      await exportarExcelHistorico(fecha)
    } catch (err) {
      toast.error(extractApiError(err, 'Error al exportar Excel'))
    } finally {
      setExportingFecha(null)
    }
  }

  return (
    <>
      <PageHeader
        icon={FileText}
        title="Histórico de pagos de nómina"
        description="Consulta o imprime las nóminas globales calculadas y aprobadas, separadas por proyecto."
      />

      <div className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-ink-900 rounded-lg border border-ink-200 dark:border-ink-800 mb-6 w-fit">
        <Calendar size={16} className="text-ink-400" />
        <label className="text-sm font-medium text-ink-600 dark:text-ink-300 whitespace-nowrap">
          Filtrar por fecha:
        </label>
        <input
          type="date"
          value={searchDate}
          onChange={(e) => { setSearchDate(e.target.value); setPage(1) }}
          className="border border-ink-200 dark:border-ink-700 bg-transparent rounded-md px-2 py-1 text-sm text-ink-800 dark:text-ink-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
        />
        {searchDate && (
          <button
            type="button"
            onClick={() => { setSearchDate(''); setPage(1) }}
            className="text-ink-400 hover:text-red-500 transition-colors p-1"
            aria-label="Limpiar filtro"
            title="Limpiar filtro"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : data.items.length === 0 ? (
        searchDate ? (
          <EmptyState
            icon={CalendarX}
            title="Sin resultados"
            description="No se encontraron nóminas para la fecha seleccionada."
          />
        ) : (
          <EmptyState
            icon={FileText}
            title="Sin histórico disponible"
            description="Aún no has generado ni guardado ninguna nómina global."
          />
        )
      ) : (
        <>
          {data.items.map((s) => (
            <SemanaCard
              key={s.fecha_inicio}
              semana={s}
              onExport={onExport}
              exportingFecha={exportingFecha}
            />
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
