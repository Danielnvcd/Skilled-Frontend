import { useEffect, useMemo, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import toast from 'react-hot-toast'
import {
  ScanLine, X, PackagePlus, PackageMinus, Activity,
  ArrowLeft, Search, Boxes, ChevronRight,
} from 'lucide-react'
import {
  Button, Card, Select, Input
} from '../../components/ui'
import {
  createMovimiento, getInventarioEstante,
  getProductoPorCodigo, createMovimientoRapido,
  getProductoStocks,
} from '../../api/inventario'
import { validarUnidadQR } from '../../api/herramientas'
import { extractApiError } from '../../utils/apiError'
import { useNavigate } from 'react-router-dom'

// Placeholder SVG inline (mismo del legacy) — data: URIs están permitidos por el CSP.
const IMG_PLACEHOLDER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64' fill='none' stroke='%239ca3af' stroke-width='2'><rect x='8' y='12' width='48' height='40' rx='4'/><path d='M8 40l12-12 16 16 8-8 12 12'/><circle cx='22' cy='24' r='4'/></svg>"

export default function ScannerMovil() {
  const scannerRef = useRef(null)

  const navigate = useNavigate()

  // Vista actual: 'scanner' | 'menu' | 'products' | 'form' | 'product-action'
  const [view, setView] = useState('scanner')
  const [isScanning, setIsScanning] = useState(false)

  // Cuando el QR es de producto directo (no estante ni herramienta).
  const [productoDirecto, setProductoDirecto] = useState(null)
  // ajusteDir: '+' suma al stock, '-' resta. Solo aplica cuando tipo=AJUSTE.
  const [accionForm, setAccionForm] = useState({ tipo: 'SALIDA', cantidad: '', ajusteDir: '+' })
  // Buckets del producto escaneado. El movimiento rápido NO manda proyecto_id
  // —el escáner es una herramienta de bodega, no de asignación— así que solo
  // puede tocar el bucket General. Mostrar el stock global aquí era prometer
  // material que este camino nunca iba a poder mover.
  const [buckets, setBuckets] = useState(null)
  const [accionSaving, setAccionSaving] = useState(false)

  const [estante, setEstante] = useState(null)
  // Productos colocados en el estante via ProductoEstante (Pausa 4 + 11). Al
  // escanear el QR se muestran exactamente los del rack, con su ubicación.
  const [productosEstanteApi, setProductosEstanteApi] = useState(null)
  const [searchText, setSearchText] = useState('')

  const [form, setForm] = useState({ tipo: 'ENTRADA', producto_id: '', cantidad: '' })
  const [saving, setSaving] = useState(false)

  // Lista de productos del estante: lo que devolvió /estantes/<qr>/inventario.
  const productosEstante = useMemo(
    () => (estante ? (productosEstanteApi || []) : []),
    [estante, productosEstanteApi],
  )

  const filteredProducts = useMemo(() => {
    const q = searchText.trim().toLowerCase()
    if (!q) return productosEstante
    return productosEstante.filter(p =>
      (p.codigo || '').toLowerCase().includes(q) ||
      (p.descripcion || '').toLowerCase().includes(q)
    )
  }, [productosEstante, searchText])

  // En móvil, pintar cientos de filas con imagen cuelga. Mostramos de a bloques
  // ("Mostrar más"); se reinicia al cambiar la búsqueda o el estante.
  const SCAN_STEP = 50
  const [scanVisible, setScanVisible] = useState(SCAN_STEP)
  useEffect(() => { setScanVisible(SCAN_STEP) }, [searchText, estante])
  const productosVisibles = filteredProducts.slice(0, scanVisible)

  // Lifecycle del scanner: se monta cuando isScanning=true (el div #reader ya está en DOM).
  useEffect(() => {
    if (!isScanning) return

    const qrScanner = new Html5Qrcode('reader')
    scannerRef.current = qrScanner
    let stopped = false

    qrScanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (stopped) return
          stopped = true
          qrScanner.stop().finally(() => {
            setIsScanning(false)
            handleQRScanned(decodedText)
          })
        },
        () => {}
      )
      .catch((err) => {
        console.error('Scanner start failed:', err)
        toast.error('Error al iniciar la cámara. Verifica los permisos.')
        setIsScanning(false)
      })

    return () => {
      stopped = true
      if (qrScanner.getState && qrScanner.getState() === 2) {
        qrScanner.stop().catch(() => {})
      }
      scannerRef.current = null
    }
  }, [isScanning])

  const startScanner = () => setIsScanning(true)
  const stopScanner = () => setIsScanning(false)

  const handleQRScanned = async (qrCodeText) => {
    toast.loading('Validando QR…', { id: 'qr' })
    // Orden de pruebas: estante → herramienta → producto (código).
    try {
      const data = await getInventarioEstante(qrCodeText)
      setEstante(data.estante)
      setProductosEstanteApi(data.productos || [])
      setSearchText('')
      setForm({ tipo: 'ENTRADA', producto_id: '', cantidad: '' })
      setView('menu')
      toast.success(`Estante ${data.estante.nombre} detectado`, { id: 'qr' })
      return
    } catch { /* probar herramienta */ }
    try {
      const unidad = await validarUnidadQR(qrCodeText)
      toast.success(`Herramienta ${unidad.codigo_interno}`, { id: 'qr' })
      navigate(`/inventario/herramientas/unidades/${unidad.id}`)
      return
    } catch { /* probar producto */ }
    try {
      const prod = await getProductoPorCodigo(qrCodeText)
      setProductoDirecto(prod)
      setAccionForm({ tipo: 'SALIDA', cantidad: '' })
      setView('product-action')
      toast.success(`Producto ${prod.codigo}`, { id: 'qr' })
    } catch {
      toast.error('QR no reconocido (no es estante, herramienta ni producto)', { id: 'qr' })
    }
  }

  useEffect(() => {
    if (!productoDirecto?.id) { setBuckets(null); return }
    let cancel = false
    getProductoStocks(productoDirecto.id)
      .then((res) => {
        if (cancel) return
        let libre = 0
        let apartado = 0
        for (const f of res.stocks_proyecto || []) {
          if (f.proyecto_id == null) libre += Number(f.cantidad) || 0
          else apartado += Number(f.cantidad) || 0
        }
        setBuckets({ libre, apartado })
      })
      .catch(() => { if (!cancel) setBuckets(null) })
    return () => { cancel = true }
  }, [productoDirecto?.id])

  const submitAccionRapida = async (e) => {
    e.preventDefault()
    if (!productoDirecto) return
    if (!accionForm.cantidad) return
    setAccionSaving(true)
    // Para AJUSTE, el signo lo determinan los botones +/-. Para ENTRADA/SALIDA
    // siempre es positivo (el backend usa el `tipo` para decidir suma o resta).
    const rawCant = Math.abs(Number(accionForm.cantidad))
    const cantidadFinal = accionForm.tipo === 'AJUSTE' && accionForm.ajusteDir === '-'
      ? -rawCant
      : rawCant
    try {
      await createMovimientoRapido({
        producto_qr: productoDirecto.codigo,
        tipo: accionForm.tipo,
        cantidad: cantidadFinal,
        motivo: `Móvil QR — Producto ${productoDirecto.codigo}`,
      })
      const verbo = accionForm.tipo === 'AJUSTE'
        ? (accionForm.ajusteDir === '+' ? `+${rawCant}` : `-${rawCant}`)
        : `${accionForm.tipo.toLowerCase()} de ${rawCant}`
      toast.success(`${productoDirecto.codigo}: ${verbo} ${productoDirecto.unidad || ''}`)
      setProductoDirecto(null)
      setAccionForm({ tipo: 'SALIDA', cantidad: '', ajusteDir: '+' })
      setView('scanner')
      setIsScanning(true)
    } catch (err) {
      toast.error(extractApiError(err, 'Error al registrar el movimiento'))
    } finally {
      setAccionSaving(false)
    }
  }

  const openMovementForm = (tipo, productoId = '') => {
    setForm({ tipo, producto_id: productoId ? String(productoId) : '', cantidad: '' })
    setView('form')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await createMovimiento({
        ...form,
        producto_id: Number(form.producto_id),
        cantidad: Number(form.cantidad),
        estante_id: estante.id,
        motivo: `Móvil QR — Estante ${estante.nombre}`,
      })
      toast.success('Movimiento registrado')
      setForm({ ...form, producto_id: '', cantidad: '' })
      setView('menu')
    } catch {
      toast.error('Error al registrar el movimiento')
    } finally {
      setSaving(false)
    }
  }

  const backToScanner = () => {
    setEstante(null)
    setProductosEstanteApi(null)
    setProductoDirecto(null)
    setSearchText('')
    setView('scanner')
  }

  const scanAnother = () => {
    setEstante(null)
    setProductosEstanteApi(null)
    setProductoDirecto(null)
    setSearchText('')
    setView('scanner')
    setIsScanning(true)
  }

  // ────────────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-md mx-auto">
      {/* Modal scanner — siempre montado cuando isScanning para que #reader exista */}
      {isScanning && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute -top-12 right-0 text-white hover:bg-white/20"
              onClick={stopScanner}
            >
              <X size={24} />
            </Button>
            <div id="reader" className="w-full rounded-2xl overflow-hidden shadow-2xl bg-black" />
            <p className="text-center text-white mt-4 font-medium">Buscando código QR...</p>
          </div>
        </div>
      )}

      {/* VIEW: scanner */}
      {view === 'scanner' && !isScanning && (
        <div className="text-center py-10 space-y-6">
          <ScanLine size={80} className="mx-auto text-brand-500 opacity-50" />
          <div>
            <h2 className="text-xl font-bold text-ink-900 dark:text-ink-100 mb-2">Escáner Móvil</h2>
            <p className="text-ink-500">Apunta la cámara al código QR pegado en el estante para registrar entradas y salidas rápidamente.</p>
          </div>
          <Button size="lg" className="w-full" leftIcon={<ScanLine />} onClick={startScanner}>
            Iniciar Escáner
          </Button>
        </div>
      )}

      {/* VIEW: menú post-escaneo */}
      {view === 'menu' && estante && (
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="p-4 bg-brand-50 dark:bg-brand-900/30 border-b border-brand-100 dark:border-brand-800 rounded-t-xl">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-600">
              {estante.almacen_id ? `Almacén #${estante.almacen_id}` : 'Estante'}
            </span>
            <h2 className="text-xl font-bold text-ink-900 dark:text-ink-100">{estante.nombre}</h2>
            <p className="text-xs text-ink-500 mt-1">
              {estante.descripcion || `Rack ${estante.columnas || 1}×${estante.filas || 1}`}
            </p>
          </div>

          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setView('products')}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-transparent bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 hover:border-sky-400 transition-all"
              >
                <Boxes size={28} />
                <span className="text-sm font-bold">Ver productos</span>
                <span className="text-[10px] text-ink-500">
                  {productosEstante.length} {productosEstante.length === 1 ? 'producto' : 'productos'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => openMovementForm('ENTRADA')}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-transparent bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 hover:border-emerald-400 transition-all"
              >
                <PackagePlus size={28} />
                <span className="text-sm font-bold">Entrada</span>
                <span className="text-[10px] text-ink-500">Sumar stock</span>
              </button>

              <button
                type="button"
                onClick={() => openMovementForm('SALIDA')}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-transparent bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:border-red-400 transition-all"
              >
                <PackageMinus size={28} />
                <span className="text-sm font-bold">Salida</span>
                <span className="text-[10px] text-ink-500">Restar stock</span>
              </button>

              <button
                type="button"
                onClick={() => openMovementForm('AJUSTE')}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-transparent bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:border-amber-400 transition-all"
              >
                <Activity size={28} />
                <span className="text-sm font-bold">Ajuste</span>
                <span className="text-[10px] text-ink-500">Corregir stock</span>
              </button>
            </div>

            <Button variant="ghost" className="w-full" leftIcon={<ScanLine size={16} />} onClick={scanAnother}>
              Escanear otro QR
            </Button>
          </div>
        </Card>
      )}

      {/* VIEW: lista de productos */}
      {view === 'products' && estante && (
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="p-4 border-b border-ink-200 dark:border-ink-800 flex items-center gap-3">
            <Button variant="ghost" size="icon-sm" onClick={() => setView('menu')}>
              <ArrowLeft size={18} />
            </Button>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-ink-900 dark:text-ink-100 truncate">{estante.nombre}</h3>
              <p className="text-xs text-ink-500">{estante.descripcion || 'Productos del rack'}</p>
            </div>
          </div>

          <div className="p-3 border-b border-ink-200 dark:border-ink-800">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
              <input
                type="text"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                placeholder="Buscar por código o descripción…"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900 dark:text-ink-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto divide-y divide-ink-100 dark:divide-ink-800">
            {filteredProducts.length === 0 ? (
              <p className="p-6 text-center text-sm italic text-ink-500">
                {productosEstante.length === 0
                  ? 'Este rack no tiene productos asignados. Agrégalos en Almacenes → Acomodar.'
                  : 'Sin resultados.'}
              </p>
            ) : (
              productosVisibles.map(p => {
                const stockActual = parseFloat(p.stock_actual) || 0
                const stockMin = parseFloat(p.stock_minimo) || 0
                const isLow = stockActual <= stockMin
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => openMovementForm('ENTRADA', p.id)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-ink-50 dark:hover:bg-ink-800/50 text-left transition-colors"
                  >
                    <div className="w-12 h-12 rounded-md bg-ink-100 dark:bg-ink-800 flex-shrink-0 overflow-hidden">
                      <img
                        src={p.imagen_url || IMG_PLACEHOLDER}
                        alt={p.descripcion}
                        loading="lazy"
                        onError={(e) => { e.currentTarget.src = IMG_PLACEHOLDER }}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs text-ink-500 font-mono">{p.codigo || '—'}</p>
                        {p.ubicacion?.fila != null && p.ubicacion?.columna != null && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300">
                            C{p.ubicacion.columna}·F{p.ubicacion.fila}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-ink-900 dark:text-ink-100 truncate">{p.descripcion || '—'}</p>
                      <p className={`text-xs font-medium mt-0.5 ${isLow ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {stockActual.toFixed(1)} {p.unidad || ''}
                        {p.ubicacion?.cantidad > 0 && (
                          <span className="ml-1 text-ink-400">· {Number(p.ubicacion.cantidad) % 1 === 0 ? Number(p.ubicacion.cantidad) : Number(p.ubicacion.cantidad).toFixed(2)} aquí</span>
                        )}
                        {isLow && <span className="ml-1 px-1.5 py-0.5 text-[9px] bg-red-500 text-white rounded font-bold">BAJO</span>}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-ink-400 flex-shrink-0" />
                  </button>
                )
              })
            )}
            {filteredProducts.length > scanVisible && (
              <button
                type="button"
                onClick={() => setScanVisible((n) => n + SCAN_STEP)}
                className="w-full p-3 text-center text-sm font-semibold text-brand-700 dark:text-brand-300 hover:bg-ink-50 dark:hover:bg-ink-800/50"
              >
                Mostrar más ({filteredProducts.length - scanVisible} restantes)
              </button>
            )}
          </div>
        </Card>
      )}

      {/* VIEW: formulario de movimiento */}
      {view === 'form' && estante && (
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="p-4 border-b border-ink-200 dark:border-ink-800 flex items-center gap-3">
            <Button variant="ghost" size="icon-sm" onClick={() => setView('menu')}>
              <ArrowLeft size={18} />
            </Button>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-ink-900 dark:text-ink-100 truncate">{estante.nombre}</h3>
              <p className="text-xs text-ink-500">Registrar movimiento</p>
            </div>
          </div>

          <div className="p-5">
            <div className="grid grid-cols-3 gap-2 mb-5">
              <button
                type="button"
                onClick={() => setForm({ ...form, tipo: 'ENTRADA' })}
                className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${form.tipo === 'ENTRADA' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700' : 'border-transparent bg-ink-100 dark:bg-ink-800 text-ink-500'}`}
              >
                <PackagePlus size={20} />
                <span className="text-xs font-bold mt-1">Entrada</span>
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, tipo: 'SALIDA' })}
                className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${form.tipo === 'SALIDA' ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700' : 'border-transparent bg-ink-100 dark:bg-ink-800 text-ink-500'}`}
              >
                <PackageMinus size={20} />
                <span className="text-xs font-bold mt-1">Salida</span>
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, tipo: 'AJUSTE' })}
                className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${form.tipo === 'AJUSTE' ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700' : 'border-transparent bg-ink-100 dark:bg-ink-800 text-ink-500'}`}
              >
                <Activity size={20} />
                <span className="text-xs font-bold mt-1">Ajuste</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Select
                label="Producto"
                value={form.producto_id}
                onChange={e => setForm({ ...form, producto_id: e.target.value })}
                required
              >
                <option value="">
                  {productosEstante.length === 0 ? 'Sin productos disponibles' : 'Selecciona un producto…'}
                </option>
                {productosEstante.map(p => (
                  <option key={p.id} value={p.id}>
                    [{p.codigo}] {p.descripcion} — Stock: {parseFloat(p.stock_actual).toFixed(1)} {p.unidad}
                  </option>
                ))}
              </Select>

              <Input
                label="Cantidad"
                type="number"
                step="0.01"
                min={form.tipo === 'AJUSTE' ? undefined : 0.01}
                required
                value={form.cantidad}
                onChange={e => setForm({ ...form, cantidad: e.target.value })}
                placeholder="0"
                className="text-center text-xl font-bold"
              />

              <Button
                type="submit"
                className="w-full h-12 text-lg"
                loading={saving}
                disabled={!form.producto_id || !form.cantidad}
              >
                Guardar movimiento
              </Button>
            </form>
          </div>
        </Card>
      )}

      {/* VIEW: producto escaneado directo — acción rápida */}
      {view === 'product-action' && productoDirecto && (
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="p-4 bg-brand-50 dark:bg-brand-900/30 border-b border-brand-100 dark:border-brand-800 rounded-t-xl flex items-center gap-3">
            <Button variant="ghost" size="icon-sm" onClick={backToScanner}>
              <ArrowLeft size={18} />
            </Button>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-600">Producto</span>
              <h2 className="text-lg font-bold text-ink-900 dark:text-ink-100 truncate">{productoDirecto.descripcion}</h2>
              <p className="text-xs text-ink-500 font-mono">{productoDirecto.codigo}</p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md bg-ink-50 dark:bg-ink-800/50 p-3">
                <p className="text-[10px] uppercase text-ink-500 font-bold">En bodega</p>
                <p className="text-lg font-bold tabular-nums">{Number(productoDirecto.stock_actual ?? 0).toFixed(2)} {productoDirecto.unidad}</p>
              </div>
              <div className={`rounded-md p-3 ${buckets && buckets.apartado > 0 ? 'bg-brand-50 dark:bg-brand-900/20 ring-1 ring-brand-500/20' : 'bg-ink-50 dark:bg-ink-800/50'}`}>
                <p className="text-[10px] uppercase text-ink-500 font-bold">Puedes mover</p>
                <p className="text-lg font-bold tabular-nums">
                  {buckets
                    ? `${buckets.libre.toFixed(2)}`
                    : Number(productoDirecto.stock_disponible ?? productoDirecto.stock_actual ?? 0).toFixed(2)}
                </p>
              </div>
            </div>

            {/* Cuando hay material apartado, la diferencia entre las dos cifras
                de arriba necesita explicación: si no, parece que el sistema
                perdió stock. */}
            {buckets && buckets.apartado > 0 && (
              <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/60 p-3 text-xs">
                <p className="font-semibold text-amber-800 dark:text-amber-200">
                  {buckets.apartado.toFixed(2)} {productoDirecto.unidad} están apartados a proyectos.
                </p>
                <p className="text-amber-700 dark:text-amber-300 mt-0.5">
                  Desde aquí solo se mueve lo libre. Para sacar material de una obra usa
                  Entrega directa o Material por proyecto, que sí registran de qué obra sale.
                </p>
              </div>
            )}

            <form onSubmit={submitAccionRapida} className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setAccionForm({ ...accionForm, tipo: 'ENTRADA' })}
                  className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${accionForm.tipo === 'ENTRADA' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700' : 'border-transparent bg-ink-100 dark:bg-ink-800 text-ink-500'}`}
                >
                  <PackagePlus size={20} />
                  <span className="text-xs font-bold mt-1">Entrada</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAccionForm({ ...accionForm, tipo: 'SALIDA' })}
                  className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${accionForm.tipo === 'SALIDA' ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700' : 'border-transparent bg-ink-100 dark:bg-ink-800 text-ink-500'}`}
                >
                  <PackageMinus size={20} />
                  <span className="text-xs font-bold mt-1">Salida</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAccionForm({ ...accionForm, tipo: 'AJUSTE' })}
                  className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${accionForm.tipo === 'AJUSTE' ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700' : 'border-transparent bg-ink-100 dark:bg-ink-800 text-ink-500'}`}
                >
                  <Activity size={20} />
                  <span className="text-xs font-bold mt-1">Ajuste</span>
                </button>
              </div>

              {accionForm.tipo === 'AJUSTE' && (
                <div>
                  <p className="text-xs font-medium text-ink-700 dark:text-ink-300 mb-2">
                    ¿Sumar o restar al stock?
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAccionForm({ ...accionForm, ajusteDir: '+' })}
                      className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                        accionForm.ajusteDir === '+'
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700'
                          : 'border-transparent bg-ink-100 dark:bg-ink-800 text-ink-500'
                      }`}
                    >
                      <PackagePlus size={16} />
                      Aumentar (+)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccionForm({ ...accionForm, ajusteDir: '-' })}
                      className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                        accionForm.ajusteDir === '-'
                          ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700'
                          : 'border-transparent bg-ink-100 dark:bg-ink-800 text-ink-500'
                      }`}
                    >
                      <PackageMinus size={16} />
                      Disminuir (−)
                    </button>
                  </div>
                  <p className="text-[10px] text-ink-500 mt-2 text-center">
                    {accionForm.ajusteDir === '+'
                      ? `Encontraste piezas de más (sobran ${accionForm.cantidad || 'N'}).`
                      : `Faltan piezas o se dañaron (faltan ${accionForm.cantidad || 'N'}).`}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-ink-700 dark:text-ink-300 mb-1.5">
                  Cantidad{accionForm.tipo === 'AJUSTE' && ' (siempre positiva)'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={accionForm.cantidad}
                  onChange={e => setAccionForm({ ...accionForm, cantidad: e.target.value.replace('-', '') })}
                  placeholder="0"
                  autoFocus
                  className="w-full px-3 py-3 text-center text-2xl font-bold rounded-md border border-ink-300 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900 dark:text-ink-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-lg"
                loading={accionSaving}
                disabled={!accionForm.cantidad}
              >
                Registrar y escanear siguiente
              </Button>
            </form>

            <Button
              variant="ghost"
              className="w-full"
              leftIcon={<ScanLine size={16} />}
              onClick={scanAnother}
            >
              Escanear otro QR (sin guardar)
            </Button>

            <p className="text-[10px] text-center text-ink-500">
              Se usa el almacén default. Para elegir otro, usa "Registrar movimiento".
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}
