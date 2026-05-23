import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowRightLeft, TrendingUp, TrendingDown, Activity, Package,
  Plus, Minus, AlertTriangle, CheckCircle2, Info, ChevronLeft, Save,
} from 'lucide-react'
import {
  Button, Card, PageHeader, Select, Skeleton,
} from '../../components/ui'
import { getProductos, getAlmacenes, createMovimiento } from '../../api/inventario'
import { extractApiError } from '../../utils/apiError'

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
}

export default function RegistrarMovimiento() {
  const navigate = useNavigate()

  const [productos, setProductos] = useState([])
  const [almacenes, setAlmacenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [tipo, setTipo] = useState('ENTRADA')
  const [productoId, setProductoId] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [almacenId, setAlmacenId] = useState('')
  const [motivo, setMotivo] = useState('')

  useEffect(() => {
    Promise.all([
      getProductos({ limit: 500 }),
      getAlmacenes().catch(() => []),
    ])
      .then(([prods, alms]) => {
        setProductos(prods)
        setAlmacenes(alms)
      })
      .catch((err) => toast.error(extractApiError(err, 'Error al cargar datos')))
      .finally(() => setLoading(false))
  }, [])

  const tipoCfg = TIPOS.find((t) => t.key === tipo) || TIPOS[0]
  const colorCfg = COLORS[tipoCfg.color]

  const producto = useMemo(
    () => productos.find((p) => String(p.id) === String(productoId)),
    [productos, productoId]
  )

  // Cálculo del stock resultante con signo según tipo
  const calculo = useMemo(() => {
    if (!producto || cantidad === '' || isNaN(Number(cantidad))) return null
    const cant = Number(cantidad)
    const stock = Number(producto.stock_actual) || 0
    const minimo = Number(producto.stock_minimo) || 0
    let delta = 0
    if (tipo === 'ENTRADA') delta = Math.abs(cant)
    else if (tipo === 'SALIDA') delta = -Math.abs(cant)
    else delta = cant
    const nuevo = stock + delta
    return {
      stock,
      minimo,
      delta,
      nuevo,
      negativo: nuevo < 0,
      bajoMinimo: nuevo >= 0 && nuevo < minimo,
      cantidadInvalida: (tipo !== 'AJUSTE') && cant <= 0,
    }
  }, [producto, cantidad, tipo])

  // Sugiere el almacén "natural" según el tipo
  const almacenLabel = tipo === 'ENTRADA'
    ? 'Almacén destino'
    : tipo === 'SALIDA'
      ? 'Almacén origen'
      : 'Almacén (opcional)'

  const puedeGuardar =
    !!productoId &&
    cantidad !== '' &&
    !isNaN(Number(cantidad)) &&
    !!calculo &&
    !calculo.negativo &&
    !calculo.cantidadInvalida

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!puedeGuardar) return
    setSaving(true)
    try {
      const payload = {
        tipo,
        producto_id: Number(productoId),
        cantidad: Number(cantidad),
        motivo: motivo.trim() || null,
      }
      if (almacenId) {
        if (tipo === 'ENTRADA') payload.almacen_destino_id = Number(almacenId)
        else if (tipo === 'SALIDA') payload.almacen_origen_id = Number(almacenId)
        else payload.almacen_destino_id = Number(almacenId)
      }
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
    const nueva = Math.round((v + delta) * 100) / 100
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

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-6">
        {/* Form principal */}
        <Card className="lg:col-span-2 p-6 space-y-6">
          {/* Selector de tipo (3 cards) */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400 mb-2">
              Tipo de movimiento
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TIPOS.map((t) => {
                const c = COLORS[t.color]
                const isActive = tipo === t.key
                const Icon = t.Icon
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTipo(t.key)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      isActive
                        ? `${c.border} ${c.bg} ring-4 ${c.ring}`
                        : 'border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 hover:border-ink-300 dark:hover:border-ink-600'
                    }`}
                  >
                    <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${c.bg} ${c.text} mb-2`}>
                      <Icon size={20} />
                    </div>
                    <div className="flex items-center gap-2">
                      <p className={`font-bold ${isActive ? c.text : 'text-ink-900 dark:text-ink-100'}`}>{t.label}</p>
                      <span className={`text-xs font-mono font-bold ${c.text}`}>{t.sign}</span>
                    </div>
                    <p className="text-[11px] text-ink-500 dark:text-ink-400 mt-0.5">{t.desc}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Selector de producto */}
          <Select
            label="Producto"
            value={productoId}
            onChange={(e) => setProductoId(e.target.value)}
            required
          >
            <option value="">Selecciona un producto del catálogo...</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.codigo} — {p.descripcion} (stock: {p.stock_actual} {p.unidad})
              </option>
            ))}
          </Select>

          {/* Cantidad con stepper grande */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400 mb-2">
              Cantidad {tipo === 'AJUSTE' && <span className="font-normal normal-case text-ink-400">(puede ser negativa)</span>}
            </label>
            <div className="flex items-center justify-center gap-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl p-4 border border-ink-200 dark:border-ink-700">
              <button
                type="button"
                onClick={() => adjustCantidad(-1)}
                className="w-12 h-12 rounded-xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 hover:bg-ink-100 dark:hover:bg-ink-800 flex items-center justify-center text-ink-700 dark:text-ink-200 transition-colors"
              >
                <Minus size={20} />
              </button>
              <input
                type="number"
                step="0.01"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                onFocus={(e) => e.target.select()}
                placeholder="0"
                required
                className="w-32 h-14 text-center text-3xl font-extrabold tabular-nums rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900 dark:text-ink-100 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
              <button
                type="button"
                onClick={() => adjustCantidad(+1)}
                className="w-12 h-12 rounded-xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 hover:bg-ink-100 dark:hover:bg-ink-800 flex items-center justify-center text-ink-700 dark:text-ink-200 transition-colors"
              >
                <Plus size={20} />
              </button>
              {producto && (
                <span className="text-sm text-ink-500 ml-2">{producto.unidad}</span>
              )}
            </div>
          </div>

          {/* Almacén (opcional) */}
          {almacenes.length > 0 && (
            <Select
              label={`${almacenLabel} (opcional)`}
              value={almacenId}
              onChange={(e) => setAlmacenId(e.target.value)}
            >
              <option value="">Sin especificar</option>
              {almacenes.map((a) => (
                <option key={a.id} value={a.id}>{a.nombre}{a.ubicacion ? ` — ${a.ubicacion}` : ''}</option>
              ))}
            </Select>
          )}

          {/* Motivo */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400 mb-1">
              Motivo o notas {tipo === 'AJUSTE' && <span className="text-rose-500">*</span>}
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder={
                tipo === 'ENTRADA' ? 'Ej. Compra a proveedor X, factura 4567' :
                tipo === 'SALIDA'  ? 'Ej. Salida a obra Norte, orden 123'   :
                                     'Ej. Conteo físico, faltante por merma'
              }
              required={tipo === 'AJUSTE'}
              className="block w-full rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm p-3 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none resize-none"
            />
            {tipo === 'AJUSTE' && (
              <p className="text-[11px] text-rose-500 mt-1 inline-flex items-center gap-1">
                <Info size={11} /> Para ajustes el motivo es obligatorio (trazabilidad de auditoría).
              </p>
            )}
          </div>

          {/* Botones */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-ink-200 dark:border-ink-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/inventario/movimientos')}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={saving}
              disabled={!puedeGuardar || (tipo === 'AJUSTE' && !motivo.trim())}
              leftIcon={<Save size={15} />}
              className={`${colorCfg.btn} text-white border-0`}
            >
              Registrar {tipoCfg.label.toLowerCase()}
            </Button>
          </div>
        </Card>

        {/* Panel resumen / alertas */}
        <div className="space-y-5">
          {/* Tipo seleccionado */}
          <Card className="overflow-hidden">
            <div className={`p-4 ${colorCfg.bg} ${colorCfg.text} border-b border-ink-200 dark:border-ink-800`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/70 dark:bg-ink-900/40 flex items-center justify-center">
                  <tipoCfg.Icon size={20} />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider opacity-80">Movimiento</p>
                  <p className="text-lg font-extrabold">{tipoCfg.label}</p>
                </div>
              </div>
            </div>

            {/* Datos del producto */}
            <div className="p-4 space-y-3">
              {!producto ? (
                <div className="text-center py-6 text-ink-400">
                  <Package size={28} className="mx-auto mb-2 opacity-50" />
                  <p className="text-xs">Selecciona un producto para ver el resumen</p>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-wider text-ink-500 dark:text-ink-400">Producto</p>
                    <p className="font-bold text-ink-900 dark:text-ink-100 text-sm">{producto.descripcion}</p>
                    <p className="text-xs font-mono text-ink-500 dark:text-ink-400">{producto.codigo}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-lg bg-ink-50 dark:bg-ink-800 p-3">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-ink-500">Stock actual</p>
                      <p className="text-xl font-extrabold text-ink-900 dark:text-ink-100 tabular-nums">{producto.stock_actual}</p>
                      <p className="text-[10px] text-ink-500">{producto.unidad}</p>
                    </div>
                    <div className="rounded-lg bg-ink-50 dark:bg-ink-800 p-3">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-ink-500">Stock mínimo</p>
                      <p className="text-xl font-extrabold text-ink-900 dark:text-ink-100 tabular-nums">{producto.stock_minimo}</p>
                      <p className="text-[10px] text-ink-500">{producto.unidad}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Resultado calculado */}
          {producto && calculo && cantidad !== '' && (
            <Card className={`overflow-hidden border-l-4 ${
              calculo.negativo
                ? 'border-l-rose-500'
                : calculo.bajoMinimo
                  ? 'border-l-amber-500'
                  : 'border-l-emerald-500'
            }`}>
              <div className="p-4">
                <p className="text-[10px] uppercase font-bold tracking-wider text-ink-500 mb-2">Resultado</p>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-center">
                    <p className="text-xs text-ink-500">Antes</p>
                    <p className="text-lg font-bold tabular-nums text-ink-700 dark:text-ink-200">{calculo.stock}</p>
                  </div>
                  <div className="text-center flex-1">
                    <p className={`text-xs font-bold ${
                      calculo.delta > 0 ? 'text-emerald-600' : calculo.delta < 0 ? 'text-rose-600' : 'text-ink-500'
                    }`}>
                      {calculo.delta > 0 ? '+' : ''}{calculo.delta}
                    </p>
                    <div className="h-px bg-ink-200 dark:bg-ink-700 my-1.5" />
                    <p className="text-[10px] uppercase text-ink-400">{producto.unidad}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-ink-500">Nuevo</p>
                    <p className={`text-2xl font-extrabold tabular-nums ${
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
          {calculo?.negativo && (
            <Card className="p-4 border-l-4 border-l-rose-500 bg-rose-50 dark:bg-rose-900/20">
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="text-rose-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-rose-700 dark:text-rose-300 text-sm">No se puede registrar</p>
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">
                    El movimiento dejaría el stock en <strong>{calculo.nuevo}</strong>. El sistema no permite stock negativo.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {calculo?.bajoMinimo && !calculo.negativo && (
            <Card className="p-4 border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-900/20">
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
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
            <Card className="p-4 border-l-4 border-l-rose-500 bg-rose-50 dark:bg-rose-900/20">
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="text-rose-600 flex-shrink-0 mt-0.5" />
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
            <Card className="p-4 border-l-4 border-l-emerald-500 bg-emerald-50 dark:bg-emerald-900/20">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0 mt-0.5" />
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
