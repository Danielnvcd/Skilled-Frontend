import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  FileSpreadsheet, Boxes, ArrowRightLeft, History as HistoryIcon,
  Send, ClipboardList, Download, Filter, Loader2,
} from 'lucide-react'
import { PageHeader, Button, Card, Select } from '../../components/ui'
import {
  descargarReporteInventarioActual, descargarReporteMovimientos,
  descargarReporteKardex, descargarReporteConsumoProyecto,
  descargarReporteSolicitudes,
  getCategorias, getProductos,
} from '../../api/inventario'
import { extractApiError } from '../../utils/apiError'

const TIPOS_MOV = ['ENTRADA', 'SALIDA', 'AJUSTE', 'TRASPASO']
const ESTATUS_SOL = ['PENDIENTE', 'APROBADA', 'RECHAZADA', 'ENTREGADA']

function hoyIso() { return new Date().toISOString().slice(0, 10) }
function hoyMenosDias(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export default function Reportes() {
  const [categorias, setCategorias] = useState([])
  const [productos, setProductos] = useState([])

  useEffect(() => {
    getCategorias().then(setCategorias).catch(() => {})
    getProductos({ limit: 1000 }).then(setProductos).catch(() => {})
  }, [])

  return (
    <div>
      <PageHeader
        icon={FileSpreadsheet}
        title="Reportes de Inventario"
        description="Exporta los 5 reportes operativos del módulo en Excel."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <ReporteInventarioActual categorias={categorias} />
        <ReporteMovimientos productos={productos} />
        <ReporteKardex productos={productos} />
        <ReporteConsumoProyecto />
        <ReporteSolicitudes />
      </div>
    </div>
  )
}


// ─── ReporteCard base ──────────────────────────────────────────────────────────

function ReporteCard({ Icon, title, description, children, onGenerar, loading, disabled }) {
  return (
    <Card className="!p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300 shrink-0">
          <Icon size={20} />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-ink-900 dark:text-ink-100">{title}</h3>
          <p className="text-xs text-ink-500 mt-0.5">{description}</p>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
      <div className="pt-2 border-t border-ink-100 dark:border-ink-800">
        <Button
          variant="primary"
          onClick={onGenerar}
          loading={loading}
          disabled={disabled || loading}
          className="w-full"
        >
          {loading ? <Loader2 size={16} className="mr-1.5 animate-spin" /> : <Download size={16} className="mr-1.5" />}
          {loading ? 'Generando…' : 'Descargar Excel'}
        </Button>
      </div>
    </Card>
  )
}


// ─── 1. Inventario actual ──────────────────────────────────────────────────────

function ReporteInventarioActual({ categorias }) {
  const [categoria, setCategoria] = useState('')
  const [soloBajoMin, setSoloBajoMin] = useState(false)
  const [loading, setLoading] = useState(false)

  const handle = async () => {
    setLoading(true)
    try {
      await descargarReporteInventarioActual({
        categoria: categoria || undefined,
        solo_bajo_minimo: soloBajoMin,
      })
      toast.success('Reporte descargado')
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo generar el reporte'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <ReporteCard
      Icon={Boxes}
      title="Inventario actual"
      description="Stock vigente de cada producto: actual, reservado, disponible y mínimo."
      onGenerar={handle}
      loading={loading}
    >
      <div>
        <label className="text-xs font-semibold text-ink-600 dark:text-ink-300 mb-1 block">Categoría</label>
        <Select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">Todas</option>
          {categorias.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
      </div>
      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={soloBajoMin}
          onChange={(e) => setSoloBajoMin(e.target.checked)}
          className="rounded border-ink-300 text-brand-600 focus:ring-brand-500"
        />
        Solo productos bajo mínimo
      </label>
    </ReporteCard>
  )
}


// ─── 2. Movimientos por periodo ────────────────────────────────────────────────

function ReporteMovimientos({ productos }) {
  const [desde, setDesde] = useState(hoyMenosDias(30))
  const [hasta, setHasta] = useState(hoyIso())
  const [tipo, setTipo] = useState('')
  const [productoId, setProductoId] = useState('')
  const [loading, setLoading] = useState(false)

  const productosOrdenados = useMemo(
    () => [...productos].sort((a, b) => a.codigo.localeCompare(b.codigo)),
    [productos],
  )

  const handle = async () => {
    setLoading(true)
    try {
      await descargarReporteMovimientos({
        desde, hasta,
        tipo: tipo || undefined,
        producto_id: productoId ? Number(productoId) : undefined,
      })
      toast.success('Reporte descargado')
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo generar el reporte'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <ReporteCard
      Icon={ArrowRightLeft}
      title="Movimientos por periodo"
      description="Histórico de entradas, salidas, ajustes y traspasos con filtros."
      onGenerar={handle}
      loading={loading}
      disabled={!desde || !hasta || desde > hasta}
    >
      <div className="grid grid-cols-2 gap-2">
        <FechaInput label="Desde" value={desde} onChange={setDesde} />
        <FechaInput label="Hasta" value={hasta} onChange={setHasta} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-semibold text-ink-600 dark:text-ink-300 mb-1 block">Tipo</label>
          <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos</option>
            {TIPOS_MOV.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </div>
        <div>
          <label className="text-xs font-semibold text-ink-600 dark:text-ink-300 mb-1 block">Producto</label>
          <Select value={productoId} onChange={(e) => setProductoId(e.target.value)}>
            <option value="">Todos</option>
            {productosOrdenados.map((p) => (
              <option key={p.id} value={p.id}>{p.codigo} — {p.descripcion}</option>
            ))}
          </Select>
        </div>
      </div>
    </ReporteCard>
  )
}


// ─── 3. Kardex ─────────────────────────────────────────────────────────────────

function ReporteKardex({ productos }) {
  const [productoId, setProductoId] = useState('')
  const [desde, setDesde] = useState(hoyMenosDias(30))
  const [hasta, setHasta] = useState(hoyIso())
  const [loading, setLoading] = useState(false)

  const productosOrdenados = useMemo(
    () => [...productos].sort((a, b) => a.codigo.localeCompare(b.codigo)),
    [productos],
  )

  const handle = async () => {
    if (!productoId) {
      toast.error('Selecciona un producto')
      return
    }
    setLoading(true)
    try {
      await descargarReporteKardex({
        producto_id: Number(productoId),
        desde, hasta,
      })
      toast.success('Reporte descargado')
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo generar el reporte'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <ReporteCard
      Icon={HistoryIcon}
      title="Kardex por producto"
      description="Saldo corrido del producto en el periodo con detalle por movimiento."
      onGenerar={handle}
      loading={loading}
      disabled={!productoId || !desde || !hasta || desde > hasta}
    >
      <div>
        <label className="text-xs font-semibold text-ink-600 dark:text-ink-300 mb-1 block">Producto *</label>
        <Select value={productoId} onChange={(e) => setProductoId(e.target.value)}>
          <option value="">Selecciona…</option>
          {productosOrdenados.map((p) => (
            <option key={p.id} value={p.id}>{p.codigo} — {p.descripcion}</option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <FechaInput label="Desde" value={desde} onChange={setDesde} />
        <FechaInput label="Hasta" value={hasta} onChange={setHasta} />
      </div>
    </ReporteCard>
  )
}


// ─── 4. Consumo por proyecto ───────────────────────────────────────────────────

function ReporteConsumoProyecto() {
  const [desde, setDesde] = useState(hoyMenosDias(90))
  const [hasta, setHasta] = useState(hoyIso())
  const [estatus, setEstatus] = useState('ENTREGADA,APROBADA')
  const [loading, setLoading] = useState(false)

  const handle = async () => {
    setLoading(true)
    try {
      await descargarReporteConsumoProyecto({ desde, hasta, estatus })
      toast.success('Reporte descargado')
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo generar el reporte'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <ReporteCard
      Icon={Send}
      title="Consumo por proyecto"
      description="Cantidad entregada por proyecto agrupada por producto. Útil para facturación."
      onGenerar={handle}
      loading={loading}
      disabled={!desde || !hasta || desde > hasta}
    >
      <div className="grid grid-cols-2 gap-2">
        <FechaInput label="Desde" value={desde} onChange={setDesde} />
        <FechaInput label="Hasta" value={hasta} onChange={setHasta} />
      </div>
      <div>
        <label className="text-xs font-semibold text-ink-600 dark:text-ink-300 mb-1 block">Estatus a incluir</label>
        <Select value={estatus} onChange={(e) => setEstatus(e.target.value)}>
          <option value="ENTREGADA,APROBADA">Entregadas + parciales</option>
          <option value="ENTREGADA">Solo entregadas</option>
          <option value="APROBADA">Solo aprobadas</option>
        </Select>
      </div>
    </ReporteCard>
  )
}


// ─── 5. Solicitudes ────────────────────────────────────────────────────────────

function ReporteSolicitudes() {
  const [desde, setDesde] = useState(hoyMenosDias(30))
  const [hasta, setHasta] = useState(hoyIso())
  const [estatus, setEstatus] = useState('')
  const [loading, setLoading] = useState(false)

  const handle = async () => {
    setLoading(true)
    try {
      await descargarReporteSolicitudes({
        desde, hasta,
        estatus: estatus || undefined,
      })
      toast.success('Reporte descargado')
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo generar el reporte'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <ReporteCard
      Icon={ClipboardList}
      title="Solicitudes del periodo"
      description="Lista plana de solicitudes con totales por línea para conciliar entregas."
      onGenerar={handle}
      loading={loading}
      disabled={!desde || !hasta || desde > hasta}
    >
      <div className="grid grid-cols-2 gap-2">
        <FechaInput label="Desde" value={desde} onChange={setDesde} />
        <FechaInput label="Hasta" value={hasta} onChange={setHasta} />
      </div>
      <div>
        <label className="text-xs font-semibold text-ink-600 dark:text-ink-300 mb-1 block">Estatus</label>
        <Select value={estatus} onChange={(e) => setEstatus(e.target.value)}>
          <option value="">Todos</option>
          {ESTATUS_SOL.map((e) => <option key={e} value={e}>{e}</option>)}
        </Select>
      </div>
    </ReporteCard>
  )
}


// ─── helpers ───────────────────────────────────────────────────────────────────

function FechaInput({ label, value, onChange }) {
  return (
    <div>
      <label className="text-xs font-semibold text-ink-600 dark:text-ink-300 mb-1 block">{label}</label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full h-9 px-3 rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
      />
    </div>
  )
}
