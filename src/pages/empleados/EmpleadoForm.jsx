import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Save, Download, IdCard, User, Briefcase, HeartPulse, DollarSign,
  Files, AlertCircle,
} from 'lucide-react'
import {
  PageHeader, Button, Input, Textarea, Select, Card, CardHeader, Skeleton, Badge, InfoTip,
} from '../../components/ui'
import {
  crearTrabajador, actualizarTrabajador, obtenerTrabajador, exportarEmpleado,
} from '../../api/trabajadores'
import CredencialesEditor from '../../components/empleados/CredencialesEditor'
import DocumentosManager from '../../components/empleados/DocumentosManager'
import FotoUploader from '../../components/empleados/FotoUploader'
import { useAuth } from '../../context/AuthContext'
import useUnsavedChanges, { confirmIfDirty } from '../../hooks/useUnsavedChanges'

const TABS = [
  { id: 'datos',    label: 'Datos personales', icon: User },
  { id: 'laboral',  label: 'Laboral',          icon: Briefcase },
  { id: 'medico',   label: 'Médico',           icon: HeartPulse },
  { id: 'finanzas', label: 'Finanzas',         icon: DollarSign },
  { id: 'creds',    label: 'Credenciales',     icon: IdCard },
  { id: 'docs',     label: 'Documentos',       icon: Files },
]

const EMPTY = {
  no_empleado: '', nombre: '', nombre_apellidos: '',
  // Laborales
  tipo_mov: '', tipo_cont: '', area: '', puesto: '', tipo_jornada: '',
  fecha_ingreso: '', descripcion_servicio: '', inicio: '', termino_prueba: '',
  fecha_baja: '',
  // Generales
  curp: '', rfc: '', nss: '', fecha_nacimiento: '', sexo: '', estado_civil: '',
  nacionalidad: '', edad: '', domicilio: '',
  // Contacto
  correo: '', celular: '',
  // Médicos
  tipo_sangre: '', alergias: '', enfermedades_cronicas: '',
  contacto_emergencia: '', parentesco_contacto: '', numero_contacto_emerg: '',
  lentes: '', licencia_conducir: '', estatura: '',
  // Finanzas
  salario_real_pactado_x_sem: '', tipo_pago: '', tipo_nomina: '',
  sb: '', sdi: '', letra: '', hr_extra: '', infonavit: '', ajuste_inbursa: '',
  caja_ahorro: '', viaticos: '', pago_dia_festivo: '', pagos_efectivo: '',
  folio_mov_idse: '',
  // Operación
  ubicacion_estado: '', observaciones: '',
}

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-brand-600 text-brand-700 dark:text-brand-300'
          : 'border-transparent text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200'
      }`}
    >
      <Icon size={15} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

function Section({ title, info, children }) {
  return (
    <div className="rounded-xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-5">
      {title && (
        <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-700 dark:text-ink-300 mb-4">
          {title}
          {info && <InfoTip text={info} />}
        </h3>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  )
}

export default function EmpleadoForm({ modo }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const editando = modo === 'editar'

  const [form, setForm] = useState(EMPTY)
  const [credenciales, setCredenciales] = useState([])
  const [documentos, setDocumentos] = useState([])
  const [foto, setFoto] = useState(null) // File en modo nuevo
  const [hasFoto, setHasFoto] = useState(false)
  const [activeTab, setActiveTab] = useState('datos')
  const [loading, setLoading] = useState(editando)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [errors, setErrors] = useState({}) // por-campo
  const [globalError, setGlobalError] = useState('')

  // Detección de cambios sin guardar. `baselineRef` guarda el snapshot "limpio"
  // (EMPTY al crear; los datos cargados al editar) y lo comparamos contra el
  // estado actual. Los documentos no cuentan: se suben/borran al instante, no
  // dependen del botón Guardar.
  const baselineRef = useRef(editando ? null : JSON.stringify({ form: EMPTY, credenciales: [] }))
  const isDirty = baselineRef.current != null
    && !saving
    && (JSON.stringify({ form, credenciales }) !== baselineRef.current || Boolean(foto))
  useUnsavedChanges(isDirty)

  useEffect(() => {
    if (!editando) return
    let cancelled = false
    setLoading(true)
    obtenerTrabajador(id)
      .then((data) => {
        if (cancelled) return
        // copiar solo las claves declaradas en EMPTY
        const next = {}
        Object.keys(EMPTY).forEach((k) => { next[k] = data[k] ?? '' })
        setForm(next)
        setCredenciales(data.credenciales || [])
        setDocumentos(data.documentos || [])
        setHasFoto(Boolean(data.foto_perfil))
        // Baseline = datos recién cargados → el form arranca "limpio".
        baselineRef.current = JSON.stringify({ form: next, credenciales: data.credenciales || [] })
      })
      .catch((err) => {
        const msg = err.response?.data?.error || 'No se pudo cargar el empleado'
        toast.error(msg)
        if (err.response?.status === 404) navigate('/empleados')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id, editando, navigate])

  const onField = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }))
  const onFieldUpper = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value.toUpperCase() }))

  const nombreCompleto = useMemo(() => {
    return (form.nombre || '') + (form.nombre_apellidos ? ' ' + form.nombre_apellidos : '')
  }, [form.nombre, form.nombre_apellidos])

  const validateRequired = () => {
    const e = {}
    if (!form.no_empleado?.trim()) e.no_empleado = 'Obligatorio'
    if (!form.nombre?.trim()) e.nombre = 'Obligatorio'
    setErrors(e)
    if (Object.keys(e).length) setActiveTab('datos')
    return Object.keys(e).length === 0
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setGlobalError('')
    if (!validateRequired()) return
    setSaving(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, v ?? ''))
      fd.append('credenciales_json', JSON.stringify(credenciales))
      if (foto) fd.append('foto_perfil', foto)

      const res = editando
        ? await actualizarTrabajador(id, fd)
        : await crearTrabajador(fd)

      if (res.warnings?.length) {
        res.warnings.forEach((w) => toast(w, { icon: '⚠️' }))
      }
      toast.success(editando ? 'Empleado actualizado' : 'Empleado creado')
      if (!editando) {
        navigate(`/empleados/${res.id}/editar`, { replace: true })
      } else {
        // Guardado OK → el estado actual pasa a ser el nuevo baseline limpio.
        baselineRef.current = JSON.stringify({ form, credenciales })
        setFoto(null)
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al guardar'
      const details = err.response?.data?.details
      setGlobalError(details ? `${msg}: ${details.join(', ')}` : msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const onExport = async () => {
    if (!editando) return
    setExporting(true)
    try {
      await exportarEmpleado(id, `${form.no_empleado}_${form.nombre_apellidos || ''}.xlsx`)
    } catch {
      toast.error('Error al exportar')
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit}>
      <PageHeader
        title={editando ? (nombreCompleto || `Empleado #${id}`) : 'Nuevo empleado'}
        description={editando ? `Folio interno: #${form.no_empleado}` : 'Captura los datos del nuevo empleado.'}
        breadcrumb={
          <Link
            to="/empleados"
            onClick={(e) => { if (!confirmIfDirty(isDirty)) e.preventDefault() }}
            className="hover:underline inline-flex items-center gap-1"
          >
            <ArrowLeft size={12} /> Volver a empleados
          </Link>
        }
        actions={
          <div className="flex gap-2">
            {editando && isAdmin && (
              <Button type="button" variant="secondary" leftIcon={<Download size={14} />} loading={exporting} onClick={onExport}>
                Exportar
              </Button>
            )}
            <Button type="submit" variant="primary" leftIcon={<Save size={14} />} loading={saving}>
              {editando ? 'Guardar cambios' : 'Crear empleado'}
            </Button>
          </div>
        }
      />

      {globalError && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{globalError}</span>
        </div>
      )}

      <div className="mb-6 border-b border-ink-200 dark:border-ink-800 overflow-x-auto scrollbar-thin">
        <div className="inline-flex">
          {TABS.map((t) => (
            <TabButton
              key={t.id}
              active={activeTab === t.id}
              onClick={() => setActiveTab(t.id)}
              icon={t.icon}
              label={t.label}
            />
          ))}
        </div>
      </div>

      {/* ── DATOS PERSONALES ───────────────────────────────────────────── */}
      {activeTab === 'datos' && (
        <div className="grid lg:grid-cols-[260px_1fr] gap-6">
          <div className="lg:sticky lg:top-6 self-start rounded-xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-5">
            <FotoUploader
              trabajadorId={editando ? Number(id) : null}
              hasFoto={hasFoto}
              name={nombreCompleto}
              onFileSelected={setFoto}
              onFotoActualizada={() => setHasFoto(true)}
            />
          </div>
          <div className="space-y-4">
            <Section title="Identidad" info="No. empleado y Nombre(s) son obligatorios; el resto del expediente puede completarse después. El número de empleado es el folio interno único de la persona.">
              <Input label="No. empleado" required value={form.no_empleado} onChange={onField('no_empleado')} error={errors.no_empleado} />
              <Input label="Nombre(s)" required value={form.nombre} onChange={onField('nombre')} error={errors.nombre} />
              <Input label="Apellidos" value={form.nombre_apellidos} onChange={onField('nombre_apellidos')} />
            </Section>
            <Section title="Generales">
              <Input label="CURP" value={form.curp} onChange={onFieldUpper('curp')} maxLength={18} />
              <Input label="RFC"  value={form.rfc}  onChange={onFieldUpper('rfc')}  maxLength={13} />
              <Input label="NSS"  value={form.nss}  onChange={onField('nss')}       maxLength={20} />
              <Input label="Fecha nacimiento" type="date" value={form.fecha_nacimiento} onChange={onField('fecha_nacimiento')} />
              <Select label="Sexo" value={form.sexo} onChange={onField('sexo')}>
                <option value="">—</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
                <option value="X">Otro</option>
              </Select>
              <Select label="Estado civil" value={form.estado_civil} onChange={onField('estado_civil')}>
                <option value="">—</option>
                <option>Soltero(a)</option><option>Casado(a)</option><option>Divorciado(a)</option>
                <option>Viudo(a)</option><option>Unión libre</option>
              </Select>
              <Input label="Nacionalidad" value={form.nacionalidad} onChange={onField('nacionalidad')} />
              <Input label="Edad" type="number" min={0} value={form.edad} onChange={onField('edad')} />
              <Textarea wrapperClassName="sm:col-span-2 lg:col-span-3" label="Domicilio" rows={2} value={form.domicilio} onChange={onField('domicilio')} />
            </Section>
            <Section title="Contacto">
              <Input label="Correo electrónico" type="email" value={form.correo} onChange={onField('correo')} />
              <Input label="Celular" value={form.celular} onChange={onField('celular')} maxLength={20} />
            </Section>
          </div>
        </div>
      )}

      {/* ── LABORAL ────────────────────────────────────────────────────── */}
      {activeTab === 'laboral' && (
        <div className="space-y-4">
          <Section title="Contratación">
            <Input label="Tipo movimiento" value={form.tipo_mov} onChange={onField('tipo_mov')} maxLength={100} />
            <Input label="Tipo contrato" value={form.tipo_cont} onChange={onField('tipo_cont')} maxLength={100} />
            <Input label="Área" value={form.area} onChange={onField('area')} maxLength={150} />
            <Input label="Puesto" value={form.puesto} onChange={onField('puesto')} maxLength={150} />
            <Input label="Tipo jornada" value={form.tipo_jornada} onChange={onField('tipo_jornada')} maxLength={100} />
            <Input label="Fecha de ingreso" type="date" value={form.fecha_ingreso} onChange={onField('fecha_ingreso')} />
            <Input label="Inicio" type="date" value={form.inicio} onChange={onField('inicio')} />
            <Input label="Término período de prueba" type="date" value={form.termino_prueba} onChange={onField('termino_prueba')} />
            {editando && (
              <Input label="Fecha baja" type="date" value={form.fecha_baja} onChange={onField('fecha_baja')} disabled={!isAdmin} />
            )}
            <Textarea wrapperClassName="sm:col-span-2 lg:col-span-3" label="Descripción del servicio" rows={2}
              value={form.descripcion_servicio} onChange={onField('descripcion_servicio')} />
          </Section>
          <Section title="Operación">
            <Input label="Estado de ubicación" value={form.ubicacion_estado} onChange={onField('ubicacion_estado')} maxLength={100} />
            <Textarea wrapperClassName="sm:col-span-2 lg:col-span-3" label="Observaciones" rows={3}
              value={form.observaciones} onChange={onField('observaciones')} />
          </Section>
        </div>
      )}

      {/* ── MÉDICO ─────────────────────────────────────────────────────── */}
      {activeTab === 'medico' && (
        <div className="space-y-4">
          <Section title="Datos médicos">
            <Select label="Tipo sangre" value={form.tipo_sangre} onChange={onField('tipo_sangre')}>
              <option value="">—</option>
              <option>O+</option><option>O-</option>
              <option>A+</option><option>A-</option>
              <option>B+</option><option>B-</option>
              <option>AB+</option><option>AB-</option>
            </Select>
            <Select label="Usa lentes" value={form.lentes} onChange={onField('lentes')}>
              <option value="">—</option><option>Si</option><option>No</option>
            </Select>
            <Input label="Estatura" value={form.estatura} onChange={onField('estatura')} maxLength={20} />
            <Input label="Licencia conducir" value={form.licencia_conducir} onChange={onField('licencia_conducir')} maxLength={50} />
            <Textarea wrapperClassName="sm:col-span-2 lg:col-span-3" label="Alergias" rows={2} value={form.alergias} onChange={onField('alergias')} />
            <Textarea wrapperClassName="sm:col-span-2 lg:col-span-3" label="Enfermedades crónicas" rows={2}
              value={form.enfermedades_cronicas} onChange={onField('enfermedades_cronicas')} />
          </Section>
          <Section title="Contacto de emergencia">
            <Input label="Nombre" value={form.contacto_emergencia} onChange={onField('contacto_emergencia')} maxLength={200} />
            <Input label="Parentesco" value={form.parentesco_contacto} onChange={onField('parentesco_contacto')} maxLength={100} />
            <Input label="Teléfono" value={form.numero_contacto_emerg} onChange={onField('numero_contacto_emerg')} maxLength={20} />
          </Section>
        </div>
      )}

      {/* ── FINANZAS ───────────────────────────────────────────────────── */}
      {activeTab === 'finanzas' && (
        <div className="space-y-4">
          <Section title="Sueldo" info="Lo que el empleado recibe realmente por semana es el salario pactado. Los campos SB, SDI y folio IDSE son los valores oficiales que reporta el IMSS y pueden diferir del pago real.">
            <Input
              label={<span className="inline-flex items-center gap-1">Salario real pactado por semana <InfoTip text="Monto neto que el empleado cobra cada semana. Es la base de la prenómina, independiente del salario que se reporta al IMSS." /></span>}
              type="number" min={0} step="0.01"
              value={form.salario_real_pactado_x_sem} onChange={onField('salario_real_pactado_x_sem')} />
            <Select label="Tipo de pago" value={form.tipo_pago} onChange={onField('tipo_pago')}>
              <option value="">—</option>
              <option>EFECTIVO</option>
              <option>TRANSFERENCIA</option>
              <option>MIXTO</option>
            </Select>
            <Select
              label={<span className="inline-flex items-center gap-1">Tipo de nómina <InfoTip text="Define cómo se calcula el pago: Semanal (sueldo fijo), Por hora (según horas reportadas) o Cuadrado (monto cerrado por proyecto)." /></span>}
              value={form.tipo_nomina} onChange={onField('tipo_nomina')}>
              <option value="">—</option><option>Semanal</option><option>Por hora</option><option>Cuadrado</option>
            </Select>
            <Input
              label={<span className="inline-flex items-center gap-1">Sueldo base (SB) <InfoTip text="Salario base de cotización registrado ante el IMSS. Suele ser menor al salario real pactado." /></span>}
              type="number" step="0.01" value={form.sb} onChange={onField('sb')} />
            <Input
              label={<span className="inline-flex items-center gap-1">SDI <InfoTip text="Salario Diario Integrado: base diaria que usa el IMSS para cuotas e indemnizaciones (incluye prestaciones)." /></span>}
              type="number" step="0.01" value={form.sdi} onChange={onField('sdi')} />
            <Input label="Letra/Categoría" value={form.letra} onChange={onField('letra')} maxLength={100} />
            <Input
              label={<span className="inline-flex items-center gap-1">Folio Mov IDSE <InfoTip text="Folio del movimiento de alta/baja/modificación presentado en el sistema IDSE del IMSS." /></span>}
              value={form.folio_mov_idse} onChange={onField('folio_mov_idse')} maxLength={100} />
          </Section>
          <Section title="Adicionales y descuentos">
            <Input label="Horas extra (monto)" type="number" step="0.01" value={form.hr_extra} onChange={onField('hr_extra')} />
            <Input label="Infonavit" type="number" step="0.01" value={form.infonavit} onChange={onField('infonavit')} />
            <Input label="Ajuste Inbursa" type="number" step="0.01" value={form.ajuste_inbursa} onChange={onField('ajuste_inbursa')} />
            <Input label="Caja de ahorro" type="number" step="0.01" value={form.caja_ahorro} onChange={onField('caja_ahorro')} />
            <Input label="Viáticos (default)" type="number" step="0.01" value={form.viaticos} onChange={onField('viaticos')} />
            <Input label="Pago día festivo" type="number" step="0.01" value={form.pago_dia_festivo} onChange={onField('pago_dia_festivo')} />
            <Input label="Pagos efectivo" type="number" step="0.01" value={form.pagos_efectivo} onChange={onField('pagos_efectivo')} />
          </Section>
        </div>
      )}

      {/* ── CREDENCIALES ───────────────────────────────────────────────── */}
      {activeTab === 'creds' && (
        <Card>
          <CardHeader title="Credenciales de planta" description="Las credenciales caducadas se marcan en rojo." />
          <CredencialesEditor credenciales={credenciales} onChange={setCredenciales} />
          <p className="mt-4 text-xs text-ink-500 dark:text-ink-400">
            Los cambios se persisten al guardar el formulario.
          </p>
        </Card>
      )}

      {/* ── DOCUMENTOS ─────────────────────────────────────────────────── */}
      {activeTab === 'docs' && (
        <Card>
          <CardHeader title="Documentos" description="Subida y descarga directa (no requiere guardar el formulario)." />
          <DocumentosManager
            trabajadorId={editando ? Number(id) : null}
            documentos={documentos}
            onChange={setDocumentos}
          />
        </Card>
      )}
    </form>
  )
}
