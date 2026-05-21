import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Printer, Users, TrendingUp, TrendingDown, Wallet,
  Plus, Minus, Inbox, FileText,
} from 'lucide-react'
import {
  PageHeader, Button, EmptyState, Skeleton, Badge,
} from '../../components/ui'
import { obtenerDetalle, imprimirProyectoPdf } from '../../api/historico'
import { extractApiError } from '../../utils/apiError'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const fmtMoney = (n) => new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN', maximumFractionDigits: 2,
}).format(Number(n) || 0)

function fmtFechaCompleta(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso + 'T00:00:00')
    return `${d.getDate()} de ${MESES[d.getMonth()]}, ${d.getFullYear()}`
  } catch {
    return iso
  }
}

function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function KpiCell({ tone, label, value, Icon }) {
  const tones = {
    purple: { wrap: 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300', value: 'text-ink-900 dark:text-ink-100' },
    green: { wrap: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', value: 'text-emerald-700 dark:text-emerald-300' },
    red: { wrap: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', value: 'text-red-600 dark:text-red-300' },
    blue: { wrap: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300', value: 'text-sky-700 dark:text-sky-300' },
  }
  const t = tones[tone]
  return (
    <div className="px-4 py-3 flex items-center gap-3 border-r border-ink-200 dark:border-ink-800 last:border-r-0">
      <div className={`h-9 w-9 rounded-md inline-flex items-center justify-center flex-shrink-0 ${t.wrap}`}>
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 dark:text-ink-400">{label}</div>
        <div className={`text-base font-bold tabular-nums truncate ${t.value}`}>{value}</div>
      </div>
    </div>
  )
}

function BreakdownItem({ label, value, sign = '+', tone = 'green' }) {
  const v = Number(value) || 0
  if (v <= 0) return null
  const color = tone === 'green' ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'
  return (
    <div className="flex justify-between items-center gap-2 py-0.5 text-xs">
      <span className="text-ink-500 dark:text-ink-400">{label}</span>
      <span className={`font-semibold tabular-nums ${color}`}>{sign === '+' ? '' : '-'}{fmtMoney(v)}</span>
    </div>
  )
}

function WorkerRow({ pren }) {
  const t = pren.trabajador
  const nombreCompleto = t?.nombre_completo || ''
  const totalDeducciones = Number(pren.total_deducciones) || 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_auto] border border-ink-200 dark:border-ink-800 rounded-lg overflow-hidden transition-shadow hover:shadow-card">
      {/* Identity */}
      <div className="px-4 py-3 flex items-center gap-3 border-r border-ink-200 dark:border-ink-800 bg-ink-50/60 dark:bg-ink-800/40">
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-600 to-brand-700 text-white font-bold text-sm flex items-center justify-center flex-shrink-0">
          {initials(nombreCompleto)}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-sm text-ink-900 dark:text-ink-100 truncate">{nombreCompleto}</div>
          <div className="font-mono text-xs text-ink-500 dark:text-ink-400">#{t?.no_empleado}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {t?.tipo_jornada && <Badge tone="neutral">{t.tipo_jornada}</Badge>}
            {pren.tipo_pago && <Badge tone="brand">{pren.tipo_pago}</Badge>}
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <div className="px-4 py-3 flex gap-6 flex-wrap items-start">
        <div className="flex-1 min-w-[140px]">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-800/60 pb-1 mb-1.5 inline-flex items-center gap-1">
            <Plus size={10} /> Percepciones
          </div>
          <BreakdownItem label="Salario Base" value={pren.salario_base} />
          <BreakdownItem label="Viáticos" value={pren.pago_viaticos} />
          <BreakdownItem label="Festivos" value={pren.pago_festivos} />
          <BreakdownItem label="Dep. Otros" value={pren.depositos_otros} />
          <BreakdownItem label="Dep. Préstamos" value={pren.depositos_prestamos} />
        </div>

        <div className="flex-1 min-w-[140px]">
          <div className="text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-300 border-b border-red-200 dark:border-red-800/60 pb-1 mb-1.5 inline-flex items-center gap-1">
            <Minus size={10} /> Deducciones
          </div>
          <BreakdownItem label="INFONAVIT" value={pren.descuento_infonavit} sign="-" tone="red" />
          <BreakdownItem label="Aj. INBURSA" value={pren.ajuste_inbursa} sign="-" tone="red" />
          <BreakdownItem label="Desc. Otros" value={pren.descuentos_otros} sign="-" tone="red" />
          <BreakdownItem label="Desc. Préstamos" value={pren.descuento_prestamos} sign="-" tone="red" />
          <BreakdownItem label="Incidencias" value={pren.descuento_incidencias} sign="-" tone="red" />
          <BreakdownItem label="Recup. Manual" value={pren.recuperacion_manual} sign="-" tone="red" />
          {totalDeducciones === 0 && (
            <div className="text-xs italic text-ink-400 dark:text-ink-500 py-0.5">Sin deducciones</div>
          )}
        </div>
      </div>

      {/* Neto */}
      <div className="px-4 py-3 flex flex-col items-center justify-center bg-sky-50 dark:bg-sky-900/20 border-l border-sky-200 dark:border-sky-800/60 min-w-[120px] text-center">
        <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">Neto</div>
        <div className="text-lg font-extrabold tabular-nums text-sky-700 dark:text-sky-300 mt-0.5">
          {fmtMoney(pren.total_a_pagar)}
        </div>
      </div>
    </div>
  )
}

function ProyectoBlock({ data, fechaStr }) {
  const [printing, setPrinting] = useState(false)
  const { proyecto, prenominas } = data
  const counts = prenominas.length
  const sumPercep = prenominas.reduce((s, p) => s + (Number(p.total_percepciones) || 0), 0)
  const sumDeduc = prenominas.reduce((s, p) => s + (Number(p.total_deducciones) || 0), 0)
  const sumNeto = prenominas.reduce((s, p) => s + (Number(p.total_a_pagar) || 0), 0)

  const handlePrint = async () => {
    setPrinting(true)
    try {
      await imprimirProyectoPdf(fechaStr, proyecto.id)
    } catch (err) {
      toast.error(extractApiError(err, 'Error al generar el PDF'))
    } finally {
      setPrinting(false)
    }
  }

  return (
    <div className="bg-white dark:bg-ink-900 rounded-xl border border-ink-200 dark:border-ink-800 mb-8 overflow-hidden shadow-card">
      {/* Header */}
      <div className="px-6 py-4 border-l-4 border-l-brand-500 flex justify-between items-center gap-3 flex-wrap">
        <div>
          <p className="text-base font-bold text-ink-900 dark:text-ink-100">Proyecto {proyecto.numero_proyecto}</p>
          <p className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">{proyecto.nombre || 'Sin nombre'}</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<Printer size={14} />}
          loading={printing}
          onClick={handlePrint}
        >
          Imprimir Lista de Raya
        </Button>
      </div>

      {prenominas.length > 0 ? (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 border-t border-b border-ink-200 dark:border-ink-800">
            <KpiCell tone="purple" label="Trabajadores" value={counts} Icon={Users} />
            <KpiCell tone="green" label="Total percepciones" value={fmtMoney(sumPercep)} Icon={TrendingUp} />
            <KpiCell tone="red" label="Total deducciones" value={fmtMoney(sumDeduc)} Icon={TrendingDown} />
            <KpiCell tone="blue" label="Neto depositado" value={fmtMoney(sumNeto)} Icon={Wallet} />
          </div>

          {/* Workers */}
          <div className="p-5 flex flex-col gap-2.5">
            {prenominas.map((p) => <WorkerRow key={p.id} pren={p} />)}
          </div>

          {/* Totals bar */}
          <div className="mx-5 mb-5 bg-ink-50 dark:bg-ink-800/40 border border-ink-200 dark:border-ink-800 rounded-lg flex justify-end gap-8 px-5 py-3 flex-wrap">
            <div className="text-right">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">Total Percepciones</div>
              <div className="text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{fmtMoney(sumPercep)}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">Total Deducciones</div>
              <div className="text-base font-bold tabular-nums text-red-600 dark:text-red-300">{fmtMoney(sumDeduc)}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">Neto Total Depositado</div>
              <div className="text-lg font-bold tabular-nums text-sky-700 dark:text-sky-300">{fmtMoney(sumNeto)}</div>
            </div>
          </div>
        </>
      ) : (
        <div className="py-10 text-center text-ink-500 dark:text-ink-400">
          <Inbox size={28} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Aún no hay prenóminas aprobadas para este proyecto en esta semana.</p>
        </div>
      )}
    </div>
  )
}

export default function HistoricoDetalle() {
  const { fecha } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    obtenerDetalle(fecha)
      .then((res) => { if (!cancelled) setData(res) })
      .catch((err) => {
        if (cancelled) return
        toast.error(extractApiError(err, 'Error al cargar el desglose'))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [fecha])

  const proyectos = data?.proyectos || []

  return (
    <>
      <PageHeader
        icon={FileText}
        title={
          <span className="inline-flex items-center gap-2 flex-wrap">
            <span>Desglose estadístico de nómina</span>
            <span className="inline-block bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 text-xs font-semibold px-3 py-0.5 rounded-full">
              {fmtFechaCompleta(fecha)}
            </span>
          </span>
        }
        description="Detalle individual por trabajador — percepciones, deducciones y neto depositado."
        breadcrumb={
          <Link to="/historico" className="hover:underline inline-flex items-center gap-1">
            <ArrowLeft size={12} /> Volver al histórico
          </Link>
        }
      />

      {loading ? (
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : proyectos.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Sin desglose"
          description="No se encontraron reportes cerrados para esta semana."
        />
      ) : (
        proyectos.map((p) => (
          <ProyectoBlock key={p.proyecto.id} data={p} fechaStr={fecha} />
        ))
      )}
    </>
  )
}
