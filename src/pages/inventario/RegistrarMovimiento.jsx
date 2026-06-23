import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowRightLeft, TrendingUp, TrendingDown, Activity, Package,
  Plus, Minus, AlertTriangle, CheckCircle2, Info, ChevronLeft, Save,
  Warehouse,
} from 'lucide-react'
import {
  Button, Card, PageHeader, Select, Skeleton,
} from '../../components/ui'
import {
  getAlmacenes, createMovimiento, getProductoStocks,
} from '../../api/inventario'
import { extractApiError } from '../../utils/apiError'
import ProductoPicker from '../../components/ProductoPicker'

const TIPOS = [
  {
    key: 'ENTRADA',
    label: 'Entrada',
    desc: 'Suma stock al producto',
    Icon: TrendingUp,
    color: 'emerald',
    sign: '+',
  },
  {
    key: 'SALIDA',
    label: 'Salida',
    desc: 'Resta stock del producto',
    Icon: TrendingDown,
    color: 'rose',
    sign: '−',
  },
  {
    key: 'AJUSTE',
    label: 'Ajuste',
    desc: 'Corrige el stock (puede ser negativo)',
    Icon: Activity,
    color: 'amber',
    sign: '±',
  },
  {
    key: 'TRASPASO',
    label: 'Traspaso',
    desc: 'Mueve stock entre bodegas',
    Icon: ArrowRightLeft,
    color: 'sky',
    sign: '→',
  },
]

const COLORS = {
  emerald: {
    border: 'border-emerald-500',
    ring:   'ring-emerald-500/20',
    bg:     'bg-emerald-50 dark:bg-emerald-900/20',
    text:   'text-emerald-700 dark:text-emerald-300',
    btn:    'bg-emerald-600 hover:bg-emerald-700',
  },
  rose: {
    border: 'border-rose-500',
    ring:   'ring-rose-500/20',
    bg:     'bg-rose-50 dark:bg-rose-900/20',
    text:   'text-rose-700 dark:text-rose-300',
    btn:    'bg-rose-600 hover:bg-rose-700',
  },
  amber: {
    border: 'border-amber-500',
    ring:   'ring-amber-500/20',
    bg:     'bg-amber-50 dark:bg-amber-900/20',
    text:   'text-amber-700 dark:text-amber-300',
    btn:    'bg-amber-600 hover:bg-amber-700',
  },
  sky: {
    border: 'border-sky-500',
    ring:   'ring-sky-500/20',
    bg:     'bg-sky-50 dark:bg-sky-900/20',
    text:   'text-sky-700 dark:text-sky-300',
    btn:    'bg-sky-600 hover:bg-sky-700',
  },
}

export default function RegistrarMovimiento() {
  const navigate = useNavigate()

  const [almacenes, setAlmacenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [tipo, setTipo] = useState('ENTRADA')
  const [productoSel, setProductoSel] = useState(null)
  const [cantidad, setCantidad] = useState('')
  // Dirección del ajuste — solo aplica si tipo=AJUSTE. '+' suma, '-' resta.
  const [ajusteDir, setAjusteDir] = useState('+')
  // Pausa 2: almacenes separados por dirección — TRASPASO requiere ambos,
  // ENTRADA/SALIDA solo uno, AJUSTE depende del signo.
  const [almacenOrigenId, setAlmacenOrigenId] = useState('')
  const [almacenDestinoId, setAlmacenDestinoId] = useState('')
  const [motivo, setMotivo] = useState('')

  // Desglose de stock por bodega del producto seleccionado (Pausa 2).
  const [stocksProducto, setStocksProducto] = useState(null)
  const [loadingStocks, setLoadingStocks] = useState(false)

  useEffect(() => {
    getAlmacenes()
      .then((alms) => setAlmacenes(alms))
      .catch((err) => toast.error(extractApiError(err, 'Error al cargar datos')))
      .finally(() => setLoading(false))
  }, [])

  const tipoCfg = TIPOS.find((t) => t.key === tipo) || TIPOS[0]
  const colorCfg = COLORS[tipoCfg.color]

  // El producto seleccionado viene completo del picker (búsqueda server-side).
  const producto = productoSel
  const productoId = producto ? String(producto.id) : ''

  // Cargar desglose por bodega cuando cambia el producto seleccionado.
  useEffect(() => {
    if (!productoId) { setStocksProducto(null); return }
    let cancel = false
    setLoadingStocks(true)
    getProductoStocks(productoId, { incluirVacios: true })
      .then((data) => { if (!cancel) setStocksProducto(data) })
      .catch(() => { if (!cancel) setStocksProducto(null) })
      .finally(() => { if (!cancel) setLoadingStocks(false) })
    return () => { cancel = true }
  }, [productoId])

  // Stock disponible en la bodega origen seleccionada (para validar SALIDAs/TRASPASOs).
  const stockEnOrigen = useMemo(() => {
    if (!stocksProducto || !almacenOrigenId) return null
    const row = stocksProducto.stocks.find((s) => String(s.almacen_id) === String(almacenOrigenId))
    return row ? Number(row.cantidad) : 0
  }, [stocksProducto, almacenOrigenId])

  // Cálculo del stock resultante con signo según tipo.
  // TRASPASO no afecta el total global, solo redistribuye entre bodegas.
  // Para AJUSTE el signo lo da `ajusteDir` (toggle +/-), la cantidad es positiva.
  const calculo = useMemo(() => {
    if (!producto || cantidad === '' || isNaN(Number(cantidad))) return null
    const cant = Math.abs(Number(cantidad))
    const stock = Number(producto.stock_actual) || 0
    const minimo = Number(producto.stock_minimo) || 0
    let delta = 0
    if (tipo === 'ENTRADA') delta = cant
    else if (tipo === 'SALIDA') delta = -cant
    else if (tipo === 'TRASPASO') delta = 0  // no cambia el total
    else delta = ajusteDir === '-' ? -cant : cant  // AJUSTE
    const nuevo = stock + delta

    // Para SALIDA/TRASPASO/AJUSTE−: validar contra la bodega origen.
    const requiereOrigen =
      tipo === 'SALIDA' || tipo === 'TRASPASO' ||
      (tipo === 'AJUSTE' && ajusteDir === '-')
    const insuficienteEnOrigen =
      requiereOrigen && almacenOrigenId !== '' && stockEnOrigen !== null &&
      cant > stockEnOrigen

    return {
      stock,
      minimo,
      delta,
      nuevo,
      negativo: nuevo < 0,
      bajoMinimo: tipo !== 'TRASPASO' && nuevo >= 0 && nuevo < minimo,
      cantidadInvalida: cant <= 0,
      insuficienteEnOrigen,
    }
  }, [producto, cantidad, tipo, ajusteDir, almacenOrigenId, stockEnOrigen])

  // Determinar qué selectores de almacén mostrar según el tipo.
  const necesitaDestino = tipo === 'ENTRADA' || tipo === 'TRASPASO' ||
                          (tipo === 'AJUSTE' && ajusteDir === '+')
  const necesitaOrigen = tipo === 'SALIDA' || tipo === 'TRASPASO' ||
                         (tipo === 'AJUSTE' && ajusteDir === '-')

  const almacenOk =
    (!necesitaOrigen || !!almacenOrigenId) &&
    (!necesitaDestino || !!almacenDestinoId) &&
    (tipo !== 'TRASPASO' || almacenOrigenId !== almacenDestinoId)

  const puedeGuardar =
    !!productoId &&
    cantidad !== '' &&
    !isNaN(Number(cantidad)) &&
    !!calculo &&
    !calculo.negativo &&
    !calculo.cantidadInvalida &&
    !calculo.insuficienteEnOrigen &&
    almacenOk

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!puedeGuardar) return
    setSaving(true)
    try {
      const rawCant = Math.abs(Number(cantidad))
      const cantidadFinal = tipo === 'AJUSTE' && ajusteDir === '-' ? -rawCant : rawCant
      const payload = {
        tipo,
        producto_id: Number(productoId),
        cantidad: cantidadFinal,
        motivo: motivo.trim() || null,
      }
      if (almacenOrigenId) payload.almacen_origen_id = Number(almacenOrigenId)
      if (almacenDestinoId) payload.almacen_destino_id = Number(almacenDestinoId)
      await createMovimiento(payload)
      toast.success(`${tipoCfg.label} registrada correctamente`)
      navigate('/inventario/movimientos')
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo registrar el movimiento'))
    } finally {
      setSaving(false)
    }
  }

  const adjustCantidad = (delta) => {
    const v = Number(cantidad) || 0
    const nueva = Math.max(0, Math.round((v + delta) * 100) / 100)
    setCantidad(String(nueva))
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Skeleton className="lg:col-span-2 h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        icon={ArrowRightLeft}
        title="Registrar movimiento"
        description="Captura entradas, salidas o ajustes de inventario."
        actions={
          <Button
            variant="ghost"
            leftIcon={<ChevronLeft size={15} />}
            onClick={() => navigate('/inventario/movimientos')}
          >
            Volver al historial
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-5">
        {/* Form principal */}
        <Card className="lg:col-span-2 p-4 space-y-4">
          {/* Selector de tipo (4 cards compactos) */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400 mb-1.5">
              Tipo de movimiento
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TIPOS.map((t) => {
                const c = COLORS[t.color]
                const isActive = tipo === t.key
                const Icon = t.Icon
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTipo(t.key)}
                    className={`p-2.5 rounded-lg border-2 text-left transition-all ${
                      isActive
                        ? `${c.border} ${c.bg} ring-2 ${c.ring}`
                        : 'border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 hover:border-ink-300 dark:hover:border-ink-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`inline-flex items-center justify-center w-7 h-7 rounded-md ${c.bg} ${c.text}`}>
                        <Icon size={14} />
                      </div>
                      <p className={`text-sm font-bold ${isActive ? c.text : 'text-ink-900 dark:text-ink-100'}`}>{t.label}</p>
                      <span className={`text-xs font-mono font-bold ${c.text} ml-auto`}>{t.sign}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Selector de producto — búsqueda server-side (escala a miles) */}
          <ProductoPicker value={productoSel} onSelect={setProductoSel} />

          {/* Toggle Aumentar/Disminuir cuando tipo=AJUSTE */}
          {tipo === 'AJUSTE' && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400 mb-1.5">
                ¿Qué pasó con el stock?
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAjusteDir('+')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 font-bold text-sm transition-all ${
                    ajusteDir === '+'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700'
                      : 'border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-500'
                  }`}
                >
                  <Plus size={14} />
                  Aumentar
                </button>
                <button
                  type="button"
                  onClick={() => setAjusteDir('-')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 font-bold text-sm transition-all ${
                    ajusteDir === '-'
                      ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/20 text-rose-700'
                      : 'border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-500'
                  }`}
                >
                  <Minus size={14} />
                  Disminuir
                </button>
              </div>
              <p className="text-[11px] text-ink-500 mt-1.5 italic">
                {ajusteDir === '+'
                  ? 'Ej. encontraste 5 piezas extra al hacer conteo, te las regresaron, etc.'
                  : 'Ej. faltan 3 piezas por merma, rotura, error de captura, etc.'}
              </p>
            </div>
          )}

          {/* Cantidad con stepper compacto */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400 mb-1.5">
              Cantidad
            </label>
            <div className="flex items-center justify-center gap-2 bg-ink-50 dark:bg-ink-800/50 rounded-lg p-2.5 border border-ink-200 dark:border-ink-700">
              <button
                type="button"
                onClick={() => adjustCantidad(-1)}
                className="w-10 h-10 rounded-lg bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 hover:bg-ink-100 dark:hover:bg-ink-800 flex items-center justify-center text-ink-700 dark:text-ink-200 transition-colors"
              >
                <Minus size={16} />
              </button>
              <input
                type="number"
                step="0.01"
                min="0"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value.replace('-', ''))}
                onFocus={(e) => e.target.select()}
                placeholder="0"
                required
                className="w-28 h-11 text-center text-2xl font-extrabold tabular-nums rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900 dark:text-ink-100 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
              <button
                type="button"
                onClick={() => adjustCantidad(+1)}
                className="w-10 h-10 rounded-lg bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 hover:bg-ink-100 dark:hover:bg-ink-800 flex items-center justify-center text-ink-700 dark:text-ink-200 transition-colors"
              >
                <Plus size={16} />
              </button>
              {producto && (
                <span className="text-xs text-ink-500 ml-1">{producto.unidad}</span>
              )}
            </div>
          </div>

          {/* Almacenes — obligatorios según tipo (Pausa 2: stock por bodega) */}
          {almacenes.length === 0 ? (
            <Card className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 text-sm">
              <AlertTriangle size={14} className="inline text-amber-600 mr-1.5" />
              No hay bodegas registradas. Crea una en "Almacenes" antes de mover stock.
            </Card>
          ) : (
            <div className={tipo === 'TRASPASO' ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : ''}>
              {necesitaOrigen && (
                <Select
                  label={`Bodega origen${necesitaOrigen ? ' *' : ''}`}
                  value={almacenOrigenId}
                  onChange={(e) => setAlmacenOrigenId(e.target.value)}
                  required={necesitaOrigen}
                >
                  <option value="">Selecciona bodega…</option>
                  {almacenes.map((a) => {
                    const s = stocksProducto?.stocks.find((x) => x.almacen_id === a.id)
                    const disponible = s ? Number(s.cantidad) : 0
                    return (
                      <option key={a.id} value={a.id}>
                        {a.nombre}{producto ? ` — disponible: ${disponible}` : ''}
                      </option>
                    )
                  })}
                </Select>
              )}
              {necesitaDestino && (
                <Select
                  label={`Bodega destino${necesitaDestino ? ' *' : ''}`}
                  value={almacenDestinoId}
                  onChange={(e) => setAlmacenDestinoId(e.target.value)}
                  required={necesitaDestino}
                >
                  <option value="">Selecciona bodega…</option>
                  {almacenes
                    .filter((a) => tipo !== 'TRASPASO' || String(a.id) !== String(almacenOrigenId))
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nombre}{a.ubicacion ? ` — ${a.ubicacion}` : ''}
                      </option>
                    ))}
                </Select>
              )}
            </div>
          )}

          {/* Motivo */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400 mb-1">
              Motivo o notas {tipo === 'AJUSTE' && <span className="text-rose-500">*</span>}
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              placeholder={
                tipo === 'ENTRADA' ? 'Ej. Compra a proveedor X, factura 4567' :
                tipo === 'SALIDA'  ? 'Ej. Salida a obra Norte, orden 123'   :
                                     'Ej. Conteo físico, faltante por merma'
              }
              required={tipo === 'AJUSTE'}
              className="block w-full rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm p-2.5 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none resize-none"
            />
            {tipo === 'AJUSTE' && (
              <p className="text-[11px] text-rose-500 mt-1 inline-flex items-center gap-1">
                <Info size={11} /> Para ajustes el motivo es obligatorio (trazabilidad de auditoría).
              </p>
            )}
          </div>

          {/* Botones */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t border-ink-200 dark:border-ink-800">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => navigate('/inventario/movimientos')}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              loading={saving}
              disabled={!puedeGuardar || (tipo === 'AJUSTE' && !motivo.trim())}
              leftIcon={<Save size={14} />}
              className={`${colorCfg.btn} text-white border-0`}
            >
              Registrar {tipoCfg.label.toLowerCase()}
            </Button>
          </div>
        </Card>

        {/* Panel resumen / alertas */}
        <div className="space-y-3">
          {/* Tipo + producto compacto */}
          <Card className="overflow-hidden">
            <div className={`px-3 py-2 ${colorCfg.bg} ${colorCfg.text} border-b border-ink-200 dark:border-ink-800 flex items-center gap-2`}>
              <tipoCfg.Icon size={16} />
              <p className="text-sm font-extrabold">{tipoCfg.label}</p>
              {tipo === 'AJUSTE' && (
                <span className="ml-auto text-xs font-mono font-bold">
                  {ajusteDir === '+' ? 'Aumentar' : 'Disminuir'}
                </span>
              )}
            </div>

            <div className="p-3 space-y-2">
              {!producto ? (
                <div className="text-center py-3 text-ink-400">
                  <Package size={20} className="mx-auto mb-1 opacity-50" />
                  <p className="text-[11px]">Selecciona un producto</p>
                </div>
              ) : (
                <>
                  <div>
                    <p className="font-bold text-ink-900 dark:text-ink-100 text-sm leading-tight">{producto.descripcion}</p>
                    <p className="text-[11px] font-mono text-ink-500 dark:text-ink-400">{producto.codigo}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="rounded bg-ink-50 dark:bg-ink-800 p-2">
                      <p className="text-[9px] uppercase font-bold tracking-wider text-ink-500">Disponible</p>
                      <p className="text-base font-extrabold text-ink-900 dark:text-ink-100 tabular-nums leading-tight">
                        {producto.stock_disponible ?? producto.stock_actual}
                      </p>
                      <p className="text-[9px] text-ink-500">
                        {producto.unidad}
                        {(producto.stock_reservado || 0) > 0 && (
                          <span className="text-amber-600 dark:text-amber-400 font-semibold ml-1">
                            · {producto.stock_reservado} apart.
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="rounded bg-ink-50 dark:bg-ink-800 p-2">
                      <p className="text-[9px] uppercase font-bold tracking-wider text-ink-500">Mínimo</p>
                      <p className="text-base font-extrabold text-ink-900 dark:text-ink-100 tabular-nums leading-tight">{producto.stock_minimo}</p>
                      <p className="text-[9px] text-ink-500">{producto.unidad}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Desglose por bodega (Pausa 2) */}
          {producto && (
            <Card className="overflow-hidden">
              <div className="px-3 py-2 border-b border-ink-200 dark:border-ink-800 flex items-center gap-2">
                <Warehouse size={12} className="text-ink-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Stock por bodega</span>
              </div>
              {loadingStocks ? (
                <div className="p-2 text-[11px] text-ink-400">Cargando…</div>
              ) : !stocksProducto || stocksProducto.stocks.length === 0 ? (
                <div className="p-2 text-[11px] text-ink-400">Sin registros.</div>
              ) : (
                <ul className="divide-y divide-ink-100 dark:divide-ink-800">
                  {stocksProducto.stocks
                    .slice()
                    .sort((a, b) => b.cantidad - a.cantidad)
                    .map((s) => (
                      <li key={s.almacen_id} className="flex items-center justify-between px-3 py-1.5 text-[12px]">
                        <span className="truncate">{s.almacen_nombre}</span>
                        <span className={`font-mono font-bold tabular-nums ${s.cantidad > 0 ? 'text-ink-900 dark:text-ink-100' : 'text-ink-400'}`}>
                          {s.cantidad} {producto.unidad}
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </Card>
          )}

          {/* Resultado calculado */}
          {producto && calculo && cantidad !== '' && (
            <Card className={`overflow-hidden border-l-4 ${
              calculo.negativo
                ? 'border-l-rose-500'
                : calculo.bajoMinimo
                  ? 'border-l-amber-500'
                  : 'border-l-emerald-500'
            }`}>
              <div className="p-3">
                <p className="text-[10px] uppercase font-bold tracking-wider text-ink-500 mb-1.5">Resultado</p>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-center">
                    <p className="text-[10px] text-ink-500">Antes</p>
                    <p className="text-base font-bold tabular-nums text-ink-700 dark:text-ink-200">{calculo.stock}</p>
                  </div>
                  <div className="text-center flex-1">
                    <p className={`text-xs font-bold ${
                      calculo.delta > 0 ? 'text-emerald-600' : calculo.delta < 0 ? 'text-rose-600' : 'text-ink-500'
                    }`}>
                      {calculo.delta > 0 ? '+' : ''}{calculo.delta}
                    </p>
                    <div className="h-px bg-ink-200 dark:bg-ink-700 my-1" />
                    <p className="text-[9px] uppercase text-ink-400">{producto.unidad}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-ink-500">Nuevo</p>
                    <p className={`text-xl font-extrabold tabular-nums ${
                      calculo.negativo
                        ? 'text-rose-600'
                        : calculo.bajoMinimo
                          ? 'text-amber-600'
                          : 'text-emerald-600'
                    }`}>{calculo.nuevo}</p>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Alertas */}
          {calculo?.insuficienteEnOrigen && (
            <Card className="p-3 border-l-4 border-l-rose-500 bg-rose-50 dark:bg-rose-900/20">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-rose-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-rose-700 dark:text-rose-300 text-sm">Stock insuficiente en bodega origen</p>
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">
                    Disponible en esa bodega: <strong>{stockEnOrigen}</strong>. Ajusta la cantidad o elige otra bodega.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {calculo?.negativo && !calculo.insuficienteEnOrigen && (
            <Card className="p-3 border-l-4 border-l-rose-500 bg-rose-50 dark:bg-rose-900/20">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-rose-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-rose-700 dark:text-rose-300 text-sm">No se puede registrar</p>
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">
                    El movimiento dejaría el stock global en <strong>{calculo.nuevo}</strong>. El sistema no permite stock negativo.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {calculo?.bajoMinimo && !calculo.negativo && (
            <Card className="p-3 border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-900/20">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-700 dark:text-amber-300 text-sm">Stock quedará bajo mínimo</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                    Tras este movimiento el stock será <strong>{calculo.nuevo}</strong>, por debajo del mínimo ({calculo.minimo}). Se generará una alerta de reabastecimiento.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {calculo?.cantidadInvalida && (
            <Card className="p-3 border-l-4 border-l-rose-500 bg-rose-50 dark:bg-rose-900/20">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-rose-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-rose-700 dark:text-rose-300 text-sm">Cantidad inválida</p>
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">
                    Entradas y salidas requieren un valor positivo mayor a cero.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {puedeGuardar && (
            <Card className="p-3 border-l-4 border-l-emerald-500 bg-emerald-50 dark:bg-emerald-900/20">
              <div className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-emerald-700 dark:text-emerald-300 text-sm">Listo para registrar</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                    Los datos son válidos y el stock resultante está sano.
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </form>
    </div>
  )
}
