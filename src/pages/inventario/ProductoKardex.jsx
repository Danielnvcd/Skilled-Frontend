import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft, History, TrendingUp, TrendingDown, Activity, ArrowRightLeft,
  Calendar, User, Warehouse, FileText, Package, Filter,
} from 'lucide-react'
import {
  PageHeader, Button, Card, Select, Skeleton, EmptyState,
} from '../../components/ui'
import { getProductoKardex } from '../../api/inventario'
import { extractApiError } from '../../utils/apiError'
import { safeRedirectPath } from '../../utils/safeRedirect'

// ── ¿A dónde regresa el "volver"? ────────────────────────────────────────────
// Al kardex se llega desde seis pantallas distintas (inicio, catálogo, bajo
// mínimo, material general, material por proyecto…). El enlace estaba fijo al
// catálogo, así que quien entraba desde Inicio terminaba en una pantalla que no
// había pedido y sin forma obvia de volver.
//
// El origen viaja en el `state` de la navegación (no en la URL, para no
// ensuciarla) y se sanea con `safeRedirectPath`: aunque el state lo pone la
// propia app, ese valor termina en `navigate()`, que es justo el borde que
// safeRedirect existe para proteger en react-router 6.x.
const VUELTA_DEFAULT = { path: '/inventario/catalogo', label: 'Volver al catálogo' }

function resolverVuelta(state) {
  const destino = state?.volverA
  if (typeof destino !== 'string') return VUELTA_DEFAULT
  const path = safeRedirectPath(destino, VUELTA_DEFAULT.path)
  // Si no sobrevivió el saneo, el rótulo que venía con él tampoco vale.
  if (path === VUELTA_DEFAULT.path) return VUELTA_DEFAULT
  const rotulo = state?.volverLabel
  return {
    path,
    label: (typeof rotulo === 'string' && rotulo.trim() && rotulo.length <= 40)
      ? rotulo.trim()
      : 'Volver',
  }
}

const TIPO_META = {
  ENTRADA:  { Icon: TrendingUp,    color: 'emerald', label: 'Entrada' },
  SALIDA:   { Icon: TrendingDown,  color: 'rose',    label: 'Salida' },
  AJUSTE:   { Icon: Activity,      color: 'amber',   label: 'Ajuste' },
  TRASPASO: { Icon: ArrowRightLeft, color: 'sky',    label: 'Traspaso' },
}

const COLOR_MAP = {
  emerald: { dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800' },
  rose:    { dot: 'bg-rose-500',    text: 'text-rose-700 dark:text-rose-300',       bg: 'bg-rose-50 dark:bg-rose-900/20',       border: 'border-rose-200 dark:border-rose-800' },
  amber:   { dot: 'bg-amber-500',   text: 'text-amber-700 dark:text-amber-300',     bg: 'bg-amber-50 dark:bg-amber-900/20',     border: 'border-amber-200 dark:border-amber-800' },
  sky:     { dot: 'bg-sky-500',     text: 'text-sky-700 dark:text-sky-300',         bg: 'bg-sky-50 dark:bg-sky-900/20',         border: 'border-sky-200 dark:border-sky-800' },
}

function fmtFecha(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

function fmtDia(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch { return iso }
}

// Calcula default de fecha: hoy y hace 30 días en formato YYYY-MM-DD.
function defaultRango() {
  const hoy = new Date()
  const hace30 = new Date()
  hace30.setDate(hoy.getDate() - 30)
  const fmt = (d) => d.toISOString().slice(0, 10)
  return { desde: fmt(hace30), hasta: fmt(hoy) }
}

export default function ProductoKardex() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const vuelta = useMemo(() => resolverVuelta(location.state), [location.state])
  const def = useMemo(defaultRango, [])
  const [desde, setDesde] = useState(def.desde)
  const [hasta, setHasta] = useState(def.hasta)
  const [tipo, setTipo] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [orden, setOrden] = useState('desc') // 'desc' = recientes arriba

  const cargar = () => {
    setLoading(true)
    getProductoKardex(id, { desde, hasta, tipo: tipo || undefined })
      .then(setData)
      .catch((err) => {
        toast.error(extractApiError(err, 'Error al cargar kardex'))
        // Si el producto no carga, se devuelve a donde estaba, no al catálogo.
        navigate(vuelta.path)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [id]) // primera carga
  // Filtros se aplican manualmente con botón para no martillar el endpoint.

  const movimientos = useMemo(() => {
    if (!data) return []
    const arr = data.movimientos.slice()
    return orden === 'desc' ? arr.reverse() : arr
  }, [data, orden])

  // Agrupar por día para mostrar separadores tipo "Hoy", "Ayer", fecha.
  const grupos = useMemo(() => {
    const out = []
    let dia = null
    for (const m of movimientos) {
      const k = (m.fecha || '').slice(0, 10)
      if (k !== dia) {
        dia = k
        out.push({ tipo: 'sep', fecha: k })
      }
      out.push({ tipo: 'mov', mov: m })
    }
    return out
  }, [movimientos])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
      </div>
    )
  }

  if (!data) return null

  const p = data.producto
  const totalEntradas = data.movimientos.filter(m => m.delta > 0).reduce((a, m) => a + m.delta, 0)
  const totalSalidas = Math.abs(data.movimientos.filter(m => m.delta < 0).reduce((a, m) => a + m.delta, 0))

  return (
    <div>
      <PageHeader
        icon={History}
        title={`Kardex — ${p.codigo}`}
        description={
          <span className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-ink-900 dark:text-ink-100">{p.descripcion}</span>
            <span className="text-ink-400">·</span>
            <span>{p.categoria}</span>
            <span className="text-ink-400">·</span>
            <span>Stock actual <strong className="font-mono">{p.stock_actual} {p.unidad}</strong></span>
          </span>
        }
        breadcrumb={
          <Link to={vuelta.path} className="hover:underline inline-flex items-center gap-1">
            <ArrowLeft size={12} /> {vuelta.label}
          </Link>
        }
      />

      {/* Filtros */}
      <Card className="p-3 mt-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-500">
            <Filter size={12} /> Filtros
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-ink-500 mb-1">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="text-sm rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-2 py-1"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-ink-500 mb-1">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="text-sm rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-2 py-1"
            />
          </div>
          <div className="min-w-[140px]">
            <label className="block text-[10px] font-bold uppercase text-ink-500 mb-1">Tipo</label>
            <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">Todos</option>
              <option value="ENTRADA">Entradas</option>
              <option value="SALIDA">Salidas</option>
              <option value="AJUSTE">Ajustes</option>
              <option value="TRASPASO">Traspasos</option>
            </Select>
          </div>
          <Button size="sm" onClick={cargar}>Aplicar</Button>
          <div className="ml-auto">
            <label className="block text-[10px] font-bold uppercase text-ink-500 mb-1">Orden</label>
            <Select value={orden} onChange={(e) => setOrden(e.target.value)}>
              <option value="desc">Recientes primero</option>
              <option value="asc">Antiguos primero</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* Resumen de periodo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiBox label="Saldo inicial" value={`${data.saldo_inicial} ${p.unidad}`} tone="ink" sub={fmtDia(data.desde)} />
        <KpiBox label="Entradas" value={`+${totalEntradas.toFixed(2)}`} tone="emerald" />
        <KpiBox label="Salidas" value={`−${totalSalidas.toFixed(2)}`} tone="rose" />
        <KpiBox label="Saldo final" value={`${data.saldo_final} ${p.unidad}`} tone="ink" sub={fmtDia(data.hasta)} bold />
      </div>

      {/* Timeline */}
      {movimientos.length === 0 ? (
        <EmptyState
          icon={History}
          title="Sin movimientos en este periodo"
          description="Cambia el rango de fechas o el tipo de movimiento."
        />
      ) : (
        <div className="relative pl-6 border-l-2 border-ink-200 dark:border-ink-800 space-y-3">
          {grupos.map((g, i) => g.tipo === 'sep' ? (
            <div key={`sep-${i}`} className="relative -ml-7 pl-7 pt-2 first:pt-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-500 bg-ink-100 dark:bg-ink-800 px-2 py-0.5 rounded">
                {fmtDia(g.fecha)}
              </span>
            </div>
          ) : (
            <TimelineItem key={`mov-${g.mov.id}`} mov={g.mov} unidad={p.unidad} />
          ))}
        </div>
      )}

      <p className="text-xs text-ink-400 text-center mt-6">
        Mostrando {data.total_movimientos} movimientos · Rango {fmtDia(data.desde)} → {fmtDia(data.hasta)}
      </p>
    </div>
  )
}

function KpiBox({ label, value, sub, tone, bold }) {
  const TONES = {
    ink:     'text-ink-900 dark:text-ink-100',
    emerald: 'text-emerald-700 dark:text-emerald-300',
    rose:    'text-rose-700 dark:text-rose-300',
  }
  return (
    <div className="bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-lg px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500">{label}</div>
      <div className={`font-mono ${bold ? 'text-xl font-extrabold' : 'text-lg font-bold'} ${TONES[tone] || TONES.ink}`}>{value}</div>
      {sub && <div className="text-[10px] text-ink-400 mt-0.5">{sub}</div>}
    </div>
  )
}

function TimelineItem({ mov, unidad }) {
  const meta = TIPO_META[mov.tipo] || TIPO_META.AJUSTE
  const Icon = meta.Icon
  const c = COLOR_MAP[meta.color]

  // Para TRASPASO mostrar "Bodega A → Bodega B" como subtítulo.
  const ubicacion = mov.tipo === 'TRASPASO'
    ? `${mov.almacen_origen || '?'} → ${mov.almacen_destino || '?'}`
    : (mov.almacen_destino || mov.almacen_origen || '')

  const signo = mov.delta > 0 ? '+' : mov.delta < 0 ? '−' : '='
  const cantAbs = Math.abs(mov.delta) || Math.abs(mov.cantidad)

  return (
    <div className="relative">
      {/* Punto de la línea de tiempo */}
      <span className={`absolute -left-[34px] top-2 w-4 h-4 rounded-full ring-4 ring-white dark:ring-ink-950 ${c.dot}`} />

      <Card className={`p-3 ${c.border} border-l-4`}>
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 h-8 w-8 rounded-lg inline-flex items-center justify-center ${c.bg} ${c.text}`}>
            <Icon size={15} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className={`text-xs font-bold uppercase tracking-wide ${c.text}`}>{meta.label}</span>
              <span className="text-[11px] text-ink-500">{fmtFecha(mov.fecha)}</span>
            </div>
            {ubicacion && (
              <div className="text-xs text-ink-600 dark:text-ink-300 mt-0.5 flex items-center gap-1">
                <Warehouse size={11} className="text-ink-400" /> {ubicacion}
              </div>
            )}
            {mov.motivo && (
              <div className="text-xs text-ink-500 dark:text-ink-400 mt-0.5 flex items-start gap-1">
                <FileText size={11} className="mt-0.5 flex-shrink-0" /> <span className="truncate">{mov.motivo}</span>
              </div>
            )}
            {mov.usuario && (
              <div className="text-[11px] text-ink-400 mt-0.5 flex items-center gap-1">
                <User size={10} /> {mov.usuario}
              </div>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <div className={`font-mono font-bold ${c.text}`}>
              {signo}{cantAbs} <span className="text-[10px] opacity-70">{unidad}</span>
            </div>
            <div className="text-[10px] text-ink-500 mt-0.5">
              Saldo: <span className="font-mono font-bold text-ink-900 dark:text-ink-100">{mov.saldo}</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
