import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  TrendingUp, TrendingDown, Activity, Plus, Minus, Save, AlertTriangle,
  PackageCheck, ArrowRightLeft, FolderSync, History, Warehouse, ChevronRight,
  Info, Printer, X,
} from 'lucide-react'
import { Button, Modal, Select } from './ui'
import DisponibilidadBucket from './DisponibilidadBucket'
import PartePicker from './PartePicker'
import {
  createMovimientosLote, getDisponibilidadBuckets, imprimirValeMovimientos,
} from '../api/inventario'
import {
  REGLA_NINGUNA, disponibleSegunRegla, reglaDeDisponibilidad,
} from '../utils/buckets'
import { unidadPermiteDecimales } from '../utils/unidades'
import { extractApiError } from '../utils/apiError'

/**
 * Acciones de inventario sobre uno o varios productos, sin salir del catálogo.
 *
 * El almacenista llegaba al catálogo, encontraba el material y tenía que
 * volver a buscarlo en "Registrar movimiento" para tocarlo. Aquí se resuelve
 * lo diario —entrada, salida, ajuste— en el sitio, y lo que necesita más
 * contexto (entrega con comprobante, traspaso, reasignación) abre su pantalla
 * con el producto YA cargado, en vez de reimplementarse a medias.
 *
 * Lo que NO hace, a propósito: inventar una regla de stock nueva. La
 * disponibilidad se pide al mismo endpoint en lote que usa la entrega directa
 * y se lee con `reglaDeDisponibilidad`, el único lugar del SPA donde vive la
 * tabla de qué tipo de movimiento usa qué regla.
 *
 * Props:
 *   productos    array de productos completos (1 o N)
 *   almacenes    catálogo de bodegas (lo carga la pantalla que abre el modal)
 *   proyectos    catálogo de proyectos
 *   onDone       (idsMovidos) => void — tras registrar, para refrescar la lista
 *                de origen. Recibe SOLO los productos que entraron en la tanda:
 *                los que se dejaron en 0 no se movieron y no deben tratarse
 *                como si sí
 *   onVerStock   (producto) => void — abre el desglose por bodega, si existe
 */

const TIPOS = [
  { key: 'SALIDA',  label: 'Salida',  Icon: TrendingDown, color: 'rose',    ayuda: 'Sale material de la bodega.' },
  { key: 'ENTRADA', label: 'Entrada', Icon: TrendingUp,   color: 'emerald', ayuda: 'Llega material a la bodega.' },
  { key: 'AJUSTE',  label: 'Ajuste',  Icon: Activity,     color: 'amber',   ayuda: 'Corrige lo que dice el sistema contra lo que hay.' },
]

// Mismas familias de color que "Registrar movimiento": el mismo tipo de
// movimiento no puede ser rosa en una pantalla y rojo en otra.
const COLORS = {
  emerald: { border: 'border-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-300', ring: 'ring-emerald-500/20', btn: 'bg-emerald-600 hover:bg-emerald-700' },
  rose:    { border: 'border-rose-500',    bg: 'bg-rose-50 dark:bg-rose-900/20',       text: 'text-rose-700 dark:text-rose-300',       ring: 'ring-rose-500/20',    btn: 'bg-rose-600 hover:bg-rose-700' },
  amber:   { border: 'border-amber-500',   bg: 'bg-amber-50 dark:bg-amber-900/20',     text: 'text-amber-700 dark:text-amber-300',     ring: 'ring-amber-500/20',   btn: 'bg-amber-600 hover:bg-amber-700' },
}

// Tope de `MovimientoLoteSchema.items` en el backend. Se espeja aquí para
// avisar antes de mandar, en vez de comerse un 422 después de capturar todo.
const TOPE_LINEAS = 100

// Las partes del comprobante aplican a los movimientos con contraparte física: alguien
// entrega y alguien recibe. Un AJUSTE es interno (nadie recibe una merma), y por
// eso tampoco las pide "Registrar movimiento".
const llevaPartes = (tipo) => tipo === 'ENTRADA' || tipo === 'SALIDA'

export default function AccionesProductoModal({
  open, onClose, productos = [], almacenes = [], proyectos = [], onDone, onVerStock,
}) {
  const navigate = useNavigate()
  const unico = productos.length === 1 ? productos[0] : null

  const [tipo, setTipo] = useState('SALIDA')
  const [ajusteDir, setAjusteDir] = useState('+')
  const [almacenId, setAlmacenId] = useState('')
  const [proyectoId, setProyectoId] = useState('')
  const [cantidades, setCantidades] = useState({})   // { [productoId]: '2' }
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)

  // Partes del comprobante: quién entrega y quién recibe. Por defecto, quien entrega
  // es nombre libre (suele ser la bodega o un proveedor) y quien recibe es un
  // trabajador del sistema, que es el caso que hace falta poder rastrear.
  const [entregaModo, setEntregaModo] = useState('libre')
  const [entregaTrabajador, setEntregaTrabajador] = useState(null)
  const [entregaNombre, setEntregaNombre] = useState('')
  const [recibeModo, setRecibeModo] = useState('trabajador')
  const [recibeTrabajador, setRecibeTrabajador] = useState(null)
  const [recibeNombre, setRecibeNombre] = useState('')
  const [imprimirVale, setImprimirVale] = useState(true)

  const tipoCfg = TIPOS.find((t) => t.key === tipo) || TIPOS[0]
  const colorCfg = COLORS[tipoCfg.color]

  // Al abrir se parte de cero: dejar la cantidad de la tanda anterior es la
  // forma de entregar 10 de algo que solo se quería consultar.
  useEffect(() => {
    if (!open) return
    setTipo('SALIDA')
    setAjusteDir('+')
    setMotivo('')
    setCantidades(Object.fromEntries(productos.map((p) => [p.id, '1'])))
    // Con una sola bodega no hay nada que elegir; preseleccionarla ahorra el
    // paso obligatorio que igual solo tenía una respuesta posible.
    setAlmacenId(almacenes.length === 1 ? String(almacenes[0].id) : '')
    setProyectoId('')
    // Las partes también: firmar un comprobante con el nombre de quien recibió
    // la tanda anterior es justo el error que el comprobante existe para evitar.
    setEntregaModo('libre'); setEntregaTrabajador(null); setEntregaNombre('')
    setRecibeModo('trabajador'); setRecibeTrabajador(null); setRecibeNombre('')
    setImprimirVale(true)
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [open])

  // ── Disponibilidad real por bucket (bodega × proyecto) ────────────────────
  const [buckets, setBuckets] = useState({})
  const [cargandoBuckets, setCargandoBuckets] = useState(false)
  // Se incrementa tras registrar para releer existencias sin cerrar el modal:
  // si una tanda falla a medias, lo que queda en pantalla es el stock de ANTES
  // de los movimientos que sí pasaron, y reintentar sobre esa cifra es pedir
  // material que ya se fue.
  const [recarga, setRecarga] = useState(0)
  const idsClave = useMemo(
    () => productos.map((p) => p.id).sort((a, b) => a - b).join(','),
    [productos],
  )

  useEffect(() => {
    if (!open || !almacenId || !idsClave) { setBuckets({}); return }
    let cancel = false
    setCargandoBuckets(true)
    getDisponibilidadBuckets({
      ids: idsClave.split(',').map(Number),
      almacenId: Number(almacenId),
      proyectoId: proyectoId ? Number(proyectoId) : null,
    })
      .then((res) => {
        if (cancel) return
        setBuckets(Object.fromEntries((res.items || []).map((i) => [i.producto_id, i])))
      })
      .catch(() => { if (!cancel) setBuckets({}) })
      .finally(() => { if (!cancel) setCargandoBuckets(false) })
    return () => { cancel = true }
  }, [open, almacenId, proyectoId, idsClave, recarga])

  const regla = useMemo(() => reglaDeDisponibilidad(tipo, ajusteDir), [tipo, ajusteDir])
  // ENTRADA y AJUSTE+ no consumen: la bodega es el DESTINO, no el origen.
  const entraStock = tipo === 'ENTRADA' || (tipo === 'AJUSTE' && ajusteDir === '+')
  const proyectoSel = proyectos.find((p) => String(p.id) === String(proyectoId)) || null

  // ── Validaciones (espejo de las del backend) ──────────────────────────────
  const lineas = productos.map((p) => {
    const cantidad = cantidades[p.id] ?? ''
    const cant = Number(cantidad)
    const bucket = buckets[p.id] ?? null
    const disponible = bucket && regla !== REGLA_NINGUNA
      ? disponibleSegunRegla(bucket, regla)
      : null
    const decimalMal = cant > 0 && !unidadPermiteDecimales(p.unidad) && !Number.isInteger(cant)
    const excede = disponible != null && cant > disponible
    return { producto: p, cantidad, cant, bucket, disponible, decimalMal, excede }
  })
  const conCantidad = lineas.filter((l) => l.cant > 0)
  const hayError = lineas.some((l) => l.decimalMal || l.excede)
  const excedeTope = conCantidad.length > TOPE_LINEAS
  const motivoFaltante = tipo === 'AJUSTE' && !motivo.trim()
  const necesitaPartes = llevaPartes(tipo)
  const puedeRegistrar =
    !!almacenId && conCantidad.length > 0 && !hayError && !excedeTope && !motivoFaltante

  const setCantidad = (id, val) => setCantidades((prev) => ({ ...prev, [id]: val.replace('-', '') }))
  const stepCantidad = (id, delta) => setCantidades((prev) => {
    const v = Math.max(0, Math.round(((Number(prev[id]) || 0) + delta) * 100) / 100)
    return { ...prev, [id]: String(v) }
  })

  const registrar = async () => {
    if (!puedeRegistrar) return
    setSaving(true)
    try {
      const payload = {
        tipo,
        motivo: motivo.trim() || null,
        proyecto_id: proyectoId ? Number(proyectoId) : null,
        items: conCantidad.map((l) => ({
          producto_id: l.producto.id,
          // AJUSTE lleva el signo en la cantidad; el resto de tipos manda
          // siempre positivo y es el `tipo` el que decide si suma o resta.
          cantidad: tipo === 'AJUSTE' && ajusteDir === '-' ? -Math.abs(l.cant) : Math.abs(l.cant),
        })),
      }
      if (entraStock) payload.almacen_destino_id = Number(almacenId)
      else payload.almacen_origen_id = Number(almacenId)
      if (necesitaPartes) {
        if (entregaModo === 'trabajador' && entregaTrabajador) payload.entrega_trabajador_id = entregaTrabajador.id
        else if (entregaNombre.trim()) payload.entrega_nombre = entregaNombre.trim()
        if (recibeModo === 'trabajador' && recibeTrabajador) payload.recibe_trabajador_id = recibeTrabajador.id
        else if (recibeNombre.trim()) payload.recibe_nombre = recibeNombre.trim()
      }

      // Una sola petición: el backend aplica las N líneas en una transacción y
      // o pasan todas o no pasa ninguna. Mandarlas una por una dejaba stock
      // movido a medias cuando la tercera fallaba.
      const res = await createMovimientosLote(payload)
      toast.success(
        `${tipoCfg.label} registrada en ${res.total} producto${res.total === 1 ? '' : 's'}`,
      )
      // Un solo comprobante con todas las líneas, no N PDFs para la misma entrega.
      if (necesitaPartes && imprimirVale && res.ids?.length) {
        imprimirValeMovimientos(res.ids).catch(() => {})
      }
      onDone?.(conCantidad.map((l) => l.producto.id))
      onClose?.()
    } catch (err) {
      // El 409 del lote trae `errores` con la línea que lo tumbó; nombrar el
      // producto evita tener que adivinar cuál de los N fue.
      const detalle = err?.response?.data
      const porLinea = (detalle?.errores || [])
        .map((e) => {
          const p = productos.find((x) => x.id === e.producto_id)
          return `${p ? p.codigo : `#${e.producto_id}`}: ${e.detail}`
        })
        .slice(0, 5)
      toast.error(
        porLinea.length
          ? `No se registró nada.\n${porLinea.join('\n')}`
          : extractApiError(err, 'No se pudo registrar el movimiento'),
        { duration: 9000 },
      )
      // Nada cambió, pero otra sesión pudo haber movido stock mientras tanto:
      // se releen existencias para que el reintento vea la cifra de ahora.
      setRecarga((n) => n + 1)
    } finally {
      setSaving(false)
    }
  }

  // ── Atajos a las pantallas completas, con el producto ya cargado ──────────
  const irA = (path, state) => { onClose?.(); navigate(path, { state }) }

  if (!open) return null

  // `size="xl"` (max-w-4xl) y no `lg` (max-w-2xl): con las dos partes del
  // comprobante lado a lado y una línea por producto, los nombres largos
  // quedaban apretados. `full` se pasa al otro extremo y se come la pantalla.
  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      size="xl"
      title={unico ? `${unico.codigo} — ${unico.descripcion}` : `${productos.length} productos seleccionados`}
      description={unico
        ? `${unico.categoria || 'Sin categoría'} · ${unico.stock_disponible ?? unico.stock_actual} ${unico.unidad} disponibles en total`
        : 'Bodega, proyecto, motivo y quién entrega/recibe aplican a todos; la cantidad es por producto.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cerrar</Button>
          <Button
            loading={saving}
            disabled={!puedeRegistrar}
            leftIcon={<Save size={15} />}
            onClick={registrar}
            className={`${colorCfg.btn} text-white border-0`}
          >
            Registrar {tipoCfg.label.toLowerCase()}
            {conCantidad.length > 1 ? ` (${conCantidad.length})` : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Tipo de movimiento */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400 mb-1.5">
            ¿Qué vas a hacer?
          </label>
          <div className="grid grid-cols-3 gap-2">
            {TIPOS.map((t) => {
              const c = COLORS[t.color]
              const activo = tipo === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTipo(t.key)}
                  className={`p-2.5 rounded-lg border-2 transition-all ${
                    activo
                      ? `${c.border} ${c.bg} ring-2 ${c.ring}`
                      : 'border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 hover:border-ink-300 dark:hover:border-ink-600'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <t.Icon size={15} className={activo ? c.text : 'text-ink-400'} />
                    <span className={`text-sm font-bold ${activo ? c.text : 'text-ink-900 dark:text-ink-100'}`}>
                      {t.label}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
          <p className="text-[11px] text-ink-500 mt-1.5 italic">{tipoCfg.ayuda}</p>
        </div>

        {/* Dirección del ajuste */}
        {tipo === 'AJUSTE' && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAjusteDir('+')}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg border-2 font-bold text-sm transition-all ${
                ajusteDir === '+'
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                  : 'border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-500'
              }`}
            >
              <Plus size={14} /> Sobra (aumentar)
            </button>
            <button
              type="button"
              onClick={() => setAjusteDir('-')}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg border-2 font-bold text-sm transition-all ${
                ajusteDir === '-'
                  ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300'
                  : 'border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-500'
              }`}
            >
              <Minus size={14} /> Falta (disminuir)
            </button>
          </div>
        )}

        {/* Bodega + proyecto */}
        {almacenes.length === 0 ? (
          <p className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 inline-flex items-start gap-2">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            No hay bodegas registradas. Crea una en «Almacenes» antes de mover stock.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label={entraStock ? 'Bodega destino *' : 'Bodega origen *'}
              value={almacenId}
              onChange={(e) => setAlmacenId(e.target.value)}
            >
              <option value="">Selecciona bodega…</option>
              {almacenes.map((a) => (
                <option key={a.id} value={a.id}>{a.nombre}{a.ubicacion ? ` — ${a.ubicacion}` : ''}</option>
              ))}
            </Select>
            <Select
              label="Proyecto"
              value={proyectoId}
              onChange={(e) => setProyectoId(e.target.value)}
            >
              <option value="">General (sin proyecto)</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>{p.numero_proyecto}{p.nombre ? ` — ${p.nombre}` : ''}</option>
              ))}
            </Select>
          </div>
        )}

        {/* Cantidades por producto, con la disponibilidad que aplica al tipo */}
        <div className="rounded-lg border border-ink-200 dark:border-ink-800 divide-y divide-ink-100 dark:divide-ink-800 overflow-hidden">
          {lineas.map((l) => (
            <div
              key={l.producto.id}
              className={`flex items-center gap-3 px-3 py-2.5 ${
                !unico && l.cant <= 0 ? 'opacity-45' : ''
              }`}
            >
              <div className="flex-1 min-w-0">
                {!unico && (
                  <>
                    <p className="text-sm font-medium text-ink-900 dark:text-ink-100 truncate">{l.producto.descripcion}</p>
                    <p className="text-[11px] font-mono text-brand-700 dark:text-brand-300">{l.producto.codigo}</p>
                  </>
                )}
                {l.bucket && regla !== REGLA_NINGUNA ? (
                  <div className={unico ? '' : 'mt-0.5'}>
                    <DisponibilidadBucket
                      bucket={l.bucket}
                      regla={regla}
                      requerido={l.cant > 0 ? l.cant : null}
                      proyecto={proyectoSel?.numero_proyecto ?? null}
                      unidad={l.producto.unidad}
                      compacto
                    />
                  </div>
                ) : (
                  <p className="text-[11px] text-ink-400 italic">
                    {regla === REGLA_NINGUNA
                      ? 'Este movimiento suma stock: no consume existencias.'
                      : !almacenId
                        ? 'Elige la bodega para ver de dónde sale.'
                        : cargandoBuckets ? 'Consultando existencias…' : 'Sin existencia en esta bodega.'}
                  </p>
                )}
                {l.decimalMal && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                    «{l.producto.unidad}» no admite decimales.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => stepCantidad(l.producto.id, -1)}
                  className="w-8 h-8 rounded-md border border-ink-200 dark:border-ink-700 flex items-center justify-center text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800"
                >
                  <Minus size={14} />
                </button>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={l.cantidad}
                  onChange={(e) => setCantidad(l.producto.id, e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className={`w-20 h-9 text-center text-base font-bold tabular-nums rounded-md border bg-white dark:bg-ink-900 outline-none focus:ring-2 ${
                    l.decimalMal || l.excede
                      ? 'border-rose-400 focus:ring-rose-500/20'
                      : 'border-ink-200 dark:border-ink-700 focus:border-brand-500 focus:ring-brand-500/20'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => stepCantidad(l.producto.id, +1)}
                  className="w-8 h-8 rounded-md border border-ink-200 dark:border-ink-700 flex items-center justify-center text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800"
                >
                  <Plus size={14} />
                </button>
                <span className="text-[11px] text-ink-400 w-8">{l.producto.unidad}</span>
                {/* Sacar una línea de la tanda. Sin esto, un producto que no
                    tiene existencia en la bodega elegida bloquea el registro
                    entero y la única salida era cerrar, desmarcarlo en el
                    catálogo y volver a abrir. */}
                {!unico && (
                  <button
                    type="button"
                    onClick={() => setCantidad(l.producto.id, '0')}
                    disabled={l.cant <= 0}
                    title="Quitar de esta tanda"
                    aria-label={`Quitar ${l.producto.descripcion} de la tanda`}
                    className="w-8 h-8 rounded-md flex items-center justify-center text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Partes del comprobante: quién entrega y quién recibe. Solo en movimientos
            con contraparte física — en un ajuste no hay a quién entregarle. */}
        {necesitaPartes && (
          <div className="rounded-lg border border-ink-200 dark:border-ink-700 bg-ink-50/50 dark:bg-ink-800/30 p-3 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-500">Partes del comprobante</span>
              <span className="text-[10px] text-ink-400">(opcional)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <PartePicker
                label={tipo === 'ENTRADA' ? 'Quién entrega (proveedor)' : 'Quién entrega'}
                modo={entregaModo} setModo={setEntregaModo}
                trabajador={entregaTrabajador} setTrabajador={setEntregaTrabajador}
                nombre={entregaNombre} setNombre={setEntregaNombre}
              />
              <PartePicker
                label="Quién recibe"
                modo={recibeModo} setModo={setRecibeModo}
                trabajador={recibeTrabajador} setTrabajador={setRecibeTrabajador}
                nombre={recibeNombre} setNombre={setRecibeNombre}
              />
            </div>
            <label className="flex items-center gap-2 text-[11px] text-ink-600 dark:text-ink-300 cursor-pointer">
              <input
                type="checkbox"
                checked={imprimirVale}
                onChange={(e) => setImprimirVale(e.target.checked)}
                className="h-4 w-4 rounded border-ink-300 dark:border-ink-600 text-brand-600 focus:ring-brand-500 cursor-pointer"
              />
              <Printer size={12} className="text-ink-400" />
              {/* Un comprobante con TODAS las líneas, no uno por producto: lo
                  que se firma es la entrega, no cada renglón por separado. */}
              Abrir el comprobante para firmar al registrar
              {conCantidad.length > 1 ? ` (un solo PDF con los ${conCantidad.length} materiales)` : ''}
            </label>
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
            maxLength={250}
            placeholder={
              tipo === 'ENTRADA' ? 'Ej. Compra a proveedor X, factura 4567'
                : tipo === 'SALIDA' ? 'Ej. Consumo en obra Norte'
                  : 'Ej. Conteo físico, faltante por merma'
            }
            className="block w-full rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm p-2.5 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none resize-none"
          />
          {tipo === 'AJUSTE' && (
            <p className="text-[11px] text-rose-500 mt-1 inline-flex items-center gap-1">
              <Info size={11} /> En los ajustes el motivo es obligatorio (trazabilidad de auditoría).
            </p>
          )}
        </div>

        {excedeTope && (
          <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5 flex items-start gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>
              Son {conCantidad.length} líneas y el máximo por tanda es {TOPE_LINEAS}. Quita algunas y
              registra el resto en una segunda tanda.
            </span>
          </p>
        )}

        {conCantidad.length > 1 && !excedeTope && (
          <p className="text-[11px] text-ink-500 italic">
            Las {conCantidad.length} líneas se registran juntas: si una no pasa, no se registra ninguna
            y se te dice cuál fue.
          </p>
        )}

        {/* ── Otras acciones: abren la pantalla completa con esto ya cargado ── */}
        <div className="pt-3 border-t border-ink-200 dark:border-ink-800">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500 mb-2">
            Otras acciones
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <AccionLink
              Icon={PackageCheck}
              titulo="Entrega directa"
              detalle="Con proyecto, quién recibe y comprobante PDF"
              onClick={() => irA('/inventario/entrega-directa', { productos })}
            />
            {unico && (
              <AccionLink
                Icon={ArrowRightLeft}
                titulo="Traspaso entre bodegas"
                detalle="Mueve stock de una bodega a otra"
                onClick={() => irA('/inventario/movimientos/nuevo', { producto: unico, tipo: 'TRASPASO' })}
              />
            )}
            {unico && (
              <AccionLink
                Icon={FolderSync}
                titulo="Reasignar entre proyectos"
                detalle="Cambia la obra a la que está apartado"
                onClick={() => irA('/inventario/movimientos/nuevo', { producto: unico, tipo: 'REASIGNACION' })}
              />
            )}
            {unico && (
              <AccionLink
                Icon={History}
                titulo="Ver kardex"
                detalle="Historial de movimientos del producto"
                onClick={() => irA(`/inventario/productos/${unico.id}/kardex`)}
              />
            )}
            {unico && onVerStock && (
              <AccionLink
                Icon={Warehouse}
                titulo="Stock por bodega y proyecto"
                detalle="Dónde está repartido este material"
                onClick={() => { onClose?.(); onVerStock(unico) }}
              />
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

function AccionLink({ Icon, titulo, detalle, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left rounded-lg border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 px-3 py-2.5 hover:border-brand-300 dark:hover:border-brand-700 transition-colors focus-ring flex items-center gap-2.5"
    >
      <div className="h-8 w-8 rounded-lg inline-flex items-center justify-center shrink-0 bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200">
        <Icon size={15} strokeWidth={1.8} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink-900 dark:text-ink-100 truncate">{titulo}</p>
        <p className="text-[11px] text-ink-500 dark:text-ink-400 truncate">{detalle}</p>
      </div>
      <ChevronRight size={15} className="text-ink-300 dark:text-ink-600 group-hover:text-brand-500 shrink-0 transition-colors" />
    </button>
  )
}
