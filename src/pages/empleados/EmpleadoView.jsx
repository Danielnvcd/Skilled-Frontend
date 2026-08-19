import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Pencil, Download, Briefcase, Hash, Mail, Phone,
  IdCard, FileText, AlertCircle, MapPin, User, UserMinus, UserCheck, Eye,
  Check, CheckCircle2, Cake, Trophy, Calendar, Sparkles, QrCode, ChevronRight,
  ChevronLeft,
} from 'lucide-react'
import {
  PageHeader, Button, Card, CardHeader, Skeleton, Badge, EmptyState, ConfirmDialog, ImageViewer, InfoTip,
} from '../../components/ui'
import AvatarFoto from '../../components/empleados/AvatarFoto'
import EmpleadoTimeline from '../../components/empleados/EmpleadoTimeline'
import NotasPanel from '../../components/empleados/NotasPanel'
import CredencialPreviewModal from '../../components/empleados/CredencialPreviewModal'
import CredencialCard from '../../components/empleados/CredencialCard'
import {
  obtenerTrabajador, exportarEmpleado, descargarDocumento,
  darBajaTrabajador, reactivarTrabajador,
} from '../../api/trabajadores'
import { useAuth } from '../../context/AuthContext'
import { fmtFechaLarga } from '../../utils/format'

// `fecha_nacimiento`, `fecha_baja` y `fecha_caducidad` son `db.Date`: llegan
// como "AAAA-MM-DD" y el `new Date(iso)` que había aquí las leía como medianoche
// UTC, así que en México se mostraba el día ANTERIOR. `fmtFechaLarga` lo ancla
// al huso local y ya devuelve '—' cuando no hay valor.
const fmtFecha = fmtFechaLarga

function fmtMoney(s) {
  if (!s) return null
  const n = parseFloat(s)
  if (Number.isNaN(n)) return null
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)
}

// ── Estado del expediente ───────────────────────────────────────────────────
// Define la "completitud" del empleado: lista de campos que la oficina suele
// pedir al alta. Cada uno con su check booleano. Visualizado como progress +
// checklist con sub-grupos.

function buildExpedienteChecklist(data) {
  const tieneCredencialVigente = (data.credenciales || []).some((c) => {
    if (!c.fecha_caducidad) return false
    return c.fecha_caducidad >= new Date().toISOString().slice(0, 10)
  })
  const tieneDoc = (re) => (data.documentos || []).some((d) => re.test(d.tipo_documento || d.nombre_archivo || ''))

  return [
    {
      group: 'Identidad',
      items: [
        { key: 'foto', label: 'Foto de perfil', done: Boolean(data.foto_perfil) },
        { key: 'rfc', label: 'RFC', done: Boolean(data.rfc) },
        { key: 'curp', label: 'CURP', done: Boolean(data.curp) },
        { key: 'nss', label: 'NSS', done: Boolean(data.nss) },
      ],
    },
    {
      group: 'Contacto',
      items: [
        { key: 'domicilio', label: 'Domicilio', done: Boolean(data.domicilio) },
        { key: 'celular', label: 'Celular o correo', done: Boolean(data.celular || data.correo) },
        { key: 'emergencia', label: 'Contacto de emergencia', done: Boolean(data.contacto_emergencia && data.numero_contacto_emerg) },
      ],
    },
    {
      group: 'Laboral',
      items: [
        { key: 'fechaIngreso', label: 'Fecha de ingreso', done: Boolean(data.fecha_ingreso) },
        { key: 'tipoNomina', label: 'Tipo de nómina', done: Boolean(data.tipo_nomina) },
        { key: 'salario', label: 'Salario pactado', done: Boolean(data.salario_real_pactado_x_sem) },
        { key: 'credencial', label: 'Credencial vigente', done: tieneCredencialVigente },
      ],
    },
    {
      group: 'Documentos',
      items: [
        { key: 'ine', label: 'INE', done: tieneDoc(/ine|identifica|credencial.*elector/i) },
        { key: 'compDom', label: 'Comprobante de domicilio', done: tieneDoc(/comprob.*domicilio|cfe|recibo.*luz|agua|telmex/i) },
        { key: 'contrato', label: 'Contrato firmado', done: tieneDoc(/contrato/i) },
      ],
    },
  ]
}

function expedienteScore(checklist) {
  let total = 0
  let done = 0
  for (const g of checklist) {
    for (const it of g.items) {
      total += 1
      if (it.done) done += 1
    }
  }
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) }
}

// ── Alertas próximas ────────────────────────────────────────────────────────
// Cumpleaños, aniversarios, vencimientos cercanos. Devuelve array de objetos
// { tone, icon, message } — el render decide el layout.

function buildAlertasProximas(data) {
  const out = []
  const today = new Date()
  const todayIso = today.toISOString().slice(0, 10)

  // Cumpleaños este mes / esta semana
  if (data.fecha_nacimiento) {
    try {
      const [, m, d] = data.fecha_nacimiento.split('-').map(Number)
      const cumple = new Date(today.getFullYear(), m - 1, d)
      const diff = Math.ceil((cumple - today) / 86400000)
      if (diff >= 0 && diff <= 30) {
        out.push({
          tone: diff <= 7 ? 'success' : 'info',
          icon: Cake,
          message: diff === 0
            ? '¡Cumple años hoy!'
            : diff === 1
              ? 'Cumple años mañana'
              : `Cumple años en ${diff} días (${cumple.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })})`,
        })
      }
    } catch {}
  }

  // Aniversario laboral este mes
  if (data.fecha_ingreso) {
    try {
      const ing = new Date(data.fecha_ingreso)
      const aniv = new Date(today.getFullYear(), ing.getMonth(), ing.getDate())
      const diff = Math.ceil((aniv - today) / 86400000)
      const years = today.getFullYear() - ing.getFullYear() + (diff < 0 ? 0 : 0)
      const realYears = aniv >= today
        ? today.getFullYear() - ing.getFullYear()
        : today.getFullYear() - ing.getFullYear()
      if (diff >= 0 && diff <= 30 && realYears > 0) {
        const label = realYears === 1 ? '1 año' : `${realYears} años`
        out.push({
          tone: 'info',
          icon: Trophy,
          message: diff === 0
            ? `¡Aniversario laboral hoy! Cumple ${label} en la empresa`
            : `Aniversario laboral en ${diff} días (${label})`,
        })
      }
    } catch {}
  }

  // Término de prueba próximo
  if (data.termino_prueba) {
    try {
      const fin = new Date(data.termino_prueba)
      const diff = Math.ceil((fin - today) / 86400000)
      if (diff >= 0 && diff <= 15) {
        out.push({
          tone: 'warning',
          icon: Calendar,
          message: diff === 0
            ? 'Termina periodo de prueba hoy'
            : `Periodo de prueba termina en ${diff} días`,
        })
      }
    } catch {}
  }

  // Credenciales vencidas o por vencer
  for (const c of data.credenciales || []) {
    if (!c.fecha_caducidad) continue
    try {
      const cad = new Date(c.fecha_caducidad + 'T00:00:00')
      const diff = Math.ceil((cad - today) / 86400000)
      if (diff < 0) {
        out.push({
          tone: 'danger',
          icon: AlertCircle,
          message: `Credencial ${c.planta || ''} vencida (${fmtFecha(c.fecha_caducidad)})`,
        })
      } else if (diff <= 30) {
        out.push({
          tone: 'warning',
          icon: AlertCircle,
          message: `Credencial ${c.planta || ''} vence en ${diff} días`,
        })
      }
    } catch {}
  }

  // Documentos por vencer
  for (const doc of data.documentos || []) {
    if (!doc.fecha_fin) continue
    try {
      const fin = new Date(doc.fecha_fin + 'T00:00:00')
      const diff = Math.ceil((fin - today) / 86400000)
      if (diff < 0) {
        out.push({
          tone: 'danger',
          icon: FileText,
          message: `Documento ${doc.tipo_documento || doc.nombre_archivo} vencido`,
        })
      } else if (diff <= 30) {
        out.push({
          tone: 'warning',
          icon: FileText,
          message: `Documento ${doc.tipo_documento || doc.nombre_archivo} vence en ${diff} días`,
        })
      }
    } catch {}
  }

  return out
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

function SectionTitle({ children, info }) {
  return (
    <h3 className="inline-flex items-center gap-1.5 w-full text-sm font-semibold text-ink-800 dark:text-ink-200 mb-3 pb-2 border-b border-ink-200 dark:border-ink-800">
      {children}
      {info && <InfoTip text={info} />}
    </h3>
  )
}

export default function EmpleadoView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { isAdmin } = useAuth()

  // Pager ‹ x/y ›: la lista pasa los ids visibles vía location.state al abrir
  // la ficha; con eso se puede hojear empleado por empleado sin volver atrás.
  // Si se entró por URL directa (sin state), el pager simplemente no se pinta.
  const pagerIds = location.state?.pager?.ids
  const pagerIdx = Array.isArray(pagerIds) ? pagerIds.indexOf(Number(id)) : -1
  const irA = (offset) => {
    const destino = pagerIds?.[pagerIdx + offset]
    if (destino != null) {
      navigate(`/empleados/${destino}`, { state: { pager: { ids: pagerIds } } })
    }
  }
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null) // 'baja' | 'reactivar'
  const [busy, setBusy] = useState(false)
  const [viewerDoc, setViewerDoc] = useState(null)
  const [credencialOpen, setCredencialOpen] = useState(false)

  const checklist = useMemo(() => (data ? buildExpedienteChecklist(data) : []), [data])
  const score = useMemo(() => expedienteScore(checklist), [checklist])
  const alertas = useMemo(() => (data ? buildAlertasProximas(data) : []), [data])

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
        title={
          <span className="inline-flex items-center gap-1.5">
            Ficha del empleado
            <InfoTip text="Vista de solo lectura del expediente. Revisa el porcentaje de completitud, las alertas próximas (cumpleaños, vencimientos), credenciales y documentos. Usa Editar para modificar datos." />
          </span>
        }
        description={`#${data.no_empleado} · ${data.area || 'Sin área'}`}
        breadcrumb={
          <Link to="/empleados" className="hover:underline inline-flex items-center gap-1">
            <ArrowLeft size={12} /> Volver a empleados
          </Link>
        }
        actions={
          <div className="flex gap-2 flex-wrap items-center">
            {pagerIdx >= 0 && pagerIds.length > 1 && (
              <div className="inline-flex items-center gap-1 mr-1 rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-1 py-0.5">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  title="Empleado anterior"
                  disabled={pagerIdx <= 0}
                  onClick={() => irA(-1)}
                >
                  <ChevronLeft size={14} />
                </Button>
                <span className="text-xs font-medium tabular-nums text-ink-500 dark:text-ink-400 px-1 select-none">
                  {pagerIdx + 1} / {pagerIds.length}
                </span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  title="Empleado siguiente"
                  disabled={pagerIdx >= pagerIds.length - 1}
                  onClick={() => irA(1)}
                >
                  <ChevronRight size={14} />
                </Button>
              </div>
            )}
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
          <div className="flex flex-col gap-2 sm:flex-shrink-0">
            <Button size="sm" variant="secondary" leftIcon={<IdCard size={14} />} onClick={() => setCredencialOpen(true)}>
              Ver credencial
            </Button>
          </div>
        </div>
      </Card>

      {/* ── Alertas próximas (cumpleaños, aniversarios, vencimientos) ── */}
      {alertas.length > 0 && (
        <AlertasBanner alertas={alertas} className="mb-6" />
      )}

      {/* ── Estado del expediente (progress + checklist) ────────────── */}
      <ExpedienteCard
        checklist={checklist}
        score={score}
        className="mb-6"
        onEditar={() => navigate(`/empleados/${id}/editar`)}
      />


      {/* ── Grilla de detalle ────────────────────────────────────────────
          Distribuida con CSS columns (multi-column layout): el navegador
          balancea automáticamente las cards entre las 2 columnas según su
          altura real. break-inside-avoid impide que una card se corte por
          el medio. Resultado: ambas columnas terminan a alturas parecidas
          sin importar cuántos campos tenga cada card.
      */}
      <div className="lg:columns-2 lg:gap-6 [&>*]:mb-6 lg:[&>*]:break-inside-avoid">
        {/* Notas internas (chatter) — visible solo para quien puede ver la
            ficha; se refresca en vivo vía nota:changed. */}
        <NotasPanel trabajadorId={Number(id)} />

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
          <SectionTitle>Compensación</SectionTitle>
          <dl>
            <DataRow label="Tipo nómina" value={data.tipo_nomina} />
            <DataRow label="Salario/sem" value={fmtMoney(data.salario_real_pactado_x_sem)} mono />
            <DataRow label="Tipo pago" value={data.tipo_pago} />
            <DataRow label="Hrs extra" value={fmtMoney(data.hr_extra)} mono />
            <DataRow label="Viáticos" value={fmtMoney(data.viaticos)} mono />
            <DataRow label="Día festivo" value={fmtMoney(data.pago_dia_festivo)} mono />
            <DataRow label="Pago efectivo" value={fmtMoney(data.pagos_efectivo)} mono />
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

        <Card>
          <SectionTitle info="Valores oficiales reportados al IMSS. SB = sueldo base de cotización; SDI = salario diario integrado; Folio IDSE = folio del movimiento ante el seguro social.">IMSS · Inbursa</SectionTitle>
          <dl>
            <DataRow label="SB" value={fmtMoney(data.sb)} mono />
            <DataRow label="SDI" value={fmtMoney(data.sdi)} mono />
            <DataRow label="Letra/categ." value={data.letra} />
            <DataRow label="Infonavit" value={fmtMoney(data.infonavit)} mono />
            <DataRow label="Caja ahorro" value={fmtMoney(data.caja_ahorro)} mono />
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

      {/* ── Credenciales ─────────────────────────────────────────────── */}
      <Card className="mt-6">
        <CardHeader
          title="Credenciales de planta"
          description={
            data.credenciales.length === 0
              ? 'Ninguna registrada.'
              : `${data.credenciales.length} credencial${data.credenciales.length === 1 ? '' : 'es'} registrada${data.credenciales.length === 1 ? '' : 's'}.`
          }
        />
        {data.credenciales.length === 0 ? (
          <EmptyState icon={IdCard} title="Sin credenciales" description="No hay credenciales registradas para este empleado." />
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.credenciales.map((c, i) => (
              <CredencialCard key={i} credencial={c} noEmpleado={data.no_empleado} />
            ))}
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

      {/* ── Timeline (eventos cronológicos del trabajador) ───────────── */}
      <div className="mt-6">
        <EmpleadoTimeline trabajadorId={Number(id)} />
      </div>

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

      <CredencialPreviewModal
        open={credencialOpen}
        onClose={() => setCredencialOpen(false)}
        trabajador={{
          ...data,
          nombre_completo: nombreCompleto,
        }}
      />
    </>
  )
}

// ── Componentes auxiliares ──────────────────────────────────────────────────

function ExpedienteCard({ checklist, score, onEditar, className = '' }) {
  const tone = score.pct === 100 ? 'success' : score.pct >= 75 ? 'info' : score.pct >= 50 ? 'warning' : 'danger'
  const barClass = {
    success: 'bg-emerald-500',
    info: 'bg-sky-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
  }[tone]
  const ringClass = {
    success: 'ring-emerald-200 dark:ring-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-900/10',
    info: 'ring-sky-200 dark:ring-sky-800/60 bg-sky-50/50 dark:bg-sky-900/10',
    warning: 'ring-amber-200 dark:ring-amber-800/60 bg-amber-50/50 dark:bg-amber-900/10',
    danger: 'ring-red-200 dark:ring-red-800/60 bg-red-50/50 dark:bg-red-900/10',
  }[tone]
  return (
    <Card className={className}>
      <div className={`flex items-center gap-4 p-4 rounded-lg ring-1 ${ringClass} mb-5`}>
        <div className="relative h-14 w-14 flex-shrink-0">
          <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
            <circle cx="18" cy="18" r="16" fill="none" className="stroke-ink-200 dark:stroke-ink-700" strokeWidth="3" />
            <circle
              cx="18"
              cy="18"
              r="16"
              fill="none"
              className={
                tone === 'success' ? 'stroke-emerald-500'
                : tone === 'info' ? 'stroke-sky-500'
                : tone === 'warning' ? 'stroke-amber-500'
                : 'stroke-red-500'
              }
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${(score.pct / 100) * 100} 100`}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums text-ink-900 dark:text-ink-100">
            {score.pct}%
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">
            Expediente {score.pct === 100 ? 'completo' : 'en progreso'}
          </p>
          <p className="text-xs text-ink-600 dark:text-ink-400 mt-0.5">
            {score.done} de {score.total} elementos completados
            {score.pct < 100 && ` · ${score.total - score.done} pendiente${score.total - score.done === 1 ? '' : 's'}`}
          </p>
          <div className="mt-2 h-1.5 rounded-full bg-ink-200 dark:bg-ink-800 overflow-hidden">
            <div
              className={`h-full ${barClass} transition-all`}
              style={{ width: `${score.pct}%` }}
            />
          </div>
        </div>
        {score.pct < 100 && onEditar && (
          <Button size="sm" variant="secondary" leftIcon={<Pencil size={13} />} onClick={onEditar}>
            Completar
          </Button>
        )}
        {score.pct === 100 && (
          <Badge tone="success" leftIcon={<Sparkles size={11} />}>Todo listo</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
        {checklist.map((g) => (
          <div key={g.group}>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 dark:text-ink-400 mb-2">
              {g.group}
            </p>
            <ul className="space-y-1.5">
              {g.items.map((it) => (
                <li key={it.key} className="flex items-center gap-2 text-sm">
                  {it.done ? (
                    <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" strokeWidth={2.25} />
                  ) : (
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-ink-300 dark:border-ink-600 flex-shrink-0" />
                  )}
                  <span className={it.done ? 'text-ink-800 dark:text-ink-200' : 'text-ink-500 dark:text-ink-400'}>
                    {it.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  )
}

function AlertasBanner({ alertas, className = '' }) {
  return (
    <div className={`rounded-lg border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 overflow-hidden ${className}`}>
      <div className="flex items-center gap-2 px-4 py-2 border-b border-ink-100 dark:border-ink-800/80 bg-ink-50/60 dark:bg-ink-800/40">
        <Sparkles size={13} className="text-brand-600 dark:text-brand-400" />
        <span className="text-[11px] uppercase tracking-wider font-semibold text-ink-700 dark:text-ink-300">
          Alertas próximas
        </span>
        <span className="ml-auto text-[11px] text-ink-500 dark:text-ink-400">
          {alertas.length} {alertas.length === 1 ? 'aviso' : 'avisos'}
        </span>
      </div>
      <ul className="divide-y divide-ink-100 dark:divide-ink-800/80">
        {alertas.map((a, i) => (
          <AlertaRow key={i} alerta={a} />
        ))}
      </ul>
    </div>
  )
}

function AlertaRow({ alerta }) {
  const Icon = alerta.icon || Sparkles
  const toneClasses = {
    success: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30',
    info: 'text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-900/30',
    warning: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30',
    danger: 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30',
  }[alerta.tone || 'info']
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <div className={`h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0 ${toneClasses}`}>
        <Icon size={13} strokeWidth={2} />
      </div>
      <p className="text-sm text-ink-800 dark:text-ink-200 truncate flex-1">{alerta.message}</p>
    </li>
  )
}

