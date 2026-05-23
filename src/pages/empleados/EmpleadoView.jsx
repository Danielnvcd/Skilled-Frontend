import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Pencil, Download, Briefcase, Hash, Mail, Phone,
  IdCard, FileText, AlertCircle, MapPin, User, UserMinus, UserCheck, Eye,
} from 'lucide-react'
import {
  PageHeader, Button, Card, CardHeader, Skeleton, Badge, EmptyState, ConfirmDialog, ImageViewer,
} from '../../components/ui'
import AvatarFoto from '../../components/empleados/AvatarFoto'
import {
  obtenerTrabajador, exportarEmpleado, descargarDocumento,
  darBajaTrabajador, reactivarTrabajador,
} from '../../api/trabajadores'
import { useAuth } from '../../context/AuthContext'

function fmtFecha(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch { return iso }
}

function fmtMoney(s) {
  if (!s) return null
  const n = parseFloat(s)
  if (Number.isNaN(n)) return null
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)
}

function nominaTone(t) {
  const v = (t || '').toLowerCase()
  if (v === 'semanal') return 'brand'
  if (v === 'por hora') return 'info'
  if (v === 'cuadrado') return 'warning'
  return 'neutral'
}

function DataRow({ label, value, mono = false, tone, className = '' }) {
  return (
    <div className={`flex items-baseline gap-3 py-1.5 ${className}`}>
      <dt className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-400 min-w-[110px] flex-shrink-0">
        {label}
      </dt>
      <dd className="text-sm text-ink-800 dark:text-ink-100 break-words min-w-0">
        {value ? (
          tone ? <Badge tone={tone} dot>{value}</Badge>
          : mono ? <span className="font-mono">{value}</span>
          : value
        ) : <span className="text-ink-400 dark:text-ink-500">—</span>}
      </dd>
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <h3 className="text-sm font-semibold text-ink-800 dark:text-ink-200 mb-3 pb-2 border-b border-ink-200 dark:border-ink-800">
      {children}
    </h3>
  )
}

export default function EmpleadoView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null) // 'baja' | 'reactivar'
  const [busy, setBusy] = useState(false)
  const [viewerDoc, setViewerDoc] = useState(null)

  const cargar = () => {
    setLoading(true)
    return obtenerTrabajador(id)
      .then(setData)
      .catch((err) => {
        toast.error(err.response?.data?.error || 'No se pudo cargar el empleado')
        if (err.response?.status === 404) navigate('/empleados')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [id])

  const onExport = async () => {
    setExporting(true)
    try {
      await exportarEmpleado(id, `${data?.no_empleado}_${data?.nombre_apellidos || ''}.xlsx`)
    } catch {
      toast.error('No se pudo exportar')
    } finally { setExporting(false) }
  }

  const onConfirm = async () => {
    setBusy(true)
    try {
      if (confirmAction === 'baja') {
        await darBajaTrabajador(id)
        toast.success('Empleado dado de baja')
      } else {
        await reactivarTrabajador(id)
        toast.success('Empleado reactivado')
      }
      setConfirmAction(null)
      await cargar()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error en la operación')
    } finally { setBusy(false) }
  }

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const nombreCompleto = `${data.nombre || ''} ${data.nombre_apellidos || ''}`.trim()
  const baja = !data.activo || data.fecha_baja

  return (
    <>
      <PageHeader
        title="Ficha del empleado"
        description={`#${data.no_empleado} · ${data.area || 'Sin área'}`}
        breadcrumb={
          <Link to="/empleados" className="hover:underline inline-flex items-center gap-1">
            <ArrowLeft size={12} /> Volver a empleados
          </Link>
        }
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="secondary" leftIcon={<Download size={14} />} loading={exporting} onClick={onExport}>
              Exportar
            </Button>
            {isAdmin && (
              baja
                ? <Button variant="secondary" leftIcon={<UserCheck size={14} />} onClick={() => setConfirmAction('reactivar')}>Reactivar</Button>
                : <Button variant="danger" leftIcon={<UserMinus size={14} />} onClick={() => setConfirmAction('baja')}>Dar de baja</Button>
            )}
            <Button variant="primary" leftIcon={<Pencil size={14} />} onClick={() => navigate(`/empleados/${id}/editar`)}>
              Editar
            </Button>
          </div>
        }
      />

      {baja && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <span>
            Empleado dado de baja{data.fecha_baja ? ` el ${fmtFecha(data.fecha_baja)}` : ''}.
          </span>
        </div>
      )}

      {/* ── Cabecera con foto + info principal ───────────────────────── */}
      <Card className="mb-6">
        <div className="flex flex-col sm:flex-row gap-5 sm:items-center">
          <AvatarFoto id={Number(id)} hasFoto={Boolean(data.foto_perfil)} name={nombreCompleto} size="xl" thumb={false} />
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold text-ink-900 dark:text-ink-100 truncate">{nombreCompleto}</h2>
            <div className="mt-2 space-y-1 text-sm text-ink-600 dark:text-ink-400">
              <p className="flex items-center gap-2"><Briefcase size={14} className="text-brand-600" />
                <span>{data.puesto || '—'}</span>
                {data.area && <span className="text-ink-400">·</span>}
                {data.area && <span className="font-medium text-ink-700 dark:text-ink-300">{data.area}</span>}
              </p>
              <p className="flex items-center gap-2"><Hash size={14} className="text-brand-600" />
                No. Empleado <strong className="font-mono text-ink-800 dark:text-ink-200">{data.no_empleado}</strong>
              </p>
              {(data.correo || data.celular) && (
                <p className="flex items-center gap-4 flex-wrap">
                  {data.correo && <span className="flex items-center gap-2"><Mail size={14} className="text-brand-600" />{data.correo}</span>}
                  {data.celular && <span className="flex items-center gap-2"><Phone size={14} className="text-brand-600" />{data.celular}</span>}
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* ── Grilla de detalle ────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Columna izquierda */}
        <div className="space-y-6">
          <Card>
            <SectionTitle>Datos personales</SectionTitle>
            <dl>
              <DataRow label="RFC" value={data.rfc} mono />
              <DataRow label="CURP" value={data.curp} mono />
              <DataRow label="NSS" value={data.nss} mono />
              <DataRow label="Nacimiento" value={fmtFecha(data.fecha_nacimiento)} />
              <DataRow label="Sexo" value={data.sexo} />
              <DataRow label="Estado civil" value={data.estado_civil} />
              <DataRow label="Nacionalidad" value={data.nacionalidad} />
              <DataRow label="Edad" value={data.edad} />
              <DataRow label="Domicilio" value={data.domicilio} />
            </dl>
          </Card>

          <Card>
            <SectionTitle>Datos médicos</SectionTitle>
            <dl>
              <DataRow label="Sangre" value={data.tipo_sangre} tone="danger" />
              <DataRow label="Alergias" value={data.alergias} />
              <DataRow label="Enfermedades" value={data.enfermedades_cronicas} />
              <DataRow label="Estatura" value={data.estatura} />
              <DataRow label="Usa lentes" value={data.lentes} />
              <DataRow label="Licencia" value={data.licencia_conducir} />
            </dl>
          </Card>

          <Card>
            <SectionTitle>Contacto de emergencia</SectionTitle>
            <dl>
              <DataRow label="Contacto" value={data.contacto_emergencia} />
              <DataRow label="Parentesco" value={data.parentesco_contacto} />
              <DataRow label="Teléfono" value={data.numero_contacto_emerg} />
            </dl>
          </Card>
        </div>

        {/* Columna derecha */}
        <div className="space-y-6">
          <Card>
            <SectionTitle>Datos laborales</SectionTitle>
            <dl>
              <DataRow label="Tipo movimiento" value={data.tipo_mov} />
              <DataRow label="Tipo contrato" value={data.tipo_cont} />
              <DataRow label="Jornada" value={data.tipo_jornada} />
              <DataRow label="Fecha ingreso" value={fmtFecha(data.fecha_ingreso)} />
              <DataRow label="Inicio" value={fmtFecha(data.inicio)} />
              <DataRow label="Término prueba" value={fmtFecha(data.termino_prueba)} />
              <DataRow label="Descripción" value={data.descripcion_servicio} />
            </dl>
          </Card>

          <Card>
            <SectionTitle>Finanzas</SectionTitle>
            <dl>
              <DataRow label="Tipo nómina" value={data.tipo_nomina} tone={data.tipo_nomina ? nominaTone(data.tipo_nomina) : undefined} />
              <DataRow label="Salario/sem" value={fmtMoney(data.salario_real_pactado_x_sem)} mono />
              <DataRow label="Tipo pago" value={data.tipo_pago} />
              <DataRow label="SB" value={fmtMoney(data.sb)} mono />
              <DataRow label="SDI" value={fmtMoney(data.sdi)} mono />
              <DataRow label="Letra/categ." value={data.letra} />
              <DataRow label="Hrs extra" value={fmtMoney(data.hr_extra)} mono />
              <DataRow label="Infonavit" value={fmtMoney(data.infonavit)} mono />
              <DataRow label="Caja ahorro" value={fmtMoney(data.caja_ahorro)} mono />
              <DataRow label="Viáticos" value={fmtMoney(data.viaticos)} mono />
              <DataRow label="Día festivo" value={fmtMoney(data.pago_dia_festivo)} mono />
              <DataRow label="Pago efectivo" value={fmtMoney(data.pagos_efectivo)} mono />
              <DataRow label="Folio IDSE" value={data.folio_mov_idse} mono />
            </dl>
          </Card>

          <Card>
            <SectionTitle>Operación</SectionTitle>
            <dl>
              <DataRow label="Ubicación" value={data.ubicacion_actual} />
              <DataRow label="Estado" value={data.ubicacion_estado} />
              <DataRow label="No. proyecto" value={data.no_proyecto} mono />
              <DataRow label="Coordinador" value={data.coordinadores_actuales} />
              <DataRow label="Observaciones" value={data.observaciones} />
            </dl>
          </Card>
        </div>
      </div>

      {/* ── Credenciales ─────────────────────────────────────────────── */}
      <Card className="mt-6">
        <CardHeader title="Credenciales de planta" description={data.credenciales.length === 0 ? 'Ninguna registrada.' : `${data.credenciales.length} credencial(es).`} />
        {data.credenciales.length === 0 ? (
          <EmptyState icon={IdCard} title="Sin credenciales" description="No hay credenciales registradas para este empleado." />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.credenciales.map((c, i) => {
              const today = new Date().toISOString().slice(0, 10)
              const vencida = c.fecha_caducidad && c.fecha_caducidad < today
              return (
                <div
                  key={i}
                  className={`rounded-lg border p-3 ${
                    vencida
                      ? 'border-red-200 bg-red-50/40 dark:border-red-900/50 dark:bg-red-950/10'
                      : 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-950/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-ink-900 dark:text-ink-100">{c.planta}</div>
                    <Badge tone={vencida ? 'danger' : 'success'} dot>
                      {vencida ? 'Caducada' : 'Vigente'}
                    </Badge>
                  </div>
                  <div className="mt-1 font-mono text-xs text-ink-700 dark:text-ink-300">{c.credencial_id}</div>
                  {c.fecha_caducidad && (
                    <div className="mt-1 text-xs text-ink-500 dark:text-ink-400">
                      Caducidad: {fmtFecha(c.fecha_caducidad)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* ── Documentos ──────────────────────────────────────────────── */}
      <Card className="mt-6">
        <CardHeader title="Documentos del expediente" description={`${data.documentos.length} archivo(s) subido(s).`} />
        {data.documentos.length === 0 ? (
          <EmptyState icon={FileText} title="Sin documentos" description="Aún no hay documentos en el expediente." />
        ) : (
          <ul className="divide-y divide-ink-200 dark:divide-ink-800">
            {data.documentos.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-3">
                <button
                  type="button"
                  onClick={() => setViewerDoc(d)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left rounded-md -mx-2 px-2 py-1 hover:bg-ink-50 dark:hover:bg-ink-900/40 transition-colors focus-ring"
                  title="Ver documento"
                >
                  <div className="h-9 w-9 rounded-lg bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 flex items-center justify-center flex-shrink-0">
                    <FileText size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-ink-900 dark:text-ink-100 truncate">{d.nombre_archivo}</p>
                    <p className="text-xs text-ink-500 dark:text-ink-400">
                      {d.tipo_documento || 'Sin tipo'}
                      {d.fecha_inicio && ` · ${fmtFecha(d.fecha_inicio)}`}
                      {d.fecha_fin && ` → ${fmtFecha(d.fecha_fin)}`}
                    </p>
                  </div>
                </button>
                <div className="flex gap-1 flex-shrink-0">
                  <Button size="sm" variant="secondary" leftIcon={<Eye size={13} />} onClick={() => setViewerDoc(d)}>
                    Ver
                  </Button>
                  <Button size="sm" variant="ghost" leftIcon={<Download size={13} />} onClick={() => descargarDocumento(d.id, d.nombre_archivo)} title="Descargar">
                    <span className="sr-only">Descargar</span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={onConfirm}
        loading={busy}
        title={confirmAction === 'baja' ? 'Dar de baja' : 'Reactivar empleado'}
        description={confirmAction === 'baja'
          ? 'El empleado pasará a la lista de bajas. ¿Continuar?'
          : 'El empleado volverá a las operaciones activas. ¿Continuar?'}
        confirmLabel={confirmAction === 'baja' ? 'Dar de baja' : 'Reactivar'}
        tone={confirmAction === 'baja' ? 'danger' : 'warning'}
      />

      <ImageViewer
        open={Boolean(viewerDoc)}
        onClose={() => setViewerDoc(null)}
        authPath={viewerDoc ? `/trabajadores/documentos/${viewerDoc.id}` : null}
        filename={viewerDoc?.nombre_archivo || ''}
        alt={viewerDoc?.nombre_archivo || 'Documento'}
      />
    </>
  )
}
