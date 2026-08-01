import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  PackageCheck, Trash2, Plus, Minus, Save, User, Search,
  Warehouse, FolderOpen, Printer, AlertTriangle, X, Pencil, PackagePlus, Check,
} from 'lucide-react'
import {
  Button, Card, PageHeader, Modal, Select, Skeleton, Pagination,
} from '../../components/ui'
import {
  getAlmacenes, getProyectosInventario,
  createEntregaDirecta, imprimirSolicitud, getDisponibilidadBuckets,
} from '../../api/inventario'
import { useProductoSearch } from '../../hooks/useProductoSearch'
import DisponibilidadBucket from '../../components/DisponibilidadBucket'
import { REGLA_CON_FALLBACK, disponibleSegunRegla } from '../../utils/buckets'
import { extractApiError } from '../../utils/apiError'
import { unidadPermiteDecimales } from '../../utils/unidades'
import { cableResumen } from '../../utils/cable'
import TrabajadorPicker from '../../components/TrabajadorPicker'

// ── Modal: buscar y agregar productos (estilo punto de venta) ────────────────
function ModalAgregarProducto({ open, onClose, enCarrito, onToggle }) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  // Al abrir, limpia y enfoca; cierra → resetea.
  useEffect(() => {
    if (open) {
      setQuery(''); setDebounced('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Búsqueda paginada por páginas: el paginador navega el resto del catálogo.
  const { opciones, loading, page, setPage, total, totalPages, size } = useProductoSearch({
    q: debounced, enabled: open, pageSize: 50,
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Agregar material"
      footer={<Button onClick={onClose}>Listo</Button>}
    >
      <div className="space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Busca por código o descripción…"
            className="block w-full h-10 pl-9 pr-3 rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
          />
        </div>

        <div className="max-h-[55vh] overflow-y-auto -mx-1 px-1 divide-y divide-ink-100 dark:divide-ink-800">
          {loading ? (
            <div className="py-6 text-center text-sm text-ink-400">Buscando…</div>
          ) : opciones.length === 0 ? (
            <div className="py-6 text-center text-sm text-ink-400">Sin coincidencias</div>
          ) : (
            opciones.map((p) => {
              const dentro = enCarrito.has(p.id)
              const disp = p.stock_disponible ?? p.stock_actual
              return (
                <div key={p.id} className="flex items-center gap-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-900 dark:text-ink-100 truncate">{p.descripcion}</p>
                    <p className="text-[11px] text-ink-500 font-mono">
                      {p.codigo} · disp: <span className={disp <= 0 ? 'text-rose-500' : ''}>{disp} {p.unidad}</span>
                    </p>
                    {cableResumen(p) && (
                      <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">{cableResumen(p)} mm²/AWG</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={dentro ? 'secondary' : 'primary'}
                    leftIcon={dentro ? <Check size={14} /> : <Plus size={14} />}
                    onClick={() => onToggle(p)}
                  >
                    {dentro ? 'Agregado' : 'Agregar'}
                  </Button>
                </div>
              )
            })
          )}
          {!loading && totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} totalElements={total} size={size} onChange={setPage} />
          )}
        </div>
      </div>
    </Modal>
  )
}

export default function EntregaDirecta() {
  const [almacenes, setAlmacenes] = useState([])
  const [proyectos, setProyectos] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Datos de la entrega
  const [proyectoId, setProyectoId] = useState('')
  const [almacenOrigenId, setAlmacenOrigenId] = useState('')
  const [modoSolic, setModoSolic] = useState('trabajador') // 'trabajador' | 'libre'
  const [trabajador, setTrabajador] = useState(null)
  const [nombreLibre, setNombreLibre] = useState('')
  const [notas, setNotas] = useState('')

  // Carrito de materiales: [{ producto, cantidad }].
  // Puede llegar precargado desde el catálogo (`state.productos`): ahí el
  // almacenista ya eligió el material, y obligarlo a buscarlo otra vez en el
  // modal de "Agregar material" era rehacer el trabajo que acababa de hacer.
  const { pathname, state: precarga } = useLocation()
  const navigate = useNavigate()
  const [items, setItems] = useState(
    () => (precarga?.productos ?? []).map((p) => ({ producto: p, cantidad: '1' })),
  )

  // La precarga se consume UNA vez y se borra del history. El state sobrevive a
  // un F5 y al botón «atrás»: sin esto, entregar y recargar volvía a llenar el
  // carrito con el material que se acababa de entregar —ya descontado del
  // stock— listo para descontarlo otra vez sin que nada avisara.
  useEffect(() => {
    if (precarga) navigate(pathname, { replace: true, state: null })
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [])

  // Modales
  const [datosOpen, setDatosOpen] = useState(false)
  const [prodOpen, setProdOpen] = useState(false)

  useEffect(() => {
    Promise.all([getAlmacenes(), getProyectosInventario()])
      .then(([alms, proys]) => {
        setAlmacenes(alms)
        setProyectos(proys)
        if (alms.length === 1) setAlmacenOrigenId(String(alms[0].id))
      })
      .catch((err) => toast.error(extractApiError(err, 'Error al cargar datos')))
      .finally(() => setLoading(false))
  }, [])

  const proyectoSel = useMemo(
    () => proyectos.find((p) => String(p.id) === String(proyectoId)) || null,
    [proyectos, proyectoId],
  )

  // Disponibilidad REAL de cada material en la bodega elegida, separada en «del
  // proyecto» y «libre». Antes se validaba contra `stock_disponible`, que es el
  // total del producto en TODAS las bodegas y sin distinguir bucket: la pantalla
  // decía que sí y el backend respondía «disponible 60 (proyecto 40 + general
  // 20)» al entregar. La entrega usa la regla proyecto→General.
  const [buckets, setBuckets] = useState({})
  const [cargandoBuckets, setCargandoBuckets] = useState(false)
  const idsEnCarrito = useMemo(
    () => items.map((it) => it.producto.id).sort((a, b) => a - b).join(','),
    [items],
  )

  useEffect(() => {
    if (!almacenOrigenId || !idsEnCarrito) { setBuckets({}); return }
    let cancel = false
    setCargandoBuckets(true)
    getDisponibilidadBuckets({
      ids: idsEnCarrito.split(',').map(Number),
      almacenId: Number(almacenOrigenId),
      proyectoId: proyectoId ? Number(proyectoId) : null,
    })
      .then((res) => {
        if (cancel) return
        setBuckets(Object.fromEntries((res.items || []).map((i) => [i.producto_id, i])))
      })
      .catch(() => { if (!cancel) setBuckets({}) })
      .finally(() => { if (!cancel) setCargandoBuckets(false) })
    return () => { cancel = true }
  }, [almacenOrigenId, proyectoId, idsEnCarrito])
  const almacenSel = useMemo(
    () => almacenes.find((a) => String(a.id) === String(almacenOrigenId)) || null,
    [almacenes, almacenOrigenId],
  )
  const recibeNombre = modoSolic === 'trabajador'
    ? (trabajador?.nombre_completo || '')
    : nombreLibre.trim()

  // ── Carrito ──
  const enCarrito = useMemo(() => new Set(items.map((it) => it.producto.id)), [items])
  const toggleProducto = (p) => {
    setItems((prev) => {
      if (prev.some((it) => it.producto.id === p.id)) {
        return prev.filter((it) => it.producto.id !== p.id)
      }
      return [...prev, { producto: p, cantidad: '1' }]
    })
  }
  const removeItem = (id) => setItems((prev) => prev.filter((it) => it.producto.id !== id))
  const setCantidad = (id, val) => setItems((prev) => prev.map((it) =>
    it.producto.id === id ? { ...it, cantidad: val } : it,
  ))
  const stepCantidad = (id, delta) => setItems((prev) => prev.map((it) => {
    if (it.producto.id !== id) return it
    const v = Math.max(0, Math.round(((Number(it.cantidad) || 0) + delta) * 100) / 100)
    return { ...it, cantidad: String(v) }
  }))

  // ── Validaciones (espejo del backend) ──
  const datosOk = !!proyectoId && !!almacenOrigenId && !!recibeNombre
  const itemsValidos = items.filter((it) => Number(it.cantidad) > 0)
  const hayEnteroInvalido = items.some((it) => {
    const c = Number(it.cantidad)
    return c > 0 && !unidadPermiteDecimales(it.producto.unidad) && !Number.isInteger(c)
  })
  const puedeGuardar = datosOk && itemsValidos.length > 0 && !hayEnteroInvalido

  const handleSubmit = async () => {
    if (!puedeGuardar) return
    setSaving(true)
    try {
      const payload = {
        proyecto: proyectoSel ? proyectoSel.numero_proyecto : '',
        proyecto_id: proyectoSel ? proyectoSel.id : null,
        almacen_origen_id: Number(almacenOrigenId),
        notas: notas.trim() || null,
        detalles: itemsValidos.map((it) => ({
          producto_id: it.producto.id,
          cantidad: Number(it.cantidad),
        })),
      }
      if (modoSolic === 'trabajador') payload.solicitante_trabajador_id = trabajador.id
      else payload.solicitante_nombre = nombreLibre.trim()

      const sol = await createEntregaDirecta(payload)
      toast.success('Entrega directa registrada')
      imprimirSolicitud(sol.id).catch(() => {})
      // Nueva transacción: limpia materiales y quién recibe; conserva proyecto/bodega.
      setItems([])
      setTrabajador(null)
      setNombreLibre('')
      setNotas('')
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo registrar la entrega'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        icon={PackageCheck}
        title="Entrega directa"
        description="Surte material para un proyecto en el acto. Al entregar se descuenta el stock y se genera el comprobante PDF."
        actions={
          <Button leftIcon={<PackagePlus size={16} />} onClick={() => setProdOpen(true)}>
            Agregar material
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* ── Columna principal: materiales ── */}
        <Card className="lg:col-span-2 overflow-hidden">
          <div className="px-5 py-4 border-b border-ink-200 dark:border-ink-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100">
              Materiales <span className="text-ink-400 font-normal">({itemsValidos.length})</span>
            </h3>
            <Button variant="ghost" size="sm" leftIcon={<Plus size={14} />} onClick={() => setProdOpen(true)}>
              Agregar
            </Button>
          </div>

          {items.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <PackagePlus size={44} className="mx-auto text-ink-300 dark:text-ink-600 mb-4" />
              <p className="text-sm text-ink-500">Aún no agregas materiales.</p>
              <Button variant="secondary" size="sm" className="mt-4" leftIcon={<Plus size={14} />} onClick={() => setProdOpen(true)}>
                Agregar material
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-ink-100 dark:divide-ink-800">
              {items.map((it) => {
                const cantNum = Number(it.cantidad)
                const bucket = buckets[it.producto.id] ?? null
                // Mientras no haya bodega elegida no hay bucket que consultar;
                // se cae al total del producto solo para no dejar la fila muda.
                const disp = bucket
                  ? disponibleSegunRegla(bucket, REGLA_CON_FALLBACK)
                  : Number(it.producto.stock_disponible ?? it.producto.stock_actual) || 0
                const decimalMal = cantNum > 0 && !unidadPermiteDecimales(it.producto.unidad) && !Number.isInteger(cantNum)
                const excede = cantNum > disp
                const error = decimalMal || excede
                return (
                  <li key={it.producto.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink-900 dark:text-ink-100 truncate">{it.producto.descripcion}</p>
                      <p className="text-xs text-ink-500 font-mono mt-0.5">{it.producto.codigo}</p>
                      {bucket ? (
                        <div className="mt-1">
                          <DisponibilidadBucket
                            bucket={bucket}
                            regla={REGLA_CON_FALLBACK}
                            requerido={cantNum > 0 ? cantNum : null}
                            proyecto={proyectoSel?.numero_proyecto ?? null}
                            unidad={it.producto.unidad}
                            compacto
                          />
                        </div>
                      ) : (
                        <p className="text-[11px] text-ink-400 italic mt-0.5">
                          {almacenOrigenId
                            ? (cargandoBuckets ? 'Consultando existencias…' : 'Sin existencia en esta bodega')
                            : 'Elige la bodega para ver de dónde sale'}
                        </p>
                      )}
                      {cableResumen(it.producto) && (
                        <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 mt-0.5">Cable: {cableResumen(it.producto)} mm²/AWG</p>
                      )}
                      {error && (
                        <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">
                          {decimalMal
                            ? `“${it.producto.unidad}” no admite decimales.`
                            : 'Excede lo disponible en esta bodega para este proyecto.'}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button type="button" onClick={() => stepCantidad(it.producto.id, -1)} className="w-9 h-9 rounded-md border border-ink-200 dark:border-ink-700 flex items-center justify-center text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800">
                        <Minus size={15} />
                      </button>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={it.cantidad}
                        onChange={(e) => setCantidad(it.producto.id, e.target.value.replace('-', ''))}
                        onFocus={(e) => e.target.select()}
                        className={`w-20 h-10 text-center text-lg font-bold tabular-nums rounded-md border bg-white dark:bg-ink-900 outline-none focus:ring-2 ${
                          error ? 'border-rose-400 focus:ring-rose-500/20' : 'border-ink-200 dark:border-ink-700 focus:border-brand-500 focus:ring-brand-500/20'
                        }`}
                      />
                      <button type="button" onClick={() => stepCantidad(it.producto.id, +1)} className="w-9 h-9 rounded-md border border-ink-200 dark:border-ink-700 flex items-center justify-center text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800">
                        <Plus size={15} />
                      </button>
                      <button type="button" onClick={() => removeItem(it.producto.id)} title="Quitar" className="w-9 h-9 rounded-md flex items-center justify-center text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 ml-1.5">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        {/* ── Columna lateral: datos + acción (sticky en desktop) ── */}
        <div className="lg:sticky lg:top-6 self-start space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100">Datos de la entrega</h3>
              <Button variant="secondary" size="sm" leftIcon={<Pencil size={14} />} onClick={() => setDatosOpen(true)}>
                {datosOk ? 'Editar' : 'Definir'}
              </Button>
            </div>

            <div className="space-y-4">
              <Dato icon={FolderOpen} label="Proyecto" value={proyectoSel ? proyectoSel.numero_proyecto : null} />
              <Dato icon={User} label="Recibe" value={recibeNombre || null} />
              <Dato icon={Warehouse} label="Bodega" value={almacenSel ? almacenSel.nombre : null} />
            </div>

            {!datosOk && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-4 flex items-start gap-1.5">
                <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                <span>Define proyecto, quién recibe y bodega para poder entregar.</span>
              </p>
            )}
          </Card>

          <Button
            className="w-full h-12 text-base"
            loading={saving}
            disabled={!puedeGuardar}
            leftIcon={<Save size={16} />}
            onClick={handleSubmit}
          >
            Entregar y generar PDF
          </Button>
          <p className="text-[11px] text-ink-500 flex items-center justify-center gap-1.5">
            <Printer size={13} /> Se abre el PDF con el nombre de quien recibe.
          </p>
        </div>
      </div>

      {/* ── Modal: datos de la entrega ── */}
      <Modal
        open={datosOpen}
        onClose={() => setDatosOpen(false)}
        title="Datos de la entrega"
        footer={<Button onClick={() => setDatosOpen(false)} disabled={!datosOk}>Listo</Button>}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-500 mb-1.5">
              <FolderOpen size={12} className="inline mr-1 -mt-0.5" /> Proyecto
            </label>
            <Select value={proyectoId} onChange={(e) => setProyectoId(e.target.value)}>
              <option value="">Selecciona proyecto…</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>{p.numero_proyecto}{p.nombre ? ` — ${p.nombre}` : ''}</option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-500 mb-1.5">
              <Warehouse size={12} className="inline mr-1 -mt-0.5" /> Bodega origen
            </label>
            {almacenes.length === 0 ? (
              <p className="text-xs text-amber-600 dark:text-amber-400 inline-flex items-center gap-1">
                <AlertTriangle size={13} /> No hay bodegas. Crea una en "Almacenes".
              </p>
            ) : (
              <Select value={almacenOrigenId} onChange={(e) => setAlmacenOrigenId(e.target.value)}>
                <option value="">Selecciona bodega…</option>
                {almacenes.map((a) => (
                  <option key={a.id} value={a.id}>{a.nombre}{a.ubicacion ? ` — ${a.ubicacion}` : ''}</option>
                ))}
              </Select>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-500 mb-1.5">
              <User size={12} className="inline mr-1 -mt-0.5" /> ¿Quién recibe?
            </label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                type="button"
                onClick={() => setModoSolic('trabajador')}
                className={`py-2 rounded-lg border-2 text-sm font-bold transition-all ${
                  modoSolic === 'trabajador'
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                    : 'border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-500'
                }`}
              >
                Trabajador
              </button>
              <button
                type="button"
                onClick={() => setModoSolic('libre')}
                className={`py-2 rounded-lg border-2 text-sm font-bold transition-all ${
                  modoSolic === 'libre'
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                    : 'border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-500'
                }`}
              >
                Nombre libre
              </button>
            </div>
            {modoSolic === 'trabajador' ? (
              trabajador ? (
                <div className="flex items-center justify-between gap-2 rounded-md border border-ink-200 dark:border-ink-700 bg-ink-50 dark:bg-ink-800/50 px-3 py-2">
                  <span className="text-sm font-medium text-ink-900 dark:text-ink-100 truncate">
                    {trabajador.nombre_completo}
                    <span className="text-ink-400 font-normal ml-1">· #{trabajador.no_empleado}</span>
                  </span>
                  <button type="button" onClick={() => setTrabajador(null)} title="Cambiar" className="text-ink-400 hover:text-ink-700 dark:hover:text-ink-200">
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <TrabajadorPicker value={trabajador} onSelect={setTrabajador} />
              )
            ) : (
              <input
                type="text"
                value={nombreLibre}
                onChange={(e) => setNombreLibre(e.target.value)}
                maxLength={200}
                placeholder="Nombre de quien recibe (no está en el sistema)"
                className="block w-full h-10 px-3 rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-500 mb-1">Notas (opcional)</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="Observaciones para el comprobante…"
              className="block w-full rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm p-2.5 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none resize-none"
            />
          </div>
        </div>
      </Modal>

      {/* ── Modal: agregar material ── */}
      <ModalAgregarProducto
        open={prodOpen}
        onClose={() => setProdOpen(false)}
        enCarrito={enCarrito}
        onToggle={toggleProducto}
      />
    </div>
  )
}

// Celda de dato del encabezado: muestra valor o un guion tenue si falta.
function Dato({ icon: Icon, label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 inline-flex items-center gap-1">
        <Icon size={11} /> {label}
      </p>
      <p className={`text-sm truncate mt-0.5 ${value ? 'font-medium text-ink-900 dark:text-ink-100' : 'text-ink-300 dark:text-ink-600 italic'}`}>
        {value || 'Sin definir'}
      </p>
    </div>
  )
}
