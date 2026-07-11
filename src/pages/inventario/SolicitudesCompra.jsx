import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ShoppingCart, RefreshCw, Plus, Filter, Search, X, Trash2, Send,
  PackageCheck, FileText, Clock, Truck, CheckCircle2, Ban, Loader2, MessageCircle,
} from 'lucide-react'
import {
  PageHeader, Button, Card, Select, Skeleton, EmptyState,
  Table, THead, TH, TBody, TR, TD, Badge, Modal, Input, Textarea, ConfirmDialog, InfoTip, Pagination,
} from '../../components/ui'
import {
  getSolicitudesCompra,
  createSolicitudCompra,
  updateSolicitudCompraEstado,
  recibirSolicitudCompra,
  cancelarSolicitudCompra,
  imprimirSolicitudCompra,
  getProyectosInventario,
  getAlmacenes,
} from '../../api/inventario'
import { useProductoSearch } from '../../hooks/useProductoSearch'
import { extractApiError } from '../../utils/apiError'
import { unidadPermiteDecimales } from '../../utils/unidades'
import { useResource } from '../../hooks/useResource'

const ESTATUS_META = {
  PENDIENTE: { label: 'Pendiente', tone: 'warning', icon: Clock },
  ORDENADA:  { label: 'Ordenada',  tone: 'info',    icon: Truck },
  RECIBIDA:  { label: 'Recibida',  tone: 'success', icon: CheckCircle2 },
  CANCELADA: { label: 'Cancelada', tone: 'neutral', icon: Ban },
}

const PRIORIDAD_META = {
  BAJA:    { label: 'Baja',    tone: 'neutral' },
  MEDIA:   { label: 'Media',   tone: 'info' },
  ALTA:    { label: 'Alta',    tone: 'warning' },
  URGENTE: { label: 'Urgente', tone: 'danger' },
}

function fmtNum(v) {
  const n = Number(v || 0)
  return n % 1 === 0 ? String(n) : n.toFixed(2)
}

// Construye el enlace wa.me con un resumen listo para enviar. Espejo de
// _whatsapp_link en app/routes/inventario_api/etiquetas.py. Abre la app de
// WhatsApp con el chat (si el contacto trae número) y el mensaje pre-escrito.
function buildWhatsappLink(s) {
  const digits = String(s.proveedor_contacto || '').replace(/\D/g, '')
  let num = digits
  if (digits.length === 10) num = '52' + digits        // MX por defecto
  else if (digits.length > 15) num = digits.slice(0, 15) // E.164 máximo
  const lineas = [
    `Orden de compra ${s.folio}`,
    `Proveedor: ${s.proveedor_sugerido || 'Sin proveedor'}`,
    '',
  ]
  const dets = s.detalles || []
  for (const d of dets.slice(0, 40)) {
    const cod = d.codigo ? `${d.codigo} — ` : ''
    lineas.push(`• ${cod}${d.descripcion} · ${fmtNum(d.cantidad_solicitada)} ${d.unidad || ''}`.trim())
  }
  if (dets.length > 40) lineas.push(`... y ${dets.length - 40} ítems más (ver PDF adjunto)`)
  const base = num ? `https://wa.me/${num}` : 'https://wa.me/'
  return `${base}?text=${encodeURIComponent(lineas.join('\n'))}`
}
function fmtMoney(v) {
  return `$${Number(v || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function SolicitudesCompra() {
  const location = useLocation()
  const [estatusFiltro, setEstatusFiltro] = useState('')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [seed, setSeed] = useState(null)       // líneas precargadas (desde Bajo mínimo)
  const [detalleId, setDetalleId] = useState(null)

  const { data: rawData, loading, error, refetch } = useResource(
    ['solicitudes-compra', 'list'],
    () => getSolicitudesCompra({ limit: 1000 }),
    { staleMs: 30_000, invalidateOn: ['compra:changed'] },
  )
  const solicitudes = rawData ?? []

  useEffect(() => {
    if (error) toast.error(extractApiError(error, 'Error al cargar solicitudes de compra'))
  }, [error])

  // Siembra desde Bajo mínimo: navigate('/inventario/solicitudes-compra', { state: { seedProductos: [...] } })
  useEffect(() => {
    const sp = location.state?.seedProductos
    if (sp && sp.length) {
      setSeed(sp)
      setCreateOpen(true)
      // limpia el state para que un refresh no reabra el modal
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  const stats = useMemo(() => {
    const acc = { PENDIENTE: 0, ORDENADA: 0, RECIBIDA: 0, CANCELADA: 0, totalAbierto: 0 }
    for (const s of solicitudes) {
      acc[s.estatus] = (acc[s.estatus] || 0) + 1
      if (s.estatus === 'PENDIENTE' || s.estatus === 'ORDENADA') acc.totalAbierto += s.total_estimado || 0
    }
    return acc
  }, [solicitudes])

  const filtradas = useMemo(() => {
    let r = solicitudes
    if (estatusFiltro) r = r.filter((s) => s.estatus === estatusFiltro)
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter((s) =>
        s.folio?.toLowerCase().includes(q) ||
        (s.proveedor_sugerido || '').toLowerCase().includes(q) ||
        (s.proyecto || '').toLowerCase().includes(q) ||
        (s.detalles || []).some((d) => (d.descripcion || '').toLowerCase().includes(q) || (d.codigo || '').toLowerCase().includes(q))
      )
    }
    return r
  }, [solicitudes, estatusFiltro, search])

  // Paginación del render para no colgar el navegador con muchas solicitudes.
  // Los stats se calculan sobre la lista completa, no sobre la página visible.
  const COMPRA_PAGE = 30
  const [pageCompra, setPageCompra] = useState(0)
  useEffect(() => { setPageCompra(0) }, [estatusFiltro, search])
  const totalPagesCompra = Math.max(1, Math.ceil(filtradas.length / COMPRA_PAGE))
  const filtradasPage = useMemo(
    () => filtradas.slice(pageCompra * COMPRA_PAGE, pageCompra * COMPRA_PAGE + COMPRA_PAGE),
    [filtradas, pageCompra],
  )

  const detalle = useMemo(
    () => solicitudes.find((s) => s.id === detalleId) || null,
    [solicitudes, detalleId],
  )

  return (
    <div>
      <PageHeader
        icon={ShoppingCart}
        title="Solicitudes de compra"
        description="Registro de compras: qué se pidió, a qué proveedor, si ya se ordenó y si ya llegó."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" leftIcon={<RefreshCw size={14} />} onClick={() => refetch()}>
              Actualizar
            </Button>
            <Button variant="primary" leftIcon={<Plus size={14} />} onClick={() => { setSeed(null); setCreateOpen(true) }}>
              Nueva solicitud
            </Button>
          </div>
        }
      />

      {/* KPIs (clic = filtro) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 mb-4">
        <KpiCard label="Pendientes" value={stats.PENDIENTE} tone="amber" icon={Clock}
          active={estatusFiltro === 'PENDIENTE'} onClick={() => setEstatusFiltro((p) => p === 'PENDIENTE' ? '' : 'PENDIENTE')} />
        <KpiCard label="Ordenadas" value={stats.ORDENADA} tone="sky" icon={Truck}
          active={estatusFiltro === 'ORDENADA'} onClick={() => setEstatusFiltro((p) => p === 'ORDENADA' ? '' : 'ORDENADA')} />
        <KpiCard label="Recibidas" value={stats.RECIBIDA} tone="emerald" icon={CheckCircle2}
          active={estatusFiltro === 'RECIBIDA'} onClick={() => setEstatusFiltro((p) => p === 'RECIBIDA' ? '' : 'RECIBIDA')} />
        <KpiCard
          label={<span className="inline-flex items-center gap-1">Estimado abierto <InfoTip placement="bottom" text="Suma del costo estimado de las solicitudes Pendientes y Ordenadas (lo que aún está por comprar/recibir)." /></span>}
          value={fmtMoney(stats.totalAbierto)} tone="ink" icon={ShoppingCart}
        />
      </div>

      {/* Filtros */}
      <Card className="p-3 mb-4 flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-500">
          <Filter size={12} /> Filtros
        </div>
        <div className="flex-1 min-w-[200px] max-w-md">
          <label className="block text-[10px] font-bold uppercase text-ink-500 mb-1">Búsqueda</label>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Folio, proveedor, proyecto o producto"
              className="w-full pl-8 pr-2 py-1 text-sm rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900"
            />
          </div>
        </div>
        <div className="min-w-[160px]">
          <label className="block text-[10px] font-bold uppercase text-ink-500 mb-1">Estatus</label>
          <Select value={estatusFiltro} onChange={(e) => setEstatusFiltro(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(ESTATUS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </Select>
        </div>
        {(search || estatusFiltro) && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setEstatusFiltro('') }}>Limpiar</Button>
        )}
      </Card>

      {loading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : solicitudes.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Sin solicitudes de compra"
          description="Crea la primera solicitud de compra para empezar a registrar la lista de compra."
        />
      ) : filtradas.length === 0 ? (
        <EmptyState icon={Search} title="Sin coincidencias" description="Cambia los filtros para ver más resultados." />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <THead>
              <TH>
                Folio <InfoTip placement="bottom" text="Número único de la solicitud de compra. Haz clic en la fila para ver el detalle." />
              </TH>
              <TH>Fecha</TH>
              <TH>Proveedor</TH>
              <TH>Proyecto</TH>
              <TH>
                Prioridad <InfoTip placement="bottom" text="Urgencia de la compra: Baja, Media, Alta o Urgente. Se define al crear la solicitud." />
              </TH>
              <TH align="right">Ítems</TH>
              <TH>
                Avance <InfoTip placement="bottom" text="Porcentaje ya recibido respecto a lo solicitado. Llega a 100% cuando todo el material entra al almacén." />
              </TH>
              <TH align="right">
                Estimado <InfoTip placement="bottom" text="Costo estimado de la solicitud (precio estimado × cantidad de cada línea)." />
              </TH>
              <TH>
                Estatus <InfoTip placement="bottom" text="Pendiente = creada · Ordenada = enviada al proveedor · Recibida = ya llegó todo · Cancelada." />
              </TH>
              <TH align="right">Acciones</TH>
            </THead>
            <TBody>
              {filtradasPage.map((s) => {
                const meta = ESTATUS_META[s.estatus] || ESTATUS_META.PENDIENTE
                const prio = PRIORIDAD_META[s.prioridad] || PRIORIDAD_META.MEDIA
                const totalSol = (s.detalles || []).reduce((a, d) => a + (d.cantidad_solicitada || 0), 0)
                const totalRec = (s.detalles || []).reduce((a, d) => a + (d.cantidad_recibida || 0), 0)
                const pct = totalSol > 0 ? Math.round((totalRec / totalSol) * 100) : 0
                return (
                  <TR key={s.id} className="cursor-pointer" onClick={() => setDetalleId(s.id)}>
                    <TD className="font-mono text-xs font-semibold text-brand-700 dark:text-brand-300">{s.folio}</TD>
                    <TD className="text-xs">{s.fecha_creacion ? new Date(s.fecha_creacion).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}</TD>
                    <TD className="text-sm">{s.proveedor_sugerido || <span className="text-ink-400 italic">Sin proveedor</span>}</TD>
                    <TD className="text-sm">{s.proyecto || <span className="text-ink-400">—</span>}</TD>
                    <TD><Badge tone={prio.tone}>{prio.label}</Badge></TD>
                    <TD align="right" className="tabular-nums">{s.detalles?.length || 0}</TD>
                    <TD style={{ minWidth: 90 }}>
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-1.5 rounded-full bg-ink-200 dark:bg-ink-700 overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] tabular-nums text-ink-500 w-8 text-right">{pct}%</span>
                      </div>
                    </TD>
                    <TD align="right" className="tabular-nums text-xs">{fmtMoney(s.total_estimado)}</TD>
                    <TD><Badge tone={meta.tone} dot>{meta.label}</Badge></TD>
                    <TD align="right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1">
                        <Button variant="ghost" size="icon-sm" title="Imprimir / PDF" onClick={() => imprimirSolicitudCompra(s.id)}>
                          <FileText size={14} />
                        </Button>
                        <a href={buildWhatsappLink(s)} target="_blank" rel="noopener noreferrer" title="Enviar por WhatsApp">
                          <Button variant="ghost" size="icon-sm" className="text-emerald-600">
                            <MessageCircle size={14} />
                          </Button>
                        </a>
                      </div>
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
          {filtradas.length > COMPRA_PAGE && (
            <Pagination
              page={pageCompra}
              totalPages={totalPagesCompra}
              totalElements={filtradas.length}
              size={COMPRA_PAGE}
              onChange={setPageCompra}
            />
          )}
        </Card>
      )}

      <CrearSolicitudModal
        open={createOpen}
        seed={seed}
        onClose={() => { setCreateOpen(false); setSeed(null) }}
        onCreated={() => { setCreateOpen(false); setSeed(null); refetch() }}
      />

      <DetalleModal
        solicitud={detalle}
        onClose={() => setDetalleId(null)}
        onChanged={() => refetch()}
      />
    </div>
  )
}

/* ─── KPI ────────────────────────────────────────────────────────────────── */
const KPI_TONES = {
  amber:   { ring: 'ring-amber-500/30',   icon: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300',     val: 'text-amber-700 dark:text-amber-300' },
  sky:     { ring: 'ring-sky-500/30',     icon: 'bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-300',             val: 'text-sky-700 dark:text-sky-300' },
  emerald: { ring: 'ring-emerald-500/30', icon: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300', val: 'text-emerald-700 dark:text-emerald-300' },
  ink:     { ring: 'ring-ink-400/30',     icon: 'bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300',                 val: 'text-ink-900 dark:text-ink-100' },
}
function KpiCard({ label, value, tone, icon: Icon, active, onClick }) {
  const t = KPI_TONES[tone] || KPI_TONES.ink
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`text-left bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-xl px-3 py-3 flex items-center gap-3 transition-all ${onClick ? 'hover:shadow-md' : 'cursor-default'} ${active ? `ring-2 ${t.ring}` : ''}`}
    >
      <span className={`h-9 w-9 rounded-lg inline-flex items-center justify-center ${t.icon}`}><Icon size={16} /></span>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500">{label}</div>
        <div className={`text-2xl font-extrabold leading-tight ${t.val}`}>{value}</div>
      </div>
    </button>
  )
}

/* ─── Modal: crear solicitud ─────────────────────────────────────────────── */
function CrearSolicitudModal({ open, seed, onClose, onCreated }) {
  const [proveedor, setProveedor] = useState('')
  const [contacto, setContacto] = useState('')
  const [proyectoId, setProyectoId] = useState('')
  const [prioridad, setPrioridad] = useState('MEDIA')
  const [notas, setNotas] = useState('')
  const [lineas, setLineas] = useState([])   // {key, producto_id?, codigo, descripcion, unidad, cantidad, precio, es_libre}
  const [proyectos, setProyectos] = useState([])
  const [saving, setSaving] = useState(false)

  // Buscador de productos
  const [busq, setBusq] = useState('')
  const [busqDeb, setBusqDeb] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setBusqDeb(busq.trim()), 250)
    return () => clearTimeout(t)
  }, [busq])
  // Buscador paginado por páginas: el paginador navega el resto de coincidencias.
  const { opciones: resultados, loading: buscando, page, setPage, total, totalPages, size } = useProductoSearch({
    q: busqDeb, enabled: open, pageSize: 20, minChars: 2,
  })

  useEffect(() => {
    if (!open) return
    setProveedor(''); setContacto(''); setProyectoId(''); setPrioridad('MEDIA'); setNotas('')
    setBusq('')
    setLineas(seed && seed.length ? seed.map((s, i) => ({
      key: `seed-${i}`,
      producto_id: s.producto_id,
      codigo: s.codigo || '',
      descripcion: s.descripcion || '',
      unidad: s.unidad || '',
      cantidad: s.cantidad != null ? String(Math.max(1, Math.ceil(Number(s.cantidad)))) : '1',
      precio: '',
      es_libre: false,
    })) : [])
    getProyectosInventario().then(setProyectos).catch(() => setProyectos([]))
  }, [open, seed])

  const agregarProducto = (p) => {
    setLineas((prev) => {
      if (prev.some((l) => l.producto_id === p.id)) {
        toast('Ese producto ya está en la lista', { icon: 'ℹ️' })
        return prev
      }
      return [...prev, {
        key: `p-${p.id}`, producto_id: p.id, codigo: p.codigo, descripcion: p.descripcion,
        unidad: p.unidad || '', cantidad: '1', precio: p.precio_unitario != null ? String(p.precio_unitario) : '', es_libre: false,
      }]
    })
    setBusq('')
  }

  const agregarLibre = () => {
    setLineas((prev) => [...prev, {
      key: `libre-${Date.now()}`, producto_id: null, codigo: '', descripcion: '', unidad: '', cantidad: '1', precio: '', es_libre: true,
    }])
  }

  const setLinea = (key, campo, valor) =>
    setLineas((prev) => prev.map((l) => l.key === key ? { ...l, [campo]: valor } : l))
  const quitarLinea = (key) => setLineas((prev) => prev.filter((l) => l.key !== key))

  const totalEstimado = useMemo(
    () => lineas.reduce((a, l) => a + (Number(l.precio) || 0) * (Number(l.cantidad) || 0), 0),
    [lineas],
  )

  const guardar = async () => {
    if (lineas.length === 0) { toast.error('Agrega al menos una línea'); return }
    const detalles = []
    for (const l of lineas) {
      const cantidad = Number(l.cantidad)
      if (!(cantidad > 0)) { toast.error('Todas las líneas necesitan cantidad mayor a 0'); return }
      if (!unidadPermiteDecimales(l.unidad) && !Number.isInteger(cantidad)) {
        toast.error(`"${l.descripcion || 'ítem'}" (${l.unidad || 'pza'}) se pide en cantidades enteras`); return
      }
      if (l.es_libre && !l.descripcion.trim()) { toast.error('Las líneas de texto libre necesitan descripción'); return }
      detalles.push({
        producto_id: l.es_libre ? null : l.producto_id,
        descripcion_libre: l.es_libre ? l.descripcion.trim() : null,
        unidad: l.unidad?.trim() || null,
        cantidad_solicitada: cantidad,
        precio_estimado: l.precio !== '' ? Number(l.precio) : null,
      })
    }
    setSaving(true)
    try {
      await createSolicitudCompra({
        proveedor_sugerido: proveedor.trim() || null,
        proveedor_contacto: contacto.trim() || null,
        proyecto_id: proyectoId ? Number(proyectoId) : null,
        prioridad,
        notas: notas.trim() || null,
        detalles,
      })
      toast.success('Solicitud de compra creada')
      onCreated()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo crear la solicitud'))
    } finally {
      setSaving(false)
    }
  }

  const onSearchKeyDown = (e) => {
    if (e.key === 'Enter' && resultados.length > 0) {
      e.preventDefault()
      const libre = resultados.find((p) => !lineas.some((l) => l.producto_id === p.id))
      if (libre) agregarProducto(libre)
    }
  }

  const busqActiva = busq.trim().length >= 2

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nueva solicitud de compra"
      size="xl"
      description="Busca productos del catálogo o agrega ítems de texto libre."
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <div className="text-sm text-ink-500">
            {lineas.length} línea{lineas.length === 1 ? '' : 's'} · Estimado:{' '}
            <span className="font-bold text-ink-800 dark:text-ink-100">{fmtMoney(totalEstimado)}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button variant="primary" onClick={guardar} disabled={saving || lineas.length === 0}
              leftIcon={saving ? <Loader2 size={14} className="animate-spin" /> : <ShoppingCart size={14} />}>
              {saving ? 'Guardando…' : 'Crear solicitud'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Datos generales */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Proveedor sugerido" value={proveedor} onChange={(e) => setProveedor(e.target.value)} placeholder="Ej. Electrónica Steren" />
          <Input label="Contacto (tel/email)" value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder="55 1234 5678" />
          <div>
            <label className="block text-[10px] font-bold uppercase text-ink-500 mb-1">Proyecto (opcional)</label>
            <Select value={proyectoId} onChange={(e) => setProyectoId(e.target.value)}>
              <option value="">Sin proyecto</option>
              {proyectos.map((p) => <option key={p.id} value={p.id}>{p.numero_proyecto}{p.nombre ? ` — ${p.nombre}` : ''}</option>)}
            </Select>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-ink-500 mb-1">Prioridad</label>
            <Select value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
              {Object.entries(PRIORIDAD_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
            </Select>
          </div>
        </div>

        {/* Buscador de productos */}
        <div className="rounded-xl border border-ink-200 dark:border-ink-700 p-3 bg-ink-50/40 dark:bg-ink-950/20">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="inline-flex items-center gap-1">
              <label className="text-[11px] font-bold uppercase tracking-wide text-ink-500">Agregar productos</label>
              <InfoTip text="Busca productos del catálogo y haz clic en “Agregar”. Para algo que aún no está en el catálogo, usa “Ítem de texto libre” y escribe la descripción." />
            </span>
            <Button variant="ghost" size="sm" leftIcon={<Plus size={13} />} onClick={agregarLibre}
              title="Agrega una línea para un producto que aún no existe en el catálogo">
              Ítem de texto libre
            </Button>
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              autoFocus
              value={busq}
              onChange={(e) => setBusq(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Buscar por código o descripción…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 focus-ring"
            />
          </div>

          {/* Resultados en línea (sin dropdown flotante → no se recortan) */}
          {busqActiva && (
            <div className="mt-2 rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 max-h-56 overflow-y-auto divide-y divide-ink-100 dark:divide-ink-800">
              {buscando ? (
                <div className="px-3 py-3 text-xs text-ink-400 flex items-center gap-2"><Loader2 size={13} className="animate-spin" /> Buscando…</div>
              ) : resultados.length === 0 ? (
                <div className="px-3 py-3 text-xs text-ink-400">Sin resultados para “{busq.trim()}”.</div>
              ) : (
                resultados.map((p) => {
                  const ya = lineas.some((l) => l.producto_id === p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={ya}
                      onClick={() => agregarProducto(p)}
                      className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors ${ya ? 'opacity-50 cursor-default' : 'hover:bg-brand-50 dark:hover:bg-brand-900/20'}`}
                    >
                      <span className="font-mono text-xs text-ink-500 w-24 truncate">{p.codigo}</span>
                      <span className="flex-1 text-sm truncate">{p.descripcion}</span>
                      <span className="text-[10px] text-ink-400 tabular-nums">stock {fmtNum(p.stock_actual)} {p.unidad}</span>
                      {ya ? (
                        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Agregado ✓</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 dark:text-brand-400"><Plus size={13} /> Agregar</span>
                      )}
                    </button>
                  )
                })
              )}
              {!buscando && totalPages > 1 && (
                <div className="px-3 pb-1">
                  <Pagination page={page} totalPages={totalPages} totalElements={total} size={size} onChange={setPage} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Líneas seleccionadas */}
        {lineas.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="Aún no agregas productos"
            description="Busca arriba y haz clic en “Agregar”, o usa “Ítem de texto libre”."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TH>Producto / Descripción</TH>
                <TH align="right" style={{ width: 90 }}>Cantidad</TH>
                <TH style={{ width: 90 }}>Unidad</TH>
                <TH align="right" style={{ width: 110 }}>Precio est.</TH>
                <TH align="right" style={{ width: 40 }} />
              </THead>
              <TBody>
                {lineas.map((l) => (
                  <TR key={l.key}>
                    <TD>
                      {l.es_libre ? (
                        <input value={l.descripcion} onChange={(e) => setLinea(l.key, 'descripcion', e.target.value)}
                          placeholder="Descripción del ítem"
                          className="w-full text-sm rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-2 py-1" />
                      ) : (
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-xs text-ink-500 flex-shrink-0">{l.codigo}</span>
                          <span className="text-sm truncate">{l.descripcion}</span>
                        </div>
                      )}
                    </TD>
                    <TD align="right">
                      {(() => {
                        const dec = unidadPermiteDecimales(l.unidad)
                        return (
                          <input type="number" min={dec ? 0.01 : 1} step={dec ? '0.01' : 1} value={l.cantidad}
                            onChange={(e) => setLinea(l.key, 'cantidad', dec ? e.target.value : e.target.value.replace(/[.,].*$/, ''))}
                            onKeyDown={(e) => { if (!dec && (e.key === '.' || e.key === ',')) e.preventDefault() }}
                            className="w-20 text-right font-mono rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-2 py-1 text-sm" />
                        )
                      })()}
                    </TD>
                    <TD>
                      <input value={l.unidad} onChange={(e) => setLinea(l.key, 'unidad', e.target.value)}
                        placeholder="pza" className="w-20 rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-2 py-1 text-sm" />
                    </TD>
                    <TD align="right">
                      <input type="number" min={0} step="0.01" value={l.precio}
                        onChange={(e) => setLinea(l.key, 'precio', e.target.value)} placeholder="0.00"
                        className="w-24 text-right font-mono rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-2 py-1 text-sm" />
                    </TD>
                    <TD align="right">
                      <Button variant="ghost" size="icon-sm" title="Quitar" onClick={() => quitarLinea(l.key)}><X size={14} /></Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}

        {lineas.length > 0 && (
          <Textarea label="Notas / observaciones" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej. Entregar en taller, requiere factura, etc." />
        )}
      </div>
    </Modal>
  )
}

/* ─── Modal: detalle + acciones ──────────────────────────────────────────── */
function DetalleModal({ solicitud, onClose, onChanged }) {
  const [recibirOpen, setRecibirOpen] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [busy, setBusy] = useState(false)
  const open = !!solicitud

  const cambiarEstado = async (estatus) => {
    setBusy(true)
    try {
      await updateSolicitudCompraEstado(solicitud.id, estatus)
      toast.success(`Solicitud ${ESTATUS_META[estatus]?.label?.toLowerCase() || estatus}`)
      onChanged()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo cambiar el estatus'))
    } finally { setBusy(false) }
  }

  const cancelar = async () => {
    setBusy(true)
    try {
      await cancelarSolicitudCompra(solicitud.id)
      toast.success('Solicitud cancelada')
      setConfirmCancel(false)
      onChanged(); onClose()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo cancelar'))
    } finally { setBusy(false) }
  }

  if (!open) return null
  const meta = ESTATUS_META[solicitud.estatus] || ESTATUS_META.PENDIENTE

  return (
    <>
      <Modal open={open} onClose={onClose} title={solicitud.folio} size="xl"
        description={`${solicitud.proveedor_sugerido || 'Sin proveedor'}${solicitud.proyecto ? ` · ${solicitud.proyecto}` : ''}`}>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={meta.tone} dot>{meta.label}</Badge>
            <Badge tone={(PRIORIDAD_META[solicitud.prioridad] || PRIORIDAD_META.MEDIA).tone}>
              Prioridad {(PRIORIDAD_META[solicitud.prioridad] || PRIORIDAD_META.MEDIA).label}
            </Badge>
            <span className="text-xs text-ink-500">
              Creada por {solicitud.solicitado_por_nombre} · {solicitud.fecha_creacion ? new Date(solicitud.fecha_creacion).toLocaleString('es-MX') : ''}
            </span>
          </div>

          {solicitud.notas && (
            <div className="text-sm bg-ink-50 dark:bg-ink-900/40 rounded-md p-3 text-ink-700 dark:text-ink-300">{solicitud.notas}</div>
          )}

          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TH>Código</TH>
                <TH>Descripción</TH>
                <TH align="right">Solicitado</TH>
                <TH align="right">Recibido</TH>
                <TH align="right">Pendiente</TH>
                <TH align="right">Precio est.</TH>
              </THead>
              <TBody>
                {(solicitud.detalles || []).map((d) => {
                  const completa = d.cantidad_pendiente <= 0
                  return (
                    <TR key={d.id}>
                      <TD className="font-mono text-xs">{d.codigo || (d.es_libre ? <Badge tone="neutral">Libre</Badge> : '—')}</TD>
                      <TD className="text-sm">{d.descripcion}</TD>
                      <TD align="right" className="tabular-nums">{fmtNum(d.cantidad_solicitada)} <span className="text-[10px] text-ink-400">{d.unidad}</span></TD>
                      <TD align="right" className="tabular-nums">{fmtNum(d.cantidad_recibida)}</TD>
                      <TD align="right" className={`tabular-nums font-bold ${completa ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        {completa ? '✓' : fmtNum(d.cantidad_pendiente)}
                      </TD>
                      <TD align="right" className="tabular-nums text-xs">{d.precio_estimado != null ? fmtMoney(d.precio_estimado) : '—'}</TD>
                    </TR>
                  )
                })}
              </TBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-ink-200 dark:border-ink-700">
            <Button variant="ghost" size="sm" leftIcon={<FileText size={14} />} onClick={() => imprimirSolicitudCompra(solicitud.id)}>PDF</Button>
            <a href={buildWhatsappLink(solicitud)} target="_blank" rel="noopener noreferrer"
              onClick={() => { imprimirSolicitudCompra(solicitud.id); toast('Se abrió el PDF — adjúntalo en WhatsApp', { icon: '📎' }) }}>
              <Button variant="secondary" size="sm" leftIcon={<MessageCircle size={14} />} className="text-emerald-700">Enviar por WhatsApp</Button>
            </a>

            {solicitud.estatus === 'PENDIENTE' && (
              <Button variant="secondary" size="sm" disabled={busy} leftIcon={<Send size={14} />}
                title="Marca que ya enviaste la orden al proveedor (pasa a Ordenada)"
                onClick={() => cambiarEstado('ORDENADA')}>
                Marcar como ordenada
              </Button>
            )}
            {solicitud.estatus === 'ORDENADA' && (
              <Button variant="ghost" size="sm" disabled={busy}
                title="Regresa la solicitud a Pendiente (aún no enviada al proveedor)"
                onClick={() => cambiarEstado('PENDIENTE')}>
                Revertir a pendiente
              </Button>
            )}
            {(solicitud.estatus === 'PENDIENTE' || solicitud.estatus === 'ORDENADA') && (
              <>
                <Button variant="primary" size="sm" disabled={busy} leftIcon={<PackageCheck size={14} />}
                  title="Registra el material que llegó. Sube el stock del almacén (genera una ENTRADA)."
                  onClick={() => setRecibirOpen(true)}>
                  Recibir material
                </Button>
                <Button variant="ghost" size="sm" disabled={busy} className="text-rose-600" leftIcon={<Trash2 size={14} />}
                  title="Cancela la solicitud (queda registrada como Cancelada)"
                  onClick={() => setConfirmCancel(true)}>
                  Cancelar
                </Button>
              </>
            )}
          </div>
        </div>
      </Modal>

      <RecibirModal
        solicitud={recibirOpen ? solicitud : null}
        onClose={() => setRecibirOpen(false)}
        onRecibido={() => { setRecibirOpen(false); onChanged() }}
      />

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={cancelar}
        title="Cancelar solicitud de compra"
        description={`¿Cancelar ${solicitud.folio}? Quedará registrada como CANCELADA.`}
        confirmLabel="Sí, cancelar"
        tone="danger"
      />
    </>
  )
}

/* ─── Modal: recibir material ────────────────────────────────────────────── */
function RecibirModal({ solicitud, onClose, onRecibido }) {
  const open = !!solicitud
  const [almacenes, setAlmacenes] = useState([])
  const [almacenId, setAlmacenId] = useState('')
  const [motivo, setMotivo] = useState('')
  const [cantidades, setCantidades] = useState({})   // detalle_id -> string
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setMotivo('')
    // por defecto: recibir todo lo pendiente
    const init = {}
    for (const d of (solicitud.detalles || [])) {
      if (d.cantidad_pendiente > 0) init[d.id] = String(d.cantidad_pendiente)
    }
    setCantidades(init)
    getAlmacenes().then((a) => {
      const activos = (a || []).filter((x) => x.activo)
      setAlmacenes(activos)
      setAlmacenId(activos[0] ? String(activos[0].id) : '')
    }).catch(() => setAlmacenes([]))
  }, [open, solicitud])

  const hayProductoCatalogo = useMemo(
    () => (solicitud?.detalles || []).some((d) => d.producto_id && d.cantidad_pendiente > 0),
    [solicitud],
  )

  const recibir = async () => {
    const recepciones = Object.entries(cantidades)
      .map(([detalle_id, v]) => ({ detalle_id: Number(detalle_id), cantidad_recibida: Number(v) || 0 }))
      .filter((r) => r.cantidad_recibida > 0)
    if (recepciones.length === 0) { toast.error('Indica cantidades a recibir'); return }
    if (hayProductoCatalogo && !almacenId) { toast.error('Selecciona el almacén destino'); return }
    setSaving(true)
    try {
      await recibirSolicitudCompra(solicitud.id, {
        almacen_destino_id: almacenId ? Number(almacenId) : null,
        motivo: motivo.trim() || null,
        recepciones,
      })
      toast.success('Recepción registrada — stock actualizado')
      onRecibido()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo registrar la recepción'))
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <Modal open={open} onClose={onClose} title={`Recibir — ${solicitud.folio}`} size="lg"
      description="Las líneas con producto del catálogo generan una ENTRADA al almacén (sube el stock).">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {hayProductoCatalogo && (
          <div>
            <label className="block text-[10px] font-bold uppercase text-ink-500 mb-1">Almacén destino</label>
            <Select value={almacenId} onChange={(e) => setAlmacenId(e.target.value)}>
              {almacenes.length === 0 && <option value="">Sin almacenes</option>}
              {almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </Select>
          </div>
        )}

        <div className="overflow-x-auto">
          <Table>
            <THead>
              <TH>Descripción</TH>
              <TH align="right">Pendiente</TH>
              <TH align="right" style={{ width: 120 }}>Recibir ahora</TH>
            </THead>
            <TBody>
              {(solicitud.detalles || []).map((d) => {
                const pend = d.cantidad_pendiente
                const dec = unidadPermiteDecimales(d.unidad)
                return (
                  <TR key={d.id} className={pend <= 0 ? 'opacity-50' : ''}>
                    <TD className="text-sm">
                      <div className="flex items-center gap-2">
                        {d.codigo && <span className="font-mono text-xs text-ink-500">{d.codigo}</span>}
                        <span className="truncate">{d.descripcion}</span>
                        {!d.producto_id && <Badge tone="neutral">Libre</Badge>}
                      </div>
                    </TD>
                    <TD align="right" className="tabular-nums">{fmtNum(pend)} <span className="text-[10px] text-ink-400">{d.unidad}</span></TD>
                    <TD align="right">
                      <input type="number" min={0} max={pend} step={dec ? '0.01' : 1}
                        disabled={pend <= 0}
                        value={cantidades[d.id] ?? ''}
                        onChange={(e) => setCantidades((prev) => ({ ...prev, [d.id]: dec ? e.target.value : e.target.value.replace(/[.,].*$/, '') }))}
                        onKeyDown={(e) => { if (!dec && (e.key === '.' || e.key === ',')) e.preventDefault() }}
                        className="w-24 text-right font-mono rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-2 py-1 text-sm disabled:opacity-50" />
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        </div>

        <Input label="Motivo / referencia (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Factura A-123, remisión, etc." />
      </div>

      <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-ink-200 dark:border-ink-700">
        <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button variant="primary" onClick={recibir} disabled={saving}
          leftIcon={saving ? <Loader2 size={14} className="animate-spin" /> : <PackageCheck size={14} />}>
          {saving ? 'Registrando…' : 'Registrar recepción'}
        </Button>
      </div>
    </Modal>
  )
}
