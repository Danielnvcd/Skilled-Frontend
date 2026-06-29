import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  ClipboardList, CheckCircle2, XCircle, PackageCheck, Search, Clock,
  ListTodo, ThumbsUp, ThumbsDown, PackageOpen, Printer, Pencil, AlertTriangle,
  List, LayoutGrid,
} from 'lucide-react'
import {
  Button, Card, PageHeader, ConfirmDialog,
  Skeleton, Table, THead, TH, THSort, TBody, TR, TD, Badge, Modal, Select, SavedViews, InfoTip, Pagination,
} from '../../components/ui'
import {
  getSolicitudes, updateSolicitudEstado, imprimirSolicitud,
  patchSolicitudDetalle, entregarSolicitud, getAlmacenes,
} from '../../api/inventario'
import { extractApiError } from '../../utils/apiError'
import { unidadPermiteDecimales } from '../../utils/unidades'
import { useAuth } from '../../context/AuthContext'
import { useResource } from '../../hooks/useResource'
import SolicitudesKanban from './SolicitudesKanban'

const TABS = [
  { key: 'TODAS',     label: 'Todas',      icon: ListTodo },
  { key: 'PENDIENTE', label: 'Pendientes', icon: Clock },
  { key: 'APROBADA',  label: 'Aprobadas',  icon: ThumbsUp },
  { key: 'RECHAZADA', label: 'Rechazadas', icon: ThumbsDown },
  { key: 'ENTREGADA', label: 'Entregadas', icon: PackageOpen },
]

const num = (v) => Number(v ?? 0)

// Estados en palabras claras para el usuario final (el badge mostraba el código
// crudo en mayúsculas).
const ESTATUS_LABEL = {
  PENDIENTE: 'En espera',
  APROBADA:  'Aprobada',
  RECHAZADA: 'Rechazada',
  ENTREGADA: 'Entregada',
}

export default function SolicitudesMaterial() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'inventario'

  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('TODAS')
  // Orden client-side: el dataset (≤200) ya está en memoria.
  const [sort, setSort] = useState('')
  const [dir, setDir] = useState('asc')
  // Vista tabla | kanban, persistida. El kanban segmenta por estado en
  // columnas, así que en ese modo las pestañas de estado se ocultan.
  const [vista, setVistaState] = useState(() => {
    try { return localStorage.getItem('ui:solicitudes:vista') || 'tabla' } catch { return 'tabla' }
  })
  const setVista = (v) => {
    setVistaState(v)
    try { localStorage.setItem('ui:solicitudes:vista', v) } catch {}
  }

  const [confirmStatus, setConfirmStatus] = useState(null)
  const [savingStatus, setSavingStatus] = useState(false)
  const [viewDetails, setViewDetails] = useState(null)
  const [printingId, setPrintingId] = useState(null)

  // Pausa 8b — modal de entrega parcial.
  const [entregaTarget, setEntregaTarget] = useState(null) // solicitud

  const handlePrint = async (solId) => {
    setPrintingId(solId)
    try {
      await imprimirSolicitud(solId)
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo generar el PDF'))
    } finally {
      setPrintingId(null)
    }
  }

  const {
    data: rawSolicitudes,
    loading,
    error,
    refetch,
  } = useResource(
    ['solicitudes', { limit: 1000 }],
    () => getSolicitudes({ limit: 1000 }),
    { staleMs: 30_000, invalidateOn: ['solicitud:changed'] },
  )
  const solicitudes = rawSolicitudes ?? []

  useEffect(() => {
    if (error) toast.error(extractApiError(error, 'Error al cargar solicitudes'))
  }, [error])

  const load = () => { refetch() }

  const stats = useMemo(() => {
    const acc = { TOTAL: solicitudes.length, PENDIENTE: 0, APROBADA: 0, RECHAZADA: 0, ENTREGADA: 0 }
    solicitudes.forEach((s) => { acc[s.estatus] = (acc[s.estatus] || 0) + 1 })
    return acc
  }, [solicitudes])

  // Búsqueda y pestaña por separado: el kanban usa solo la búsqueda (sus
  // columnas YA segmentan por estado), la tabla aplica ambas.
  const filteredBySearch = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return solicitudes
    return solicitudes.filter((s) =>
      String(s.id).includes(q) ||
      s.solicitante_nombre?.toLowerCase().includes(q) ||
      s.proyecto?.toLowerCase().includes(q) ||
      s.detalles?.some((d) =>
        d.producto_descripcion?.toLowerCase().includes(q) ||
        d.producto_codigo?.toLowerCase().includes(q)
      )
    )
  }, [solicitudes, search])

  const filtered = useMemo(() => {
    if (activeTab === 'TODAS') return filteredBySearch
    return filteredBySearch.filter((s) => s.estatus === activeTab)
  }, [filteredBySearch, activeTab])

  const sorted = useMemo(() => {
    if (!sort) return filtered
    const mul = dir === 'desc' ? -1 : 1
    const val = (s) => {
      switch (sort) {
        case 'id': return Number(s.id) || 0
        case 'fecha': return s.fecha_creacion || ''
        case 'solicitante': return (s.solicitante_nombre || '').toLowerCase()
        case 'proyecto': return (s.proyecto || '').toLowerCase()
        case 'items': return s.detalles?.length || 0
        case 'estado': return s.estatus || ''
        default: return 0
      }
    }
    return [...filtered].sort((a, b) => {
      const va = val(a)
      const vb = val(b)
      if (va < vb) return -mul
      if (va > vb) return mul
      return 0
    })
  }, [filtered, sort, dir])

  // Paginación del render: renderizar cientos/miles de filas de golpe cuelga el
  // navegador. Mostramos de a PAGE_SIZE; los stats/contadores siguen calculándose
  // sobre la lista completa (no sobre la página visible).
  const PAGE_SIZE = 30
  const [pageRows, setPageRows] = useState(0)
  useEffect(() => { setPageRows(0) }, [search, activeTab, sort, dir])
  const totalPagesRows = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const pagedSorted = useMemo(
    () => sorted.slice(pageRows * PAGE_SIZE, pageRows * PAGE_SIZE + PAGE_SIZE),
    [sorted, pageRows],
  )

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
    setSearch(params.q || '')
    setActiveTab(params.tab || 'TODAS')
    setSort(params.sort || '')
    setDir(params.dir || 'asc')
  }

  const handleChangeStatus = async () => {
    if (!confirmStatus) return
    setSavingStatus(true)
    try {
      await updateSolicitudEstado(confirmStatus.id, confirmStatus.newStatus)
      toast.success('Estado de solicitud actualizado')
      setConfirmStatus(null)
      load()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo cambiar el estado'))
    } finally {
      setSavingStatus(false)
    }
  }

  // Drop en el kanban. Arrastrar ya es la confirmación (no se abre el
  // ConfirmDialog de la tabla); entregar sí pasa por su modal porque captura
  // cantidades y almacén. Los 409 del backend (stock insuficiente, transición
  // inválida) llegan como toast y la tarjeta no se mueve — el refetch del
  // websocket deja el tablero como el server lo ve.
  const handleDropEstado = async (s, nuevoEstado) => {
    if (nuevoEstado === s.estatus) return
    if (s.estatus === 'APROBADA' && nuevoEstado === 'ENTREGADA') {
      setEntregaTarget(s)
      return
    }
    try {
      await updateSolicitudEstado(s.id, nuevoEstado)
      toast.success(`Solicitud #${s.id} → ${nuevoEstado.toLowerCase()}`)
      load()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo cambiar el estado'))
    }
  }

  const getStatusTone = (estatus) => {
    switch (estatus) {
      case 'PENDIENTE': return 'warning'
      case 'APROBADA':  return 'success'
      case 'RECHAZADA': return 'danger'
      case 'ENTREGADA': return 'info'
      default: return 'neutral'
    }
  }

  const STAT_CARDS = [
    { key: 'TOTAL',     label: 'Total',      value: stats.TOTAL,     icon: ListTodo },
    { key: 'PENDIENTE', label: 'Pendientes', value: stats.PENDIENTE, icon: Clock },
    { key: 'APROBADA',  label: 'Aprobadas',  value: stats.APROBADA,  icon: ThumbsUp },
    { key: 'RECHAZADA', label: 'Rechazadas', value: stats.RECHAZADA, icon: ThumbsDown },
    { key: 'ENTREGADA', label: 'Entregadas', value: stats.ENTREGADA, icon: PackageOpen },
  ]

  return (
    <div>
      <PageHeader
        icon={ClipboardList}
        title={<span className="inline-flex items-center gap-1.5">
          {isAdmin ? 'Solicitudes de Material' : 'Mis solicitudes'}
          <InfoTip text={isAdmin
            ? 'Bandeja para revisar pedidos: aprobar, rechazar o entregar. El comprobante en PDF se imprime con el ícono de impresora.'
            : 'Tus pedidos y su estado (pendiente, aprobada, entregada o rechazada). Para crear uno nuevo usa “Pedir material”.'} />
        </span>}
        description={
          isAdmin
            ? 'Gestión de solicitudes realizadas por los empleados.'
            : 'Tus solicitudes y su estado actual.'
        }
      />

      <Card className="mt-4 border-brand-200 dark:border-brand-900 bg-brand-50/60 dark:bg-brand-900/10">
        <div className="p-3 text-sm text-ink-700 dark:text-ink-300">
          {isAdmin ? (
            <>
              <p className="font-semibold mb-1">¿Cómo funciona?</p>
              <p className="text-xs text-ink-600 dark:text-ink-400">
                Aquí llegan las solicitudes de los empleados.
                <strong> 1)</strong> Ábrela en <strong>Ver detalles</strong> para revisar lo que piden.
                <strong> 2)</strong> <strong>Aprueba</strong> o <strong>rechaza</strong> (puedes ajustar la cantidad aprobada).
                <strong> 3)</strong> Pulsa <strong>Entregar</strong> para surtir todo o solo una parte; lo que falte queda pendiente.
              </p>
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                <strong>Herramientas:</strong> para poder entregar una herramienta solicitada, el usuario que la pidió
                debe tener un <strong>empleado ligado a su cuenta</strong> (desde <strong>Usuarios</strong>). Si no lo tiene,
                liga la cuenta primero o entrégala manualmente desde <strong>Asignaciones de herramienta</strong>.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold mb-1">¿Qué es esto?</p>
              <p className="text-xs text-ink-600 dark:text-ink-400">
                Aquí ves tus solicitudes de material y herramienta y en qué van. El almacén las revisa,
                las aprueba y te las entrega. Usa <strong>Ver detalles</strong> para ver lo pedido y lo entregado,
                o <strong>Imprimir</strong> para tener el comprobante.
              </p>
            </>
          )}
        </div>
      </Card>

      {/* Stats sobrios — compactos para 5 columnas: chip pequeño + número ajustado. */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
        {STAT_CARDS.map((s) => {
          const Icon = s.icon
          const isActive = activeTab === s.key || (s.key === 'TOTAL' && activeTab === 'TODAS')
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setActiveTab(s.key === 'TOTAL' ? 'TODAS' : s.key)}
              className={`px-4 py-3 rounded-xl border text-left transition-colors bg-white dark:bg-ink-900 flex items-center gap-3 ${
                isActive
                  ? 'border-brand-600 ring-1 ring-brand-500/30'
                  : 'border-ink-200 dark:border-ink-800 hover:border-ink-300 dark:hover:border-ink-700'
              }`}
            >
              <div className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200 flex-shrink-0">
                <Icon size={17} strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-semibold tabular-nums text-ink-900 dark:text-ink-100 leading-none">{s.value}</p>
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400 mt-1 truncate">{s.label}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Tabs + buscador */}
      <Card className="mt-6 !p-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Toggle tabla/kanban */}
          <div className="inline-flex rounded-md border border-ink-200 dark:border-ink-700 overflow-hidden flex-shrink-0">
            <button
              type="button"
              onClick={() => setVista('tabla')}
              title="Vista de tabla"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                vista === 'tabla'
                  ? 'bg-brand-700 text-white'
                  : 'bg-white dark:bg-ink-900 text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800'
              }`}
            >
              <List size={13} /> Tabla
            </button>
            <button
              type="button"
              onClick={() => setVista('kanban')}
              title="Vista de tablero"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold transition-colors border-l border-ink-200 dark:border-ink-700 ${
                vista === 'kanban'
                  ? 'bg-brand-700 text-white'
                  : 'bg-white dark:bg-ink-900 text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800'
              }`}
            >
              <LayoutGrid size={13} /> Tablero
            </button>
          </div>

          {vista === 'tabla' && (
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((t) => {
              const Icon = t.icon
              const isActive = activeTab === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                    isActive
                      ? 'bg-brand-700 text-white border-brand-700'
                      : 'bg-white dark:bg-ink-900 text-ink-600 dark:text-ink-300 border-ink-200 dark:border-ink-700 hover:border-ink-300 dark:hover:border-ink-600'
                  }`}
                >
                  <Icon size={13} strokeWidth={1.8} />
                  {t.label}
                </button>
              )
            })}
          </div>
          )}

          <div className="relative flex-1 sm:ml-auto sm:max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por ID, solicitante, proyecto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block w-full h-9 pl-9 pr-3 rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
            />
          </div>
        </div>
      </Card>

      {/* Vistas guardadas (filtros + orden con nombre) */}
      <div className="mt-4">
        <SavedViews
          listKey="inventario-solicitudes"
          current={{ q: search, tab: activeTab === 'TODAS' ? '' : activeTab, sort, dir: sort ? dir : '' }}
          defaults={{ q: '', tab: '', sort: '', dir: '' }}
          onApply={aplicarVista}
        />
      </div>

      {/* Tablero kanban: arrastrar tarjeta = cambio de estado. Solo admin/
          inventario puede arrastrar; los demás ven el tablero de lectura. */}
      {vista === 'kanban' && (
        loading ? (
          <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
          </div>
        ) : (
          <SolicitudesKanban
            solicitudes={filteredBySearch}
            isAdmin={isAdmin}
            onCardClick={(s) => setViewDetails(s)}
            onDropEstado={handleDropEstado}
            getStatusTone={getStatusTone}
            isAprobadaConPendiente={isAprobadaConPendiente}
          />
        )
      )}

      {/* Tabla */}
      {vista === 'tabla' && (
      <Card className="mt-4">
        {loading ? (
          <div className="p-6"><Skeleton className="h-40 w-full" /></div>
        ) : sorted.length === 0 ? (
          <div className="p-10 text-center text-ink-500">
            {solicitudes.length === 0
              ? 'No hay solicitudes registradas.'
              : 'Sin solicitudes para los filtros seleccionados.'}
          </div>
        ) : (
          <div className="overflow-x-auto hidden md:block">
            <Table>
              <THead>
                <THSort field="id" sort={sort} dir={dir} onSort={onSort}>ID</THSort>
                <THSort field="fecha" sort={sort} dir={dir} onSort={onSort}>Fecha</THSort>
                <THSort field="solicitante" sort={sort} dir={dir} onSort={onSort}>Solicitante</THSort>
                <THSort field="proyecto" sort={sort} dir={dir} onSort={onSort}>Proyecto</THSort>
                <THSort field="items" sort={sort} dir={dir} onSort={onSort}>Ítems</THSort>
                <THSort field="estado" sort={sort} dir={dir} onSort={onSort}>Estado</THSort>
                <TH align="right">Acciones</TH>
              </THead>
              <TBody>
                {pagedSorted.map((s) => {
                  const tienePendiente = isAprobadaConPendiente(s)
                  return (
                  <TR key={s.id}>
                    <TD className="font-mono text-sm">#{s.id}</TD>
                    <TD className="text-sm">
                      {new Date(s.fecha_creacion).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                    </TD>
                    <TD className="font-medium">{s.solicitante_nombre}</TD>
                    <TD>{s.proyecto || '—'}</TD>
                    <TD className="text-sm text-ink-500">{s.detalles?.length || 0}</TD>
                    <TD>
                      <div className="flex flex-col items-start gap-1">
                        <Badge tone={getStatusTone(s.estatus)} dot>{ESTATUS_LABEL[s.estatus] || s.estatus}</Badge>
                        {s.estatus === 'APROBADA' && tienePendiente && (
                          <span className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold uppercase tracking-wide">
                            Falta entregar
                          </span>
                        )}
                      </div>
                    </TD>
                    <TD align="right">
                      <div className="inline-flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setViewDetails(s)}>Ver detalles</Button>

                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Imprimir comprobante (PDF)"
                          onClick={() => handlePrint(s.id)}
                          loading={printingId === s.id}
                          disabled={printingId === s.id}
                        >
                          <Printer size={16} className="text-brand-600 dark:text-brand-300" />
                        </Button>

                        {isAdmin && s.estatus === 'PENDIENTE' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Aprobar"
                              onClick={() => setConfirmStatus({ id: s.id, newStatus: 'APROBADA', title: 'Aprobar solicitud', text: '¿Confirmas la aprobación de esta solicitud?' })}
                            >
                              <CheckCircle2 size={16} className="text-emerald-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Rechazar"
                              onClick={() => setConfirmStatus({ id: s.id, newStatus: 'RECHAZADA', title: 'Rechazar solicitud', text: '¿Confirmas el rechazo de esta solicitud?' })}
                            >
                              <XCircle size={16} className="text-red-600" />
                            </Button>
                          </>
                        )}
                        {isAdmin && s.estatus === 'APROBADA' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setEntregaTarget(s)}
                          >
                            <PackageCheck size={16} className="mr-1.5" /> Entregar
                          </Button>
                        )}
                      </div>
                    </TD>
                  </TR>
                )})}
              </TBody>
            </Table>
          </div>
        )}

        {/* Móvil: tarjetas */}
        {!loading && sorted.length > 0 && (
          <div className="md:hidden space-y-2 p-3">
            {pagedSorted.map((s) => {
              const tienePendiente = isAprobadaConPendiente(s)
              return (
                <div key={s.id} className="rounded-lg border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-ink-900 dark:text-ink-100 truncate">
                        <span className="font-mono text-ink-500">#{s.id}</span> · {s.solicitante_nombre}
                      </p>
                      <p className="text-[11px] text-ink-500 dark:text-ink-400 truncate">
                        {s.proyecto || 'Sin proyecto'} · {s.detalles?.length || 0} ítem{(s.detalles?.length || 0) === 1 ? '' : 's'}
                      </p>
                      <p className="text-[11px] text-ink-400">
                        {new Date(s.fecha_creacion).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <Badge tone={getStatusTone(s.estatus)} dot>{ESTATUS_LABEL[s.estatus] || s.estatus}</Badge>
                      {s.estatus === 'APROBADA' && tienePendiente && (
                        <span className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold uppercase tracking-wide">Falta entregar</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1 mt-2 border-t border-ink-100 dark:border-ink-800 pt-2">
                    <Button variant="ghost" size="sm" onClick={() => setViewDetails(s)}>Ver detalles</Button>
                    <Button variant="ghost" size="icon-sm" title="Imprimir comprobante (PDF)"
                            onClick={() => handlePrint(s.id)} loading={printingId === s.id} disabled={printingId === s.id}>
                      <Printer size={16} className="text-brand-600 dark:text-brand-300" />
                    </Button>
                    {isAdmin && s.estatus === 'PENDIENTE' && (
                      <>
                        <Button variant="ghost" size="icon-sm" title="Aprobar"
                                onClick={() => setConfirmStatus({ id: s.id, newStatus: 'APROBADA', title: 'Aprobar solicitud', text: '¿Confirmas la aprobación de esta solicitud?' })}>
                          <CheckCircle2 size={16} className="text-emerald-600" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" title="Rechazar"
                                onClick={() => setConfirmStatus({ id: s.id, newStatus: 'RECHAZADA', title: 'Rechazar solicitud', text: '¿Confirmas el rechazo de esta solicitud?' })}>
                          <XCircle size={16} className="text-red-600" />
                        </Button>
                      </>
                    )}
                    {isAdmin && s.estatus === 'APROBADA' && (
                      <Button variant="primary" size="sm" onClick={() => setEntregaTarget(s)}>
                        <PackageCheck size={16} className="mr-1.5" /> Entregar
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!loading && sorted.length > PAGE_SIZE && (
          <Pagination
            page={pageRows}
            totalPages={totalPagesRows}
            totalElements={sorted.length}
            size={PAGE_SIZE}
            onChange={setPageRows}
          />
        )}
      </Card>
      )}

      <ConfirmDialog
        open={!!confirmStatus}
        onClose={() => setConfirmStatus(null)}
        onConfirm={handleChangeStatus}
        loading={savingStatus}
        title={confirmStatus?.title}
        description={confirmStatus?.text}
        confirmLabel="Confirmar"
        tone={confirmStatus?.newStatus === 'RECHAZADA' ? 'danger' : 'primary'}
      />

      {/* Modal de detalles (lectura + edición de cantidad_aprobada) */}
      <DetallesModal
        solicitud={viewDetails}
        onClose={() => setViewDetails(null)}
        onChanged={load}
        isAdmin={isAdmin}
        getStatusTone={getStatusTone}
      />

      {/* Modal de entrega parcial */}
      <EntregaModal
        solicitud={entregaTarget}
        onClose={() => setEntregaTarget(null)}
        onDone={() => { setEntregaTarget(null); load() }}
      />
    </div>
  )
}


// ─── helpers ───────────────────────────────────────────────────────────────────

function isAprobadaConPendiente(s) {
  if (s?.estatus !== 'APROBADA') return false
  return (s.detalles || []).some((d) => {
    if ((d.tipo_item || 'MATERIAL') !== 'MATERIAL') return false
    const aprob = num(d.cantidad_aprobada)
    const ent = num(d.cantidad_entregada)
    return aprob > 0 && ent < aprob
  })
}


// ─── DetallesModal ─────────────────────────────────────────────────────────────

function DetallesModal({ solicitud, onClose, onChanged, isAdmin, getStatusTone }) {
  const [editing, setEditing] = useState(null)   // detalle id
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  if (!solicitud) return null
  const puedeEditar = isAdmin && solicitud.estatus === 'APROBADA'

  const beginEdit = (det) => {
    setEditing(det.id)
    setEditValue(String(det.cantidad_aprobada ?? det.cantidad_solicitada ?? 0))
  }
  const cancelEdit = () => { setEditing(null); setEditValue('') }
  const saveEdit = async (det) => {
    const valor = Number(editValue)
    if (!Number.isFinite(valor) || valor < 0) {
      toast.error('Cantidad inválida')
      return
    }
    if (!unidadPermiteDecimales(det.producto_unidad) && !Number.isInteger(valor)) {
      toast.error(`Este material se maneja en cantidades enteras (${det.producto_unidad || 'pieza'})`)
      return
    }
    setSaving(true)
    try {
      await patchSolicitudDetalle(solicitud.id, det.id, { cantidad_aprobada: valor })
      toast.success('Cantidad aprobada actualizada')
      setEditing(null)
      onChanged?.()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo actualizar'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={!!solicitud}
      onClose={onClose}
      title={`Solicitud #${solicitud.id}`}
      footer={<Button onClick={onClose}>Cerrar</Button>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-sm bg-ink-50 dark:bg-ink-900 p-3 rounded-lg">
          <div>
            <span className="text-ink-500 block">Solicitante</span>
            <span className="font-medium text-ink-900 dark:text-ink-100">{solicitud.solicitante_nombre}</span>
          </div>
          <div>
            <span className="text-ink-500 block">Fecha</span>
            <span className="font-medium text-ink-900 dark:text-ink-100">{new Date(solicitud.fecha_creacion).toLocaleString('es-MX')}</span>
          </div>
          <div>
            <span className="text-ink-500 block">Proyecto</span>
            <span className="font-medium text-ink-900 dark:text-ink-100">{solicitud.proyecto || 'N/A'}</span>
          </div>
          <div>
            <span className="text-ink-500 block">Estado actual</span>
            <Badge tone={getStatusTone(solicitud.estatus)}>{ESTATUS_LABEL[solicitud.estatus] || solicitud.estatus}</Badge>
          </div>
        </div>

        {isAprobadaConPendiente(solicitud) && (
          <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-sm">
            <AlertTriangle size={16} className="mt-0.5" />
            <span>
              {isAdmin
                ? <>Esta solicitud se entregó solo en parte. Usa el botón <strong>Entregar</strong> para surtir lo que falta.</>
                : <>Aún falta entregarte parte de lo aprobado. El almacén lo surtirá en cuanto pueda.</>}
            </span>
          </div>
        )}

        {solicitud.notas && (
          <div className="rounded-lg border-l-4 border-ink-400 bg-ink-50 dark:bg-ink-900 p-3 text-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400 mb-1">Observaciones</p>
            <p className="text-ink-700 dark:text-ink-200 whitespace-pre-line">{solicitud.notas}</p>
          </div>
        )}

        <div className="flex items-center justify-between mt-4 mb-1">
          <h4 className="font-semibold text-ink-900 dark:text-ink-100">Artículos solicitados</h4>
          <span className="text-xs text-ink-500">{solicitud.detalles.length} ítem(s)</span>
        </div>
        <div className="space-y-2">
          {solicitud.detalles.map((d) => {
            const isTool = (d.tipo_item || 'MATERIAL') === 'HERRAMIENTA'
            const sol = num(d.cantidad_solicitada)
            const aprob = num(d.cantidad_aprobada)
            const ent = num(d.cantidad_entregada)
            const baseline = aprob > 0 ? aprob : sol
            const pendiente = Math.max(0, baseline - ent)
            const editable = puedeEditar && !isTool && d.producto_id
            const isEditing = editable && editing === d.id
            return (
              <div key={d.id} className="border border-ink-200 dark:border-ink-800 rounded-lg p-3 bg-white dark:bg-ink-900">
                {/* Encabezado del ítem */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        isTool
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                          : 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                      }`}>
                        {isTool ? 'Herramienta' : 'Material'}
                      </span>
                      <p className="font-semibold text-ink-900 dark:text-ink-100">{d.producto_descripcion}</p>
                    </div>
                    <p className="text-xs text-ink-500 font-mono mt-0.5">{d.producto_codigo} · {d.producto_unidad}</p>
                    {isTool && (
                      <div className="mt-1.5 text-xs text-ink-500 space-y-0.5">
                        {(d.fecha_uso_inicio || d.fecha_uso_fin) && (
                          <p>
                            <span className="font-semibold text-ink-600 dark:text-ink-400">Uso:</span>{' '}
                            {d.fecha_uso_inicio ? new Date(d.fecha_uso_inicio).toLocaleDateString('es-MX') : '?'}
                            {' → '}
                            {d.fecha_uso_fin ? new Date(d.fecha_uso_fin).toLocaleDateString('es-MX') : '?'}
                          </p>
                        )}
                        {d.justificacion && (
                          <p><span className="font-semibold text-ink-600 dark:text-ink-400">Justificación:</span> {d.justificacion}</p>
                        )}
                        {d.complementos && <p className="italic">+ {d.complementos}</p>}
                      </div>
                    )}
                    {!isTool && d.justificacion && (
                      <p className="mt-1.5 text-xs text-ink-500">
                        <span className="font-semibold text-ink-600 dark:text-ink-400">Justificación:</span> {d.justificacion}
                      </p>
                    )}
                  </div>
                  {editable && (
                    isEditing ? (
                      <div className="inline-flex gap-1 flex-shrink-0">
                        <Button size="sm" variant="primary" onClick={() => saveEdit(d)} loading={saving} disabled={saving}>OK</Button>
                        <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={saving}>X</Button>
                      </div>
                    ) : (
                      <Button size="icon-sm" variant="ghost" title="Editar cantidad aprobada" onClick={() => beginEdit(d)} className="flex-shrink-0">
                        <Pencil size={14} />
                      </Button>
                    )
                  )}
                </div>

                {/* Cantidades en chips */}
                <div className="grid grid-cols-4 gap-2 mt-3">
                  <div className="rounded-md bg-ink-50 dark:bg-ink-800/50 px-2 py-1.5 text-center">
                    <p className="text-[9px] uppercase font-bold tracking-wide text-ink-400">Solicitada</p>
                    <p className="text-sm font-semibold tabular-nums text-ink-700 dark:text-ink-200">{sol}</p>
                  </div>
                  <div className="rounded-md bg-ink-50 dark:bg-ink-800/50 px-2 py-1.5 text-center">
                    <p className="text-[9px] uppercase font-bold tracking-wide text-ink-400">Aprobada</p>
                    {isEditing ? (
                      <input
                        type="number"
                        min={ent}
                        max={sol}
                        step={unidadPermiteDecimales(d.producto_unidad) ? '0.01' : 1}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full mt-0.5 px-1 py-0.5 rounded border border-brand-400 text-center text-sm tabular-nums bg-white dark:bg-ink-900"
                        autoFocus
                      />
                    ) : (
                      <p className="text-sm font-semibold tabular-nums text-ink-900 dark:text-ink-100">{aprob || sol}</p>
                    )}
                  </div>
                  <div className="rounded-md bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1.5 text-center">
                    <p className="text-[9px] uppercase font-bold tracking-wide text-emerald-600 dark:text-emerald-400">Entregada</p>
                    <p className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">{ent}</p>
                  </div>
                  <div className={`rounded-md px-2 py-1.5 text-center ${pendiente > 0 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-ink-50 dark:bg-ink-800/50'}`}>
                    <p className={`text-[9px] uppercase font-bold tracking-wide ${pendiente > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-ink-400'}`}>Pendiente</p>
                    <p className={`text-sm font-semibold tabular-nums ${pendiente > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-ink-400'}`}>{pendiente}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}


// ─── EntregaModal ──────────────────────────────────────────────────────────────

function EntregaModal({ solicitud, onClose, onDone }) {
  const [almacenes, setAlmacenes] = useState([])
  const [almacenId, setAlmacenId] = useState('')
  const [motivo, setMotivo] = useState('')
  const [fechaDevolucionPrevista, setFechaDevolucionPrevista] = useState('')
  const [cantidades, setCantidades] = useState({}) // detalle_id → string (aplica a material Y herramienta)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!solicitud) return
    getAlmacenes()
      .then((arr) => {
        const activos = (arr || []).filter((a) => a.activo)
        setAlmacenes(activos)
        if (activos.length === 1) setAlmacenId(String(activos[0].id))
      })
      .catch(() => toast.error('No se pudieron cargar almacenes'))
    // Precargar cantidades = pendiente por línea (material y herramienta).
    const init = {}
    ;(solicitud.detalles || []).forEach((d) => {
      const tipo = (d.tipo_item || 'MATERIAL').toUpperCase()
      if (tipo === 'HERRAMIENTA' && !d.herramienta_id) return
      if (tipo === 'MATERIAL' && !d.producto_id) return
      const baseline = num(d.cantidad_aprobada) > 0 ? num(d.cantidad_aprobada) : num(d.cantidad_solicitada)
      const pendiente = Math.max(0, baseline - num(d.cantidad_entregada))
      init[d.id] = pendiente > 0 ? String(pendiente) : '0'
    })
    setCantidades(init)
    setMotivo('')
    setFechaDevolucionPrevista('')
  }, [solicitud?.id])

  if (!solicitud) return null

  const lineasMaterial = (solicitud.detalles || []).filter(
    (d) => (d.tipo_item || 'MATERIAL') === 'MATERIAL' && d.producto_id,
  )
  const lineasHerramienta = (solicitud.detalles || []).filter(
    (d) => (d.tipo_item || 'MATERIAL').toUpperCase() === 'HERRAMIENTA' && d.herramienta_id,
  )

  const totalAEntregar = Object.values(cantidades).reduce((acc, v) => acc + (Number(v) || 0), 0)
  const todasLasLineas = [...lineasMaterial, ...lineasHerramienta]
  const algunaEntregaIncompleta = todasLasLineas.some((d) => {
    const baseline = num(d.cantidad_aprobada) > 0 ? num(d.cantidad_aprobada) : num(d.cantidad_solicitada)
    const pendienteActual = Math.max(0, baseline - num(d.cantidad_entregada))
    const aEntregar = Number(cantidades[d.id] || 0)
    return aEntregar < pendienteActual
  })

  const handleSubmit = async () => {
    // Almacén SOLO es obligatorio si hay material a entregar.
    const hayMaterial = lineasMaterial.some((d) => Number(cantidades[d.id] || 0) > 0)
    if (hayMaterial && !almacenId) {
      toast.error('Selecciona el almacén de origen')
      return
    }
    // Decimales solo donde la unidad lo permite; herramientas siempre enteras.
    const matDecimalMal = lineasMaterial.find((d) => {
      const v = Number(cantidades[d.id] || 0)
      return v > 0 && !unidadPermiteDecimales(d.producto_unidad) && !Number.isInteger(v)
    })
    if (matDecimalMal) {
      toast.error(`"${matDecimalMal.producto_descripcion}" se entrega en cantidades enteras (${matDecimalMal.producto_unidad || 'pieza'})`)
      return
    }
    const herrDecimalMal = lineasHerramienta.find((d) => {
      const v = Number(cantidades[d.id] || 0)
      return v > 0 && !Number.isInteger(v)
    })
    if (herrDecimalMal) {
      toast.error('Las herramientas se entregan en cantidades enteras')
      return
    }
    const entregas = todasLasLineas
      .map((d) => ({
        detalle_id: d.id,
        cantidad_entregada: Number(cantidades[d.id] || 0),
      }))
      .filter((e) => e.cantidad_entregada > 0)

    if (entregas.length === 0) {
      toast.error('Captura al menos una cantidad mayor a 0')
      return
    }

    const payload = {
      motivo: motivo.trim() || undefined,
      entregas,
    }
    if (hayMaterial) payload.almacen_origen_id = Number(almacenId)
    if (fechaDevolucionPrevista) payload.fecha_devolucion_prevista = fechaDevolucionPrevista

    setSaving(true)
    try {
      const res = await entregarSolicitud(solicitud.id, payload)
      if (res.estatus === 'ENTREGADA') {
        toast.success(`Solicitud #${solicitud.id} entregada completa`)
      } else {
        toast.success(`Entrega parcial registrada — falta surtir el resto`)
      }
      onDone?.()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo registrar la entrega'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={!!solicitud}
      onClose={onClose}
      title={`Entregar solicitud #${solicitud.id}`}
      size="lg"
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving} disabled={saving || totalAEntregar <= 0}>
            <PackageCheck size={16} className="mr-1.5" />
            Registrar entrega
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-600 dark:text-ink-300">
          Escribe cuánto entregas ahora de cada cosa. Puedes entregar <strong>todo</strong> o solo una
          <strong> parte</strong>; lo que falte queda pendiente para entregarlo después. Lo entregado se
          descuenta del almacén que elijas.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {lineasMaterial.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-ink-600 dark:text-ink-300 mb-1 block">
                Almacén de origen
              </label>
              <Select value={almacenId} onChange={(e) => setAlmacenId(e.target.value)}>
                <option value="">Selecciona…</option>
                {almacenes.map((a) => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </Select>
            </div>
          )}
          {lineasHerramienta.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-ink-600 dark:text-ink-300 mb-1 block">
                Devolución prevista (herramientas)
              </label>
              <input
                type="datetime-local"
                value={fechaDevolucionPrevista}
                onChange={(e) => setFechaDevolucionPrevista(e.target.value)}
                className="block w-full h-9 px-3 rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
            </div>
          )}
          <div className={lineasMaterial.length > 0 && lineasHerramienta.length > 0 ? 'sm:col-span-2' : ''}>
            <label className="text-xs font-semibold text-ink-600 dark:text-ink-300 mb-1 block">
              Motivo (opcional)
            </label>
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={250}
              placeholder={`Entrega solicitud #${solicitud.id}`}
              className="block w-full h-9 px-3 rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
            />
          </div>
        </div>

        {lineasMaterial.length > 0 && (
          <div className="border border-ink-200 dark:border-ink-800 rounded-lg overflow-hidden">
            <div className="bg-ink-50 dark:bg-ink-800/50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-600 dark:text-ink-300 border-b border-ink-200 dark:border-ink-800">
              Materiales
            </div>
            <table className="w-full text-sm">
              <thead className="bg-ink-50 dark:bg-ink-900 text-xs text-ink-500 uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Ítem</th>
                  <th className="text-right px-2 py-2">Aprobada</th>
                  <th className="text-right px-2 py-2">Ya entregada</th>
                  <th className="text-right px-2 py-2">Pendiente</th>
                  <th className="text-right px-2 py-2 w-28">Entregar ahora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-200 dark:divide-ink-800">
                {lineasMaterial.map((d) => {
                  const baseline = num(d.cantidad_aprobada) > 0 ? num(d.cantidad_aprobada) : num(d.cantidad_solicitada)
                  const yaEnt = num(d.cantidad_entregada)
                  const pendiente = Math.max(0, baseline - yaEnt)
                  const valor = cantidades[d.id] ?? ''
                  const numVal = Number(valor) || 0
                  const excede = numVal > pendiente
                  const permiteDec = unidadPermiteDecimales(d.producto_unidad)
                  const decimalInvalido = !permiteDec && numVal !== Math.floor(numVal)
                  return (
                    <tr key={d.id}>
                      <td className="px-3 py-2">
                        <p className="font-medium text-ink-900 dark:text-ink-100">{d.producto_descripcion}</p>
                        <p className="text-xs text-ink-500">{d.producto_codigo} · {d.producto_unidad}</p>
                      </td>
                      <td className="px-2 py-2 text-right font-semibold">{baseline}</td>
                      <td className="px-2 py-2 text-right text-emerald-700 dark:text-emerald-300">{yaEnt}</td>
                      <td className={`px-2 py-2 text-right font-semibold ${pendiente > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-ink-400'}`}>
                        {pendiente}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          max={pendiente}
                          step={permiteDec ? '0.01' : 1}
                          value={valor}
                          onChange={(e) => setCantidades((s) => ({ ...s, [d.id]: e.target.value }))}
                          disabled={pendiente <= 0}
                          className={`w-24 px-2 py-1 rounded border text-right text-sm ${
                            excede || decimalInvalido
                              ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                              : 'border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900'
                          }`}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {lineasHerramienta.length > 0 && (
          <div className="border border-ink-200 dark:border-ink-800 rounded-lg overflow-hidden">
            <div className="bg-ink-50 dark:bg-ink-800/50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-600 dark:text-ink-300 border-b border-ink-200 dark:border-ink-800">
              Herramientas — se asignan al trabajador del solicitante
            </div>
            <table className="w-full text-sm">
              <thead className="bg-ink-50 dark:bg-ink-900 text-xs text-ink-500 uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Ítem</th>
                  <th className="text-right px-2 py-2">Aprobada</th>
                  <th className="text-right px-2 py-2">Ya entregada</th>
                  <th className="text-right px-2 py-2">Pendiente</th>
                  <th className="text-right px-2 py-2 w-28">Unidades a entregar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-200 dark:divide-ink-800">
                {lineasHerramienta.map((d) => {
                  const baseline = num(d.cantidad_aprobada) > 0 ? num(d.cantidad_aprobada) : num(d.cantidad_solicitada)
                  const yaEnt = num(d.cantidad_entregada)
                  const pendiente = Math.max(0, baseline - yaEnt)
                  const valor = cantidades[d.id] ?? ''
                  const numVal = Number(valor) || 0
                  const excede = numVal > pendiente
                  const decimal = numVal !== Math.floor(numVal)
                  return (
                    <tr key={d.id}>
                      <td className="px-3 py-2">
                        <p className="font-medium text-ink-900 dark:text-ink-100">{d.item_descripcion || d.producto_descripcion}</p>
                        <p className="text-xs text-ink-500">{d.item_codigo || d.producto_codigo} · {d.item_unidad || 'pieza'}</p>
                      </td>
                      <td className="px-2 py-2 text-right font-semibold">{baseline}</td>
                      <td className="px-2 py-2 text-right text-emerald-700 dark:text-emerald-300">{yaEnt}</td>
                      <td className={`px-2 py-2 text-right font-semibold ${pendiente > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-ink-400'}`}>
                        {pendiente}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          max={pendiente}
                          step={1}
                          value={valor}
                          onChange={(e) => setCantidades((s) => ({ ...s, [d.id]: e.target.value }))}
                          disabled={pendiente <= 0}
                          className={`w-24 px-2 py-1 rounded border text-right text-sm ${
                            excede || decimal
                              ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                              : 'border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900'
                          }`}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {algunaEntregaIncompleta && totalAEntregar > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-sm">
            <AlertTriangle size={16} className="mt-0.5" />
            <span>Vas a registrar una <strong>entrega parcial</strong>. La solicitud queda en APROBADA y podrás entregar el resto después.</span>
          </div>
        )}
      </div>
    </Modal>
  )
}
