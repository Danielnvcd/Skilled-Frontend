import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowRightLeft, Plus, Package, TrendingUp, TrendingDown, AlertTriangle,
  History, ListChecks,
} from 'lucide-react'
import {
  Button, Card, PageHeader,
  Skeleton, Table, THead, TH, THSort, TBody, TR, TD, Select, SavedViews,
} from '../../components/ui'
import {
  getMovimientos, getProductos, getProductosBajoMinimo,
} from '../../api/inventario'
import { extractApiError } from '../../utils/apiError'
import { useSocket } from '../../context/SocketContext'

export default function MovimientosInventario() {
  const [movimientos, setMovimientos] = useState([])
  const [productos, setProductos] = useState([])
  const [bajoMin, setBajoMin] = useState([])

  const [loading, setLoading] = useState(true)
  const [loadingBajo, setLoadingBajo] = useState(false)

  const [tab, setTab] = useState('historial')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroProducto, setFiltroProducto] = useState('')
  // Orden client-side: el dataset completo (≤300 filas) ya está en memoria,
  // re-ordenar no necesita round-trip. sort vacío = orden del backend (fecha desc).
  const [sort, setSort] = useState('')
  const [dir, setDir] = useState('asc')

  const reload = () => {
    setLoading(true)
    Promise.all([
      getMovimientos({ limit: 300 }),
      getProductos({ limit: 500 }),
      getProductosBajoMinimo().catch(() => []),
    ])
      .then(([movs, prods, bajos]) => {
        setMovimientos(movs)
        setProductos(prods)
        setBajoMin(bajos)
      })
      .catch((err) => toast.error(extractApiError(err, 'Error al cargar movimientos')))
      .finally(() => setLoading(false))
  }

  const loadBajoMin = () => {
    setLoadingBajo(true)
    getProductosBajoMinimo()
      .then(setBajoMin)
      .catch((err) => toast.error(extractApiError(err, 'Error al cargar stock bajo')))
      .finally(() => setLoadingBajo(false))
  }

  useEffect(() => { reload() }, [])

  // Tiempo real: cuando otro usuario registra un movimiento, el backend emite
  // 'movimiento:changed' a los roles de inventario. Refrescamos historial y
  // bajo-mínimo en silencio (sin skeleton) para no parpadear la vista.
  const { on: onSocket } = useSocket()
  useEffect(() => {
    const off = onSocket('movimiento:changed', () => {
      getMovimientos({ limit: 300 }).then(setMovimientos).catch(() => {})
      getProductosBajoMinimo().then(setBajoMin).catch(() => {})
    })
    return off
  }, [onSocket])

  const kpis = useMemo(() => {
    const hoy = new Date().toISOString().slice(0, 10)
    let entradas = 0, salidas = 0, ajustes = 0
    movimientos.forEach((m) => {
      if (!m.fecha || m.fecha.slice(0, 10) !== hoy) return
      if (m.tipo === 'ENTRADA') entradas++
      else if (m.tipo === 'SALIDA') salidas++
      else if (m.tipo === 'AJUSTE') ajustes++
    })
    return {
      total: productos.length,
      entradas,
      salidas,
      ajustes,
      bajoMin: bajoMin.length,
    }
  }, [movimientos, productos, bajoMin])

  const filteredMovs = useMemo(() => {
    return movimientos.filter((m) => {
      if (filtroTipo && m.tipo !== filtroTipo) return false
      if (filtroProducto && String(m.producto_id) !== String(filtroProducto)) return false
      return true
    })
  }, [movimientos, filtroTipo, filtroProducto])

  const sortedMovs = useMemo(() => {
    if (!sort) return filteredMovs
    const descProducto = new Map(productos.map((p) => [p.id, (p.descripcion || '').toLowerCase()]))
    const mul = dir === 'desc' ? -1 : 1
    const val = (m) => {
      switch (sort) {
        case 'fecha': return m.fecha || ''
        case 'tipo': return m.tipo || ''
        case 'producto': return descProducto.get(m.producto_id) || ''
        case 'cantidad': return Number(m.cantidad) || 0
        default: return 0
      }
    }
    return [...filteredMovs].sort((a, b) => {
      const va = val(a)
      const vb = val(b)
      if (va < vb) return -mul
      if (va > vb) return mul
      return 0
    })
  }, [filteredMovs, productos, sort, dir])

  const onSort = (field, nextDir) => {
    if (!nextDir) {
      setSort('')
      setDir('asc')
    } else {
      setSort(field)
      setDir(nextDir)
    }
  }

  const aplicarVista = (params) => {
    setFiltroTipo(params.tipo || '')
    setFiltroProducto(params.producto || '')
    setSort(params.sort || '')
    setDir(params.dir || 'asc')
  }

  const getTypeStyle = (tipo) => {
    switch (tipo) {
      case 'ENTRADA':  return 'text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30'
      case 'SALIDA':   return 'text-red-700 bg-red-50 dark:bg-red-900/30'
      case 'AJUSTE':   return 'text-amber-700 bg-amber-50 dark:bg-amber-900/30'
      case 'TRASPASO': return 'text-blue-700 bg-blue-50 dark:bg-blue-900/30'
      default:         return 'text-ink-600 bg-ink-50'
    }
  }

  const KPI = ({ icon: Icon, label, value, color, bg }) => (
    <div className="p-4 rounded-xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900">
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ${bg} ${color} mb-2`}>
        <Icon size={18} />
      </div>
      <p className="text-2xl font-extrabold text-ink-900 dark:text-ink-100 leading-none">{value}</p>
      <p className="text-xs text-ink-500 mt-1">{label}</p>
    </div>
  )

  return (
    <div>
      <PageHeader
        icon={ArrowRightLeft}
        title="Historial de Movimientos"
        description="Consulta entradas, salidas y ajustes registrados."
        actions={
          <Link to="/inventario/movimientos/nuevo">
            <Button leftIcon={<Plus size={15} />}>Registrar movimiento</Button>
          </Link>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
        <KPI icon={Package}        label="Productos"     value={kpis.total}    color="text-brand-600"   bg="bg-brand-50 dark:bg-brand-900/20" />
        <KPI icon={TrendingUp}     label="Entradas hoy"  value={kpis.entradas} color="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-900/20" />
        <KPI icon={TrendingDown}   label="Salidas hoy"   value={kpis.salidas}  color="text-red-600"     bg="bg-red-50 dark:bg-red-900/20" />
        <KPI icon={ArrowRightLeft} label="Ajustes hoy"   value={kpis.ajustes}  color="text-amber-600"   bg="bg-amber-50 dark:bg-amber-900/20" />
        <KPI icon={AlertTriangle}  label="Bajo mínimo"   value={kpis.bajoMin}  color="text-rose-600"    bg="bg-rose-50 dark:bg-rose-900/20" />
      </div>

      {/* Tabs */}
      <div className="mt-6 flex flex-wrap gap-1.5">
        <TabBtn active={tab === 'historial'} onClick={() => setTab('historial')} icon={History}>
          Historial
        </TabBtn>
        <TabBtn
          active={tab === 'bajo-minimo'}
          onClick={() => { setTab('bajo-minimo'); loadBajoMin() }}
          icon={AlertTriangle}
          badge={kpis.bajoMin > 0 ? kpis.bajoMin : null}
        >
          Bajo mínimo
        </TabBtn>
      </div>

      {/* Tab Historial */}
      {tab === 'historial' && (
        <>
          <Card className="mt-4 !p-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <Select label="Tipo" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
                <option value="">Todos los tipos</option>
                <option value="ENTRADA">Entrada</option>
                <option value="SALIDA">Salida</option>
                <option value="AJUSTE">Ajuste</option>
                <option value="TRASPASO">Traspaso</option>
              </Select>
              <Select label="Producto" value={filtroProducto} onChange={(e) => setFiltroProducto(e.target.value)}>
                <option value="">Todos los productos</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>{p.codigo} — {p.descripcion}</option>
                ))}
              </Select>
            </div>
          </Card>

          <div className="mt-4">
            <SavedViews
              listKey="inventario-movimientos"
              current={{ tipo: filtroTipo, producto: filtroProducto, sort, dir: sort ? dir : '' }}
              defaults={{ tipo: '', producto: '', sort: '', dir: '' }}
              onApply={aplicarVista}
            />
          </div>

          <Card className="mt-4">
            {loading ? (
              <div className="p-6"><Skeleton className="h-40 w-full" /></div>
            ) : sortedMovs.length === 0 ? (
              <div className="p-10 text-center text-ink-500">Sin movimientos para los filtros seleccionados.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <THSort field="fecha" sort={sort} dir={dir} onSort={onSort}>Fecha</THSort>
                    <THSort field="tipo" sort={sort} dir={dir} onSort={onSort}>Tipo</THSort>
                    <THSort field="producto" sort={sort} dir={dir} onSort={onSort}>Producto</THSort>
                    <THSort field="cantidad" sort={sort} dir={dir} onSort={onSort} align="right">Cantidad</THSort>
                    <TH>Motivo</TH>
                  </THead>
                  <TBody>
                    {sortedMovs.map((m) => {
                      const prod = productos.find((p) => p.id === m.producto_id)
                      const cant = Number(m.cantidad)
                      const signo = m.tipo === 'SALIDA' ? '-' : m.tipo === 'ENTRADA' ? '+' : (cant > 0 ? '+' : '')
                      return (
                        <TR key={m.id}>
                          <TD className="text-sm whitespace-nowrap">
                            {new Date(m.fecha).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                          </TD>
                          <TD>
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getTypeStyle(m.tipo)}`}>{m.tipo}</span>
                          </TD>
                          <TD>
                            <span className="font-medium">{prod ? prod.descripcion : `Prod #${m.producto_id}`}</span>
                            {prod && <span className="text-xs text-ink-500 ml-2 font-mono">{prod.codigo}</span>}
                          </TD>
                          <TD align="right" className="font-bold">{signo}{cant} {prod?.unidad || ''}</TD>
                          <TD className="text-sm text-ink-500 max-w-xs truncate" title={m.motivo}>{m.motivo || '—'}</TD>
                        </TR>
                      )
                    })}
                  </TBody>
                </Table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* Tab Bajo mínimo */}
      {tab === 'bajo-minimo' && (
        <div className="mt-4 space-y-3">
          {loadingBajo ? (
            <Skeleton className="h-40 w-full" />
          ) : bajoMin.length === 0 ? (
            <Card className="p-10 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 mb-3">
                <ListChecks size={28} />
              </div>
              <h3 className="text-lg font-bold text-ink-900 dark:text-ink-100">Inventario saludable</h3>
              <p className="text-sm text-ink-500 mt-1">Ningún producto está por debajo del stock mínimo.</p>
            </Card>
          ) : (
            bajoMin.map((p) => {
              const stock = Number(p.stock_actual)
              const min = Number(p.stock_minimo)
              const pct = min > 0 ? Math.min(100, Math.round((stock / min) * 100)) : 0
              const warn = pct > 50
              return (
                <Card key={p.id} className="border-l-4 border-l-rose-500">
                  <div className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-500 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle size={22} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-ink-900 dark:text-ink-100 truncate">{p.descripcion}</p>
                      <div className="flex items-center gap-2 text-xs text-ink-500 mt-0.5">
                        <span className="font-mono uppercase">{p.codigo}</span>
                        <span>·</span>
                        <span className="bg-ink-100 dark:bg-ink-800 px-1.5 py-0.5 rounded">{p.unidad}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="flex-1 h-2 bg-ink-100 dark:bg-ink-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${warn ? 'bg-amber-500' : 'bg-rose-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-ink-500 font-bold">{pct}% de la meta</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 pl-4 border-l border-ink-200 dark:border-ink-800">
                      <p className="text-[10px] uppercase font-bold text-ink-500 tracking-wider">Stock actual</p>
                      <p className="text-2xl font-extrabold text-rose-600 leading-none mt-1">{stock}</p>
                      <p className="text-xs text-ink-500 mt-1">Mínimo: {min}</p>
                    </div>
                  </div>
                </Card>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

function TabBtn({ active, onClick, icon: Icon, children, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold border transition-all ${
        active
          ? 'bg-brand-600 text-white border-brand-600'
          : 'bg-white dark:bg-ink-900 text-ink-700 dark:text-ink-200 border-ink-200 dark:border-ink-700 hover:border-brand-400'
      }`}
    >
      <Icon size={15} />
      {children}
      {badge != null && (
        <span className={`ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
          active ? 'bg-white/20 text-white' : 'bg-rose-500 text-white'
        }`}>{badge}</span>
      )}
    </button>
  )
}
