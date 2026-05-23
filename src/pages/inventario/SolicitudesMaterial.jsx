import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  ClipboardList, CheckCircle2, XCircle, PackageCheck, Search, Clock,
  ListTodo, ThumbsUp, ThumbsDown, PackageOpen,
} from 'lucide-react'
import {
  Button, Card, PageHeader, ConfirmDialog,
  Skeleton, Table, THead, TH, TBody, TR, TD, Badge, Modal,
} from '../../components/ui'
import { getSolicitudes, updateSolicitudEstado } from '../../api/inventario'
import { extractApiError } from '../../utils/apiError'
import { useAuth } from '../../context/AuthContext'

const TABS = [
  { key: 'TODAS',     label: 'Todas',      icon: ListTodo,   color: 'text-ink-600' },
  { key: 'PENDIENTE', label: 'Pendientes', icon: Clock,      color: 'text-amber-600' },
  { key: 'APROBADA',  label: 'Aprobadas',  icon: ThumbsUp,   color: 'text-emerald-600' },
  { key: 'RECHAZADA', label: 'Rechazadas', icon: ThumbsDown, color: 'text-red-600' },
  { key: 'ENTREGADA', label: 'Entregadas', icon: PackageOpen, color: 'text-blue-600' },
]

export default function SolicitudesMaterial() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'inventario'

  const [solicitudes, setSolicitudes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('TODAS')

  const [confirmStatus, setConfirmStatus] = useState(null)
  const [savingStatus, setSavingStatus] = useState(false)
  const [viewDetails, setViewDetails] = useState(null)

  const load = () => {
    setLoading(true)
    getSolicitudes({ limit: 200 })
      .then(setSolicitudes)
      .catch((err) => toast.error(extractApiError(err, 'Error al cargar solicitudes')))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const stats = useMemo(() => {
    const acc = { TOTAL: solicitudes.length, PENDIENTE: 0, APROBADA: 0, RECHAZADA: 0, ENTREGADA: 0 }
    solicitudes.forEach((s) => { acc[s.estatus] = (acc[s.estatus] || 0) + 1 })
    return acc
  }, [solicitudes])

  const filtered = useMemo(() => {
    let res = solicitudes
    if (activeTab !== 'TODAS') {
      res = res.filter((s) => s.estatus === activeTab)
    }
    const q = search.trim().toLowerCase()
    if (q) {
      res = res.filter((s) =>
        String(s.id).includes(q) ||
        s.solicitante_nombre?.toLowerCase().includes(q) ||
        s.proyecto?.toLowerCase().includes(q) ||
        s.detalles?.some((d) =>
          d.producto_descripcion?.toLowerCase().includes(q) ||
          d.producto_codigo?.toLowerCase().includes(q)
        )
      )
    }
    return res
  }, [solicitudes, activeTab, search])

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
    { key: 'TOTAL',     label: 'Total',      value: stats.TOTAL,     icon: ListTodo,    color: 'text-ink-600',    bg: 'bg-ink-50 dark:bg-ink-800' },
    { key: 'PENDIENTE', label: 'Pendientes', value: stats.PENDIENTE, icon: Clock,       color: 'text-amber-600',  bg: 'bg-amber-50 dark:bg-amber-900/20' },
    { key: 'APROBADA',  label: 'Aprobadas',  value: stats.APROBADA,  icon: ThumbsUp,    color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { key: 'RECHAZADA', label: 'Rechazadas', value: stats.RECHAZADA, icon: ThumbsDown,  color: 'text-red-600',    bg: 'bg-red-50 dark:bg-red-900/20' },
    { key: 'ENTREGADA', label: 'Entregadas', value: stats.ENTREGADA, icon: PackageOpen, color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-900/20' },
  ]

  return (
    <div>
      <PageHeader
        icon={ClipboardList}
        title={isAdmin ? 'Solicitudes de Material' : 'Mis solicitudes'}
        description={
          isAdmin
            ? 'Gestión de solicitudes realizadas por los empleados.'
            : 'Tus solicitudes y su estado actual.'
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
        {STAT_CARDS.map((s) => {
          const Icon = s.icon
          const isActive = activeTab === s.key || (s.key === 'TOTAL' && activeTab === 'TODAS')
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setActiveTab(s.key === 'TOTAL' ? 'TODAS' : s.key)}
              className={`p-4 rounded-xl border text-left transition-all ${
                isActive
                  ? 'border-brand-500 ring-2 ring-brand-500/20 bg-white dark:bg-ink-900'
                  : 'border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 hover:border-brand-300'
              }`}
            >
              <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ${s.bg} ${s.color} mb-2`}>
                <Icon size={18} />
              </div>
              <p className="text-2xl font-extrabold text-ink-900 dark:text-ink-100 leading-none">{s.value}</p>
              <p className="text-xs text-ink-500 mt-1">{s.label}</p>
            </button>
          )
        })}
      </div>

      {/* Tabs + buscador */}
      <Card className="mt-6 !p-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((t) => {
              const Icon = t.icon
              const isActive = activeTab === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all ${
                    isActive
                      ? 'bg-brand-600 text-white border-brand-600'
                      : `bg-white dark:bg-ink-900 ${t.color} border-ink-200 dark:border-ink-700 hover:border-brand-400`
                  }`}
                >
                  <Icon size={13} />
                  {t.label}
                </button>
              )
            })}
          </div>

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

      {/* Tabla */}
      <Card className="mt-4">
        {loading ? (
          <div className="p-6"><Skeleton className="h-40 w-full" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-ink-500">
            {solicitudes.length === 0
              ? 'No hay solicitudes registradas.'
              : 'Sin solicitudes para los filtros seleccionados.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TH>ID</TH>
                <TH>Fecha</TH>
                <TH>Solicitante</TH>
                <TH>Proyecto</TH>
                <TH>Ítems</TH>
                <TH>Estado</TH>
                <TH align="right">Acciones</TH>
              </THead>
              <TBody>
                {filtered.map((s) => (
                  <TR key={s.id}>
                    <TD className="font-mono text-sm">#{s.id}</TD>
                    <TD className="text-sm">
                      {new Date(s.fecha_creacion).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                    </TD>
                    <TD className="font-medium">{s.solicitante_nombre}</TD>
                    <TD>{s.proyecto || '—'}</TD>
                    <TD className="text-sm text-ink-500">{s.detalles?.length || 0}</TD>
                    <TD>
                      <Badge tone={getStatusTone(s.estatus)}>{s.estatus}</Badge>
                    </TD>
                    <TD align="right">
                      <div className="inline-flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setViewDetails(s)}>Ver detalles</Button>

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
                            onClick={() => setConfirmStatus({ id: s.id, newStatus: 'ENTREGADA', title: 'Marcar entregada', text: '¿Confirmas que el material fue entregado?' })}
                          >
                            <PackageCheck size={16} className="mr-1.5" /> Entregar
                          </Button>
                        )}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </Card>

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

      <Modal
        open={!!viewDetails}
        onClose={() => setViewDetails(null)}
        title={`Solicitud #${viewDetails?.id}`}
        footer={<Button onClick={() => setViewDetails(null)}>Cerrar</Button>}
      >
        {viewDetails && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm bg-ink-50 dark:bg-ink-900 p-3 rounded-lg">
              <div>
                <span className="text-ink-500 block">Solicitante</span>
                <span className="font-medium text-ink-900 dark:text-ink-100">{viewDetails.solicitante_nombre}</span>
              </div>
              <div>
                <span className="text-ink-500 block">Fecha</span>
                <span className="font-medium text-ink-900 dark:text-ink-100">{new Date(viewDetails.fecha_creacion).toLocaleString('es-MX')}</span>
              </div>
              <div>
                <span className="text-ink-500 block">Proyecto</span>
                <span className="font-medium text-ink-900 dark:text-ink-100">{viewDetails.proyecto || 'N/A'}</span>
              </div>
              <div>
                <span className="text-ink-500 block">Estado actual</span>
                <Badge tone={getStatusTone(viewDetails.estatus)}>{viewDetails.estatus}</Badge>
              </div>
            </div>

            <h4 className="font-semibold text-ink-900 dark:text-ink-100 mt-4">Artículos solicitados:</h4>
            <ul className="divide-y divide-ink-200 dark:divide-ink-800 border-t border-ink-200 dark:border-ink-800">
              {viewDetails.detalles.map((d) => (
                <li key={d.id} className="py-2 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-sm text-ink-900 dark:text-ink-100">{d.producto_descripcion}</p>
                    <p className="text-xs text-ink-500">{d.producto_codigo}</p>
                  </div>
                  <div className="font-bold text-sm">
                    {d.cantidad_solicitada}{' '}
                    <span className="text-xs font-normal text-ink-500">{d.producto_unidad}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>
    </div>
  )
}
