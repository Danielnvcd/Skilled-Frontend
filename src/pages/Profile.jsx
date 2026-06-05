import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { extractApiError } from '../utils/apiError'
import { useAuth } from '../context/AuthContext'
import {
  User, Building2, Briefcase, Factory, Phone, ShieldCheck, Save,
  KeyRound, ShieldAlert, ShieldOff, ArrowLeft, Mail, Lock,
  FileKey2, Download, Copy, AlertTriangle, Trash2, RefreshCw, Check,
  Monitor, Smartphone, Tablet, Globe, X, LogOut,
  Sliders, Sun, Moon, MonitorSmartphone, Keyboard, Activity, History,
  CornerDownLeft, Camera, Upload, Pencil,
} from 'lucide-react'
import {
  Button, Card, CardHeader, PageHeader, Badge, Input, Modal,
  PasswordStrengthIndicator, Avatar,
} from '../components/ui'
import UserAvatar from '../components/UserAvatar'
import CamaraCaptureModal from '../components/empleados/CamaraCaptureModal'
import {
  obtenerUsuario, updateProfile, changeOwnPassword,
  setupTwoFa, confirmTwoFa, disableTwoFa,
  getBackupCodesStatus, generateBackupCodes, revokeBackupCodes,
  listSessions, revokeSession, revokeAllSessions,
  getMyActivity, deleteProfilePhoto,
} from '../api/auth'
import { useTheme } from '../context/ThemeContext'
import { getDensity, setDensity } from '../utils/uiPrefs'
import { useResource } from '../hooks/useResource'

export default function Profile() {
  const { id } = useParams()
  const { user: me, updateUser, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const viewingId = id ? Number(id) : null
  const isOwn = !viewingId || viewingId === me?.id
  const readonly = !isOwn

  // Preferencias UI locales (densidad de tablas). Tema viene de ThemeContext.
  const [density, setDensityState] = useState(getDensity)
  const applyDensity = (v) => {
    setDensity(v)
    setDensityState(v)
  }

  // Actividad reciente (mis propias acciones del audit log)
  const [activity, setActivity] = useState(null) // array | null (loading)
  const [activityErr, setActivityErr] = useState(false)

  const [form, setForm] = useState({ full_name: '', area: '', position: '', factory: '', contact_info: '' })
  const [profilePicFile, setProfilePicFile] = useState(null)
  const [profilePicPreview, setProfilePicPreview] = useState(null) // object URL
  const fileInputRef = useRef(null)
  const [saving, setSaving] = useState(false)
  const [deletingPhoto, setDeletingPhoto] = useState(false)
  const [camOpen, setCamOpen] = useState(false)
  // Modo edición de "Información personal". Por defecto los campos se ven
  // como solo-lectura para que el usuario no se confunda creyendo que tiene
  // cambios pendientes. Se entra al modo con el botón "Editar".
  const [editing, setEditing] = useState(false)

  const [pwdChangeOpen, setPwdChangeOpen] = useState(false)
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '', totpCode: '' })
  const [pwdSubmitting, setPwdSubmitting] = useState(false)

  const [passwordOpen, setPasswordOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  const [setupData, setSetupData] = useState(null)
  const [code, setCode] = useState('')
  const [currentTwoFaCode, setCurrentTwoFaCode] = useState('')
  const [confirming, setConfirming] = useState(false)

  // Desactivar 2FA
  const [disableOpen, setDisableOpen] = useState(false)
  const [disableForm, setDisableForm] = useState({ currentPassword: '', code: '' })
  const [disableSubmitting, setDisableSubmitting] = useState(false)

  // Sesiones activas
  const [sessions, setSessions] = useState(null)         // array | null (loading)
  const [sessionsErr, setSessionsErr] = useState(false)
  const [revokingId, setRevokingId] = useState(null)
  const [revokeAllOpen, setRevokeAllOpen] = useState(false)
  const [revokeAllSubmitting, setRevokeAllSubmitting] = useState(false)

  // Backup codes
  const [bcStatus, setBcStatus] = useState(null) // { enabled, remaining, low } | null
  const [bcGenOpen, setBcGenOpen] = useState(false)
  const [bcGenForm, setBcGenForm] = useState({ currentPassword: '', code: '' })
  const [bcGenSubmitting, setBcGenSubmitting] = useState(false)
  const [bcShowOpen, setBcShowOpen] = useState(false)
  const [bcShowCodes, setBcShowCodes] = useState([]) // string[]
  const [bcCopied, setBcCopied] = useState(false)
  const [bcRevokeOpen, setBcRevokeOpen] = useState(false)
  const [bcRevokeForm, setBcRevokeForm] = useState({ currentPassword: '', code: '' })
  const [bcRevokeSubmitting, setBcRevokeSubmitting] = useState(false)

  const {
    data: user,
    error,
    refetch,
  } = useResource(
    ['perfil', { id: isOwn ? 'me' : viewingId }],
    async () => (isOwn ? (await api.get('/auth/me')).data : await obtenerUsuario(viewingId)),
    // Comparte fuente con /usuarios y /directorio: si admin edita este
    // usuario, llega `usuario:changed` y refrescamos automáticamente.
    { staleMs: 30_000, invalidateOn: ['usuario:changed'] },
  )

  useEffect(() => {
    if (error) toast.error(extractApiError(error, 'Error al cargar el perfil'))
  }, [error])

  // Sincroniza el form al cargar el perfil propio. Dep en user.id (no en el
  // objeto completo) para no sobrescribir lo que el usuario esté editando
  // cuando llegue un refetch silencioso por staleMs o invalidación.
  useEffect(() => {
    if (isOwn && user) {
      setForm({
        full_name: user.full_name || '',
        area: user.area || '',
        position: user.position || '',
        factory: user.factory || '',
        contact_info: user.contact_info || '',
      })
    }
  }, [isOwn, user?.id])

  const reload = refetch

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const formData = new FormData()
      Object.entries(form).forEach(([k, v]) => formData.append(k, v))
      if (profilePicFile) {
        formData.append('profile_pic', profilePicFile)
      }
      const data = await updateProfile(formData)
      if (isOwn) updateUser(data)
      setProfilePicFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await refetch()
      setEditing(false)
      toast.success('Perfil actualizado')
    } catch (err) {
      toast.error(extractApiError(err, 'Error al actualizar perfil'))
    } finally {
      setSaving(false)
    }
  }

  // Cancela la edición sin guardar: revierte form al estado del backend,
  // descarta la foto seleccionada y vuelve a modo lectura.
  const handleCancelEdit = () => {
    if (user) {
      setForm({
        full_name: user.full_name || '',
        area: user.area || '',
        position: user.position || '',
        factory: user.factory || '',
        contact_info: user.contact_info || '',
      })
    }
    setProfilePicFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setEditing(false)
  }

  const resetSetupState = () => {
    setPasswordOpen(false)
    setSetupOpen(false)
    setSetupData(null)
    setCode('')
    setCurrentTwoFaCode('')
    setCurrentPassword('')
  }

  const resetDisableState = () => {
    setDisableOpen(false)
    setDisableForm({ currentPassword: '', code: '' })
  }

  const startSetup2fa = () => {
    setCurrentPassword('')
    setPasswordOpen(true)
  }

  const submitPassword = async (e) => {
    e.preventDefault()
    if (!currentPassword) return
    setPasswordSubmitting(true)
    try {
      const data = await setupTwoFa(currentPassword)
      setSetupData(data)
      setCode('')
      setPasswordOpen(false)
      setSetupOpen(true)
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo iniciar la configuración 2FA'))
    } finally {
      setPasswordSubmitting(false)
    }
  }

  const resetPwdChange = () => {
    setPwdChangeOpen(false)
    setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '', totpCode: '' })
  }

  const submitPasswordChange = async (e) => {
    e.preventDefault()
    if (pwdForm.newPassword.length < 8) {
      toast.error('La nueva contraseña debe tener al menos 8 caracteres')
      return
    }
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      toast.error('Las contraseñas nuevas no coinciden')
      return
    }
    if (pwdForm.newPassword === pwdForm.currentPassword) {
      toast.error('La nueva contraseña debe ser diferente a la actual')
      return
    }
    // Si el usuario tiene 2FA activo, exigimos también el código TOTP en el
    // mismo flujo (el backend lo valida server-side de cualquier manera).
    if (user.totp_enabled && (!pwdForm.totpCode || pwdForm.totpCode.length !== 6)) {
      toast.error('Ingresa el código de 6 dígitos de tu app autenticadora')
      return
    }
    setPwdSubmitting(true)
    try {
      await changeOwnPassword(user.id, {
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword,
        totpCode: user.totp_enabled ? pwdForm.totpCode : undefined,
      })
      toast.success('Contraseña actualizada. Inicia sesión de nuevo.')
      resetPwdChange()
      await logout()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo cambiar la contraseña'))
    } finally {
      setPwdSubmitting(false)
    }
  }

  const confirm2fa = async (e) => {
    e.preventDefault()
    if (!setupData) return
    // Si user ya tiene 2FA, exigimos el código del dispositivo actual.
    if (user.totp_enabled && !currentTwoFaCode) {
      toast.error('Ingresa el código actual de tu 2FA para cambiar de dispositivo')
      return
    }
    setConfirming(true)
    try {
      await confirmTwoFa({
        code,
        secret: setupData.secret,
        currentPassword,
        currentTwoFaCode: user.totp_enabled ? currentTwoFaCode : undefined,
      })
      toast.success(user.totp_enabled ? '2FA reconfigurado correctamente' : '2FA activado correctamente')
      resetSetupState()
      await reload()
    } catch (err) {
      toast.error(extractApiError(err, 'Código incorrecto'))
    } finally {
      setConfirming(false)
    }
  }

  // ── Mi actividad reciente ────────────────────────────────────────────────
  useEffect(() => {
    if (!isOwn) {
      setActivity(null)
      return
    }
    let cancelled = false
    setActivityErr(false)
    getMyActivity({ limit: 15 })
      .then((data) => { if (!cancelled) setActivity(Array.isArray(data) ? data : []) })
      .catch(() => {
        if (!cancelled) {
          setActivity([])
          setActivityErr(true)
        }
      })
    return () => { cancelled = true }
  }, [isOwn, user?.id])

  const reloadActivity = async () => {
    setActivity(null)
    try {
      const data = await getMyActivity({ limit: 15 })
      setActivity(Array.isArray(data) ? data : [])
      setActivityErr(false)
    } catch {
      setActivity([])
      setActivityErr(true)
    }
  }

  // ── Sesiones activas handlers ────────────────────────────────────────────
  useEffect(() => {
    if (!isOwn) {
      setSessions(null)
      return
    }
    let cancelled = false
    setSessionsErr(false)
    listSessions()
      .then((data) => { if (!cancelled) setSessions(Array.isArray(data) ? data : []) })
      .catch(() => {
        if (!cancelled) {
          setSessions([])
          setSessionsErr(true)
        }
      })
    return () => { cancelled = true }
  }, [isOwn, user?.id])

  const reloadSessions = async () => {
    try {
      const data = await listSessions()
      setSessions(Array.isArray(data) ? data : [])
      setSessionsErr(false)
    } catch {
      setSessionsErr(true)
    }
  }

  const handleRevokeSession = async (sessionId) => {
    setRevokingId(sessionId)
    try {
      await revokeSession(sessionId)
      toast.success('Sesión revocada')
      // Optimismo: quitarla local sin esperar; luego reload.
      setSessions((prev) => (prev || []).filter((s) => s.id !== sessionId))
      reloadSessions()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo revocar la sesión'))
    } finally {
      setRevokingId(null)
    }
  }

  const handleRevokeAllSessions = async () => {
    setRevokeAllSubmitting(true)
    try {
      await revokeAllSessions()
      toast.success('Cerrando todas tus sesiones...')
      // El backend invalida nuestro propio JWT (password_version++).
      // El siguiente request dará 401 → bounceToLogin. Forzamos el logout
      // local explícitamente para una transición limpia.
      setRevokeAllOpen(false)
      await logout()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudieron revocar las sesiones'))
      setRevokeAllSubmitting(false)
    }
  }

  // ── Backup codes handlers ────────────────────────────────────────────────
  // Cargar el conteo solo si el usuario tiene 2FA activo (sino el endpoint
  // devuelve enabled:false y no es accionable). Re-cargar cuando cambia el
  // estado de 2FA.
  useEffect(() => {
    if (!isOwn || !user?.totp_enabled) {
      setBcStatus(null)
      return
    }
    let cancelled = false
    getBackupCodesStatus()
      .then((d) => { if (!cancelled) setBcStatus(d) })
      .catch(() => { if (!cancelled) setBcStatus(null) })
    return () => { cancelled = true }
  }, [isOwn, user?.totp_enabled])

  const resetBcGen = () => {
    setBcGenOpen(false)
    setBcGenForm({ currentPassword: '', code: '' })
  }

  const resetBcShow = () => {
    setBcShowOpen(false)
    setBcShowCodes([])
    setBcCopied(false)
  }

  const resetBcRevoke = () => {
    setBcRevokeOpen(false)
    setBcRevokeForm({ currentPassword: '', code: '' })
  }

  const submitGenerateBackupCodes = async (e) => {
    e.preventDefault()
    setBcGenSubmitting(true)
    try {
      const data = await generateBackupCodes({
        currentPassword: bcGenForm.currentPassword,
        code: bcGenForm.code,
      })
      setBcShowCodes(data.codes || [])
      resetBcGen()
      setBcShowOpen(true)
      // Refrescar conteo
      try {
        const s = await getBackupCodesStatus()
        setBcStatus(s)
      } catch {}
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudieron generar los códigos'))
    } finally {
      setBcGenSubmitting(false)
    }
  }

  const submitRevokeBackupCodes = async (e) => {
    e.preventDefault()
    setBcRevokeSubmitting(true)
    try {
      await revokeBackupCodes({
        currentPassword: bcRevokeForm.currentPassword,
        code: bcRevokeForm.code,
      })
      toast.success('Códigos de respaldo revocados')
      resetBcRevoke()
      try {
        const s = await getBackupCodesStatus()
        setBcStatus(s)
      } catch {}
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudieron revocar los códigos'))
    } finally {
      setBcRevokeSubmitting(false)
    }
  }

  const copyBackupCodes = async () => {
    try {
      await navigator.clipboard.writeText(bcShowCodes.join('\n'))
      setBcCopied(true)
      setTimeout(() => setBcCopied(false), 2000)
      toast.success('Códigos copiados')
    } catch {
      toast.error('No se pudo copiar al portapapeles')
    }
  }

  const downloadBackupCodes = () => {
    const stamp = new Date().toISOString().slice(0, 10)
    const content = [
      `Códigos de respaldo 2FA — ${user.username}`,
      `Generados: ${new Date().toLocaleString('es-MX')}`,
      '',
      'Guarda esta lista en lugar seguro. Cada código solo se puede usar UNA vez',
      'para iniciar sesión cuando no tengas el dispositivo autenticador.',
      'Regenerar invalida todos los códigos anteriores.',
      '',
      ...bcShowCodes,
    ].join('\n')
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `backup-codes-${user.username}-${stamp}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ── Preview de foto de perfil ────────────────────────────────────────────
  // Cada vez que cambia el File seleccionado, generamos un object URL nuevo
  // y revocamos el anterior. URL.createObjectURL reserva memoria hasta que
  // se libera con revokeObjectURL — sin esto, cambiar de archivo varias veces
  // leakea el blob anterior. También limpiamos al desmontar.
  useEffect(() => {
    if (!profilePicFile) {
      setProfilePicPreview(null)
      return
    }
    const url = URL.createObjectURL(profilePicFile)
    setProfilePicPreview(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [profilePicFile])

  // Validación compartida por el input file y la cámara: tipo y tamaño antes
  // de aceptar el File. Si pasa, dispara el preview vía el effect de arriba.
  const acceptProfilePicFile = (file) => {
    if (!file) return false
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      toast.error('Solo se permiten imágenes JPG, PNG o WEBP')
      return false
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('La imagen excede 8 MB')
      return false
    }
    setProfilePicFile(file)
    return true
  }

  const handlePickFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) {
      setProfilePicFile(null)
      return
    }
    if (!acceptProfilePicFile(file)) {
      e.target.value = ''
    }
  }

  // Cancela la selección sin guardar nada. El avatar vuelve a mostrar la
  // foto actual del backend, no la preview local.
  const cancelProfilePicSelection = () => {
    setProfilePicFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Eliminar foto de perfil ──────────────────────────────────────────────
  const handleDeleteProfilePhoto = async () => {
    setDeletingPhoto(true)
    try {
      const data = await deleteProfilePhoto()
      if (isOwn) updateUser(data)
      setProfilePicFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await refetch()
      toast.success('Foto eliminada')
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo eliminar la foto'))
    } finally {
      setDeletingPhoto(false)
    }
  }

  const submitDisable2fa = async (e) => {
    e.preventDefault()
    setDisableSubmitting(true)
    try {
      await disableTwoFa({
        currentPassword: disableForm.currentPassword,
        code: disableForm.code,
      })
      toast.success('2FA desactivado')
      resetDisableState()
      await reload()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo desactivar 2FA'))
    } finally {
      setDisableSubmitting(false)
    }
  }

  if (!user) return <p className="text-sm text-ink-500">Cargando perfil...</p>

  const isOnline = user.last_seen && (Date.now() - new Date(user.last_seen).getTime() < 5 * 60 * 1000)

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 sm:mb-8 flex items-end justify-between gap-3 flex-wrap pt-1">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900 dark:text-ink-100 tracking-tight">
            {readonly ? user.full_name || user.username : 'Mi cuenta'}
          </h1>
          <p className="mt-1.5 text-sm text-ink-500 dark:text-ink-400">
            {readonly
              ? `Perfil de ${user.role?.replace('_', ' ') || 'miembro del equipo'}.`
              : 'Información personal, seguridad y sesiones activas.'}
          </p>
        </div>
        {readonly && (
          <Link to="/directorio">
            <Button variant="secondary" size="sm" leftIcon={<ArrowLeft size={14} />}>
              Volver al directorio
            </Button>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-20 space-y-4">
            <Card className="!p-0 overflow-hidden">
              <div className="relative h-20 bg-gradient-to-br from-brand-50 via-ink-50 to-ink-100 dark:from-brand-900/30 dark:via-ink-800/40 dark:to-ink-800" />
              <div className="px-6 pb-6 -mt-12">
                <div className="relative inline-block">
                  <UserAvatar
                    id={user.id}
                    profilePic={user.profile_pic}
                    name={user.full_name || user.username}
                    size="xl"
                    className="!h-24 !w-24 !text-3xl ring-4 ring-white dark:ring-ink-900 shadow-sm"
                  />
                  {isOnline && (
                    <span
                      className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-ink-900"
                      title="En línea"
                    />
                  )}
                </div>
                <h2 className="mt-4 text-lg font-semibold text-ink-900 dark:text-ink-100 leading-tight">
                  {user.full_name || user.username}
                </h2>
                <p className="text-sm text-ink-500 dark:text-ink-400">@{user.username}</p>
                <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                  <Badge tone="brand" leftIcon={<ShieldCheck size={11} />}>
                    {user.role?.replace('_', ' ')}
                  </Badge>
                  {user.totp_enabled && <Badge tone="success" dot>2FA</Badge>}
                </div>
                {user.last_seen && (
                  <p className="mt-3 text-[11px] text-ink-500 dark:text-ink-400 tabular-nums">
                    {isOnline ? (
                      <span className="text-emerald-700 dark:text-emerald-400 font-medium">● En línea ahora</span>
                    ) : (
                      <>
                        Últ. conexión:{' '}
                        {new Date(user.last_seen).toLocaleString('es-MX', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </>
                    )}
                  </p>
                )}
              </div>
              <div className="border-t border-ink-100 dark:border-ink-800/80 px-6 py-5 space-y-3 text-sm bg-ink-50/40 dark:bg-ink-900/40">
                <Row icon={Briefcase} value={user.position} placeholder="Sin puesto asignado" />
                <Row icon={Building2} value={user.area} placeholder="Sin área asignada" />
                <Row icon={Factory} value={user.factory} placeholder="Sin planta asignada" />
                {user.contact_info && (
                  <Row
                    icon={user.contact_info.includes('@') ? Mail : Phone}
                    value={user.contact_info}
                    placeholder=""
                  />
                )}
              </div>
            </Card>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {readonly ? (
            <Card>
              <CardHeader title="Información del perfil" description="Datos compartidos por este miembro del equipo." />
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <ReadField label="Nombre completo" value={user.full_name} />
                <ReadField label="Usuario" value={`@${user.username}`} />
                <ReadField label="Puesto" value={user.position} />
                <ReadField label="Área" value={user.area} />
                <ReadField label="Planta" value={user.factory} />
                <ReadField label="Contacto" value={user.contact_info} />
                <ReadField label="Rol" value={user.role?.replace('_', ' ')} />
                <ReadField label="2FA" value={user.totp_enabled ? 'Activo' : 'Inactivo'} />
              </dl>
            </Card>
          ) : (
            <>
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <CardHeader
                    title="Información personal"
                    description="Datos visibles en el directorio y necesarios para que el equipo pueda contactarte."
                  />
                  {!editing && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      leftIcon={<Pencil size={13} />}
                      onClick={() => setEditing(true)}
                      className="flex-shrink-0"
                    >
                      Editar
                    </Button>
                  )}
                </div>

                {!editing ? (
                  <p className="text-[11px] text-ink-500 dark:text-ink-400 italic">
                    Tus datos se muestran en el panel lateral. Pulsa <strong className="font-semibold not-italic">Editar</strong> para modificarlos.
                  </p>
                ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <Input
                    label="Nombre completo"
                    leftIcon={<User size={14} />}
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  />

                  <div>
                    <label className="block text-xs font-medium text-ink-700 dark:text-ink-300 mb-2 tracking-wide">
                      Foto de perfil
                    </label>
                    <div className="flex items-start gap-5 rounded-lg ring-1 ring-ink-200 dark:ring-ink-700/70 bg-ink-50/50 dark:bg-ink-900/40 p-4">
                      {/* Avatar + badge de estado */}
                      <div className="relative flex-shrink-0">
                        {profilePicPreview ? (
                          <Avatar
                            name={user.full_name || user.username}
                            size="lg"
                            src={profilePicPreview}
                            className="!h-20 !w-20 ring-2 ring-brand-400 dark:ring-brand-500"
                          />
                        ) : (
                          <UserAvatar
                            id={user.id}
                            profilePic={user.profile_pic}
                            name={user.full_name || user.username}
                            size="lg"
                            className="!h-20 !w-20 ring-1 ring-ink-200 dark:ring-ink-700"
                          />
                        )}
                        {profilePicPreview && (
                          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300 bg-white dark:bg-ink-900 ring-1 ring-brand-300 dark:ring-brand-600 px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm">
                            Vista previa
                          </span>
                        )}
                      </div>

                      {/* Acciones + ayuda */}
                      <div className="min-w-0 flex-1 flex flex-col gap-3">
                        {/* Acciones primarias en una sola fila */}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            leftIcon={<Upload size={13} />}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            {hasCustomPhoto(user) || profilePicFile ? 'Cambiar archivo' : 'Subir archivo'}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            leftIcon={<Camera size={13} />}
                            onClick={() => setCamOpen(true)}
                          >
                            Tomar foto
                          </Button>
                          {/* Input file oculto — disparado por el botón anterior */}
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handlePickFile}
                            className="hidden"
                          />
                        </div>

                        {/* Estado actual: selección pendiente, foto existente, o vacío */}
                        {profilePicFile ? (
                          <div className="flex items-start justify-between gap-3 text-[11px]">
                            <p className="text-brand-700 dark:text-brand-300 min-w-0 truncate">
                              <strong className="font-semibold">{profilePicFile.name}</strong>
                              <span className="text-ink-500 dark:text-ink-400"> — se guardará al pulsar "Guardar cambios".</span>
                            </p>
                            <button
                              type="button"
                              onClick={cancelProfilePicSelection}
                              className="flex-shrink-0 inline-flex items-center gap-1 text-ink-600 dark:text-ink-400 hover:text-red-700 dark:hover:text-red-400 font-medium focus-ring rounded"
                            >
                              <X size={12} /> Descartar
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[11px] text-ink-500 dark:text-ink-400">
                              JPG, PNG o WEBP · máx. 8 MB
                            </p>
                            {hasCustomPhoto(user) && (
                              <button
                                type="button"
                                onClick={handleDeleteProfilePhoto}
                                disabled={deletingPhoto}
                                className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] text-red-700 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium disabled:opacity-50 focus-ring rounded"
                              >
                                {deletingPhoto ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                Eliminar foto
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-1 border-t border-ink-100 dark:border-ink-800/80">
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-ink-500 dark:text-ink-400 mt-4 mb-3">
                      Datos laborales
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input label="Puesto" leftIcon={<Briefcase size={14} />} value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
                      <Input label="Área" leftIcon={<Building2 size={14} />} value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
                      <Input label="Planta" leftIcon={<Factory size={14} />} value={form.factory} onChange={(e) => setForm({ ...form, factory: e.target.value })} />
                      <Input label="Contacto" leftIcon={<Phone size={14} />} value={form.contact_info} onChange={(e) => setForm({ ...form, contact_info: e.target.value })} placeholder="Email o teléfono" />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-ink-100 dark:border-ink-800/80 -mx-5 sm:-mx-6 px-5 sm:px-6 -mb-1">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleCancelEdit}
                      disabled={saving}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" loading={saving} leftIcon={<Save size={15} />}>
                      Guardar cambios
                    </Button>
                  </div>
                </form>
                )}
              </Card>

              <Card>
                <CardHeader
                  title="Seguridad de la cuenta"
                  description="Contraseña, doble factor y códigos de respaldo. Ajustes que protegen tu acceso."
                />
                <div className="divide-y divide-ink-100 dark:divide-ink-800/80 -mx-2 sm:-mx-0">
                  <SettingsRow
                    icon={Lock}
                    title="Contraseña"
                    description="Cámbiala periódicamente. Al guardar, se cierra tu sesión en todos los dispositivos."
                    statusBadge={<Badge tone="neutral">Activa</Badge>}
                  >
                    <Button variant="secondary" size="sm" leftIcon={<KeyRound size={14} />} onClick={() => setPwdChangeOpen(true)}>
                      Cambiar
                    </Button>
                  </SettingsRow>

                  <SettingsRow
                    icon={ShieldCheck}
                    title="Verificación en dos pasos (2FA)"
                    description={user.totp_enabled
                      ? 'Tu cuenta está protegida con un código adicional desde tu app autenticadora.'
                      : 'Recomendado. Un código adicional desde tu app autenticadora protege la cuenta aunque se filtre tu contraseña.'}
                    statusBadge={user.totp_enabled
                      ? <Badge tone="success" dot>Activo</Badge>
                      : <Badge tone="warning" dot>Inactivo</Badge>}
                  >
                    {user.totp_enabled ? (
                      <div className="flex gap-1.5 flex-wrap justify-end">
                        <Button variant="secondary" size="sm" leftIcon={<KeyRound size={14} />} onClick={startSetup2fa}>
                          Cambiar dispositivo
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<ShieldOff size={14} />}
                          onClick={() => setDisableOpen(true)}
                          className="text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          Desactivar
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" leftIcon={<KeyRound size={14} />} onClick={startSetup2fa}>
                        Activar 2FA
                      </Button>
                    )}
                  </SettingsRow>

                  {user.totp_enabled && (
                    <SettingsRow
                      icon={FileKey2}
                      title="Códigos de respaldo"
                      description="Te permiten entrar si pierdes el dispositivo autenticador. Cada código sirve una sola vez."
                      statusBadge={
                        bcStatus === null
                          ? <Badge tone="neutral">—</Badge>
                          : bcStatus.remaining === 0
                            ? <Badge tone="warning" dot>Sin códigos</Badge>
                            : bcStatus.low
                              ? <Badge tone="warning" dot>{bcStatus.remaining} restantes</Badge>
                              : <Badge tone="success">{bcStatus.remaining} disponibles</Badge>
                      }
                    >
                      {bcStatus !== null && bcStatus.remaining === 0 ? (
                        <Button size="sm" leftIcon={<FileKey2 size={14} />} onClick={() => setBcGenOpen(true)}>
                          Generar códigos
                        </Button>
                      ) : (
                        <div className="flex gap-1.5 flex-wrap justify-end">
                          <Button variant="secondary" size="sm" leftIcon={<RefreshCw size={14} />} onClick={() => setBcGenOpen(true)}>
                            Regenerar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<Trash2 size={14} />}
                            onClick={() => setBcRevokeOpen(true)}
                            className="text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            Revocar
                          </Button>
                        </div>
                      )}
                    </SettingsRow>
                  )}
                </div>
              </Card>

              <Card>
                <CardHeader
                  title="Sesiones activas"
                  description="Dispositivos donde tu cuenta está abierta. Si reconoces alguno extraño, revócalo."
                  actions={
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<RefreshCw size={13} />}
                      onClick={reloadSessions}
                      disabled={sessions === null}
                    >
                      Recargar
                    </Button>
                  }
                />
                {sessions === null ? (
                  <div className="space-y-2">
                    <div className="h-14 rounded-md bg-ink-100 dark:bg-ink-800/60 animate-pulse" />
                    <div className="h-14 rounded-md bg-ink-100 dark:bg-ink-800/60 animate-pulse" />
                  </div>
                ) : sessionsErr ? (
                  <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-300 flex gap-2">
                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>No se pudieron cargar las sesiones. Verifica tu conexión.</span>
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="rounded-md border border-dashed border-ink-200 dark:border-ink-700 p-6 text-xs text-ink-500 dark:text-ink-400 text-center">
                    No hay sesiones de larga duración activas.
                    <div className="mt-1 text-[11px] opacity-75">
                      Marca "Recordarme" al iniciar sesión para conservar la sesión entre cierres del navegador.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <ul className="divide-y divide-ink-100 dark:divide-ink-800/80 border border-ink-200 dark:border-ink-800 rounded-md overflow-hidden">
                      {sessions.map((s) => (
                        <SessionRow
                          key={s.id}
                          session={s}
                          revoking={revokingId === s.id}
                          onRevoke={() => handleRevokeSession(s.id)}
                        />
                      ))}
                    </ul>

                    {sessions.length > 1 && (
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<LogOut size={13} />}
                          onClick={() => setRevokeAllOpen(true)}
                          className="text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          Cerrar todas (incluyendo ésta)
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </Card>

              {/* Preferencias visuales — se guardan localmente (sin backend). */}
              <Card>
                <CardHeader
                  title="Preferencias"
                  description="Personaliza cómo se ve la aplicación en este dispositivo."
                />
                <div className="divide-y divide-ink-100 dark:divide-ink-800/80">
                  <SettingsRow
                    icon={theme === 'dark' ? Moon : Sun}
                    title="Apariencia"
                    description="Cambia entre claro y oscuro. La preferencia se guarda en este navegador."
                  >
                    <SegmentedToggle
                      value={theme}
                      onChange={setTheme}
                      options={[
                        { value: 'light', label: 'Claro', icon: Sun },
                        { value: 'dark', label: 'Oscuro', icon: Moon },
                      ]}
                    />
                  </SettingsRow>

                  <SettingsRow
                    icon={Sliders}
                    title="Densidad de información"
                    description="Listas y tablas con más respiración o más compactas."
                  >
                    <SegmentedToggle
                      value={density}
                      onChange={applyDensity}
                      options={[
                        { value: 'comfortable', label: 'Cómoda' },
                        { value: 'compact', label: 'Compacta' },
                      ]}
                    />
                  </SettingsRow>
                </div>
              </Card>

              {/* Atajos de teclado — descubribilidad de g+letra y Ctrl+K */}
              <Card>
                <CardHeader
                  title="Atajos de teclado"
                  description="Atajos disponibles según tu rol. Funcionan en cualquier pantalla, fuera de campos de texto."
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                  <KeyboardShortcut keys={['Ctrl', 'K']} description="Abrir búsqueda y comandos" />
                  {getShortcutsForRole(user.role).map((s) => (
                    <KeyboardShortcut key={s.key} keys={['G', s.key]} description={s.label} />
                  ))}
                </div>
              </Card>

              {/* Mi actividad reciente — del audit log, solo propia. */}
              <Card>
                <CardHeader
                  title="Mi actividad reciente"
                  description="Las últimas acciones registradas con tu cuenta. Útil para confirmar que todo fue tuyo."
                  actions={
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<RefreshCw size={13} />}
                      onClick={reloadActivity}
                      disabled={activity === null}
                    >
                      Recargar
                    </Button>
                  }
                />
                {activity === null ? (
                  <div className="space-y-2">
                    <div className="h-10 rounded-md bg-ink-100 dark:bg-ink-800/60 animate-pulse" />
                    <div className="h-10 rounded-md bg-ink-100 dark:bg-ink-800/60 animate-pulse" />
                    <div className="h-10 rounded-md bg-ink-100 dark:bg-ink-800/60 animate-pulse" />
                  </div>
                ) : activityErr ? (
                  <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-300 flex gap-2">
                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>No se pudo cargar la actividad reciente.</span>
                  </div>
                ) : activity.length === 0 ? (
                  <div className="rounded-md border border-dashed border-ink-200 dark:border-ink-700 p-6 text-xs text-ink-500 dark:text-ink-400 text-center italic">
                    No hay actividad registrada todavía.
                  </div>
                ) : (
                  <ul className="divide-y divide-ink-100 dark:divide-ink-800/80 border border-ink-200 dark:border-ink-800 rounded-md overflow-y-auto scrollbar-thin max-h-72">
                    {activity.map((ev) => (
                      <ActivityRow key={ev.id} event={ev} />
                    ))}
                  </ul>
                )}
              </Card>
            </>
          )}
        </div>
      </div>

      <Modal
        open={pwdChangeOpen}
        onClose={resetPwdChange}
        title="Cambiar contraseña"
        description="Al guardar, se cerrará tu sesión y deberás entrar de nuevo con la contraseña nueva."
        size="sm"
      >
        <form onSubmit={submitPasswordChange} className="space-y-4">
          <Input
            label="Contraseña actual"
            leftIcon={<Lock size={14} />}
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            value={pwdForm.currentPassword}
            onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })}
          />
          <div>
            <Input
              label="Nueva contraseña"
              leftIcon={<KeyRound size={14} />}
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={pwdForm.newPassword}
              onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
              placeholder="Mínimo 8 caracteres"
            />
            <PasswordStrengthIndicator password={pwdForm.newPassword} className="mt-2" />
          </div>
          <Input
            label="Confirmar nueva contraseña"
            leftIcon={<KeyRound size={14} />}
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={pwdForm.confirmPassword}
            onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
          />
          {user.totp_enabled && (
            <div>
              <label className="block text-xs font-medium text-ink-700 dark:text-ink-300 mb-2 tracking-wide">
                Código 2FA actual
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={pwdForm.totpCode}
                onChange={(e) => setPwdForm({ ...pwdForm, totpCode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                placeholder="000000"
                maxLength={6}
                required
                className="block w-full px-4 py-2.5 border border-ink-300 dark:border-ink-700 bg-white dark:bg-ink-800 rounded-md text-center text-xl font-semibold tracking-[0.4em] text-ink-900 dark:text-ink-100 placeholder:text-ink-300 dark:placeholder:text-ink-600 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition-colors"
              />
              <p className="mt-1.5 text-xs text-ink-500 dark:text-ink-400">
                Tu 2FA está activo. Confirma que tienes acceso al dispositivo.
              </p>
            </div>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={resetPwdChange}>Cancelar</Button>
            <Button type="submit" loading={pwdSubmitting} leftIcon={<KeyRound size={14} />}>
              Cambiar contraseña
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={passwordOpen}
        onClose={resetSetupState}
        title="Confirma tu contraseña"
        description="Por seguridad, necesitamos verificar tu identidad antes de configurar 2FA."
        size="sm"
      >
        <form onSubmit={submitPassword} className="space-y-4">
          <Input
            label="Contraseña actual"
            leftIcon={<Lock size={14} />}
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={resetSetupState}>Cancelar</Button>
            <Button type="submit" loading={passwordSubmitting} leftIcon={<ShieldCheck size={14} />}>
              Continuar
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={setupOpen}
        onClose={resetSetupState}
        title={user.totp_enabled ? 'Cambiar dispositivo 2FA' : 'Configurar 2FA'}
        description={user.totp_enabled
          ? 'Escanea el QR con tu nueva app. Para confirmar el cambio necesitas tanto el código del dispositivo nuevo como uno del actual.'
          : 'Escanea el QR con tu app autenticadora y verifica el código generado.'}
        size="md"
      >
        {setupData && (
          <form onSubmit={confirm2fa} className="space-y-5">
            <div className="flex justify-center">
              <img
                src={`data:image/png;base64,${setupData.qr}`}
                alt="QR 2FA"
                className="border border-ink-200 dark:border-ink-700 rounded-md p-2 bg-white"
                width={240}
                height={240}
              />
            </div>
            <div className="text-center text-xs text-ink-500 dark:text-ink-400">
              ¿No puedes escanear? Ingresa este secret manualmente:
              <div className="mt-1.5 font-mono text-sm select-all bg-ink-100 dark:bg-ink-800 px-3 py-2 rounded-md text-ink-900 dark:text-ink-100 break-all">
                {setupData.secret}
              </div>
            </div>
            {user.totp_enabled && (
              <div>
                <label className="block text-xs font-medium text-ink-700 dark:text-ink-300 mb-2 tracking-wide">
                  Código actual (del dispositivo registrado)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={currentTwoFaCode}
                  onChange={(e) => setCurrentTwoFaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  required
                  className="block w-full px-4 py-2.5 border border-amber-300 dark:border-amber-700 bg-white dark:bg-ink-800 rounded-md text-center text-xl font-semibold tracking-[0.4em] text-ink-900 dark:text-ink-100 placeholder:text-ink-300 dark:placeholder:text-ink-600 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition-colors"
                />
                <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
                  Prueba que tienes acceso al dispositivo actual antes de cambiarlo.
                </p>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-ink-700 dark:text-ink-300 mb-2 tracking-wide">
                Código del nuevo dispositivo
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                required
                autoFocus
                className="block w-full px-4 py-3 border border-ink-300 dark:border-ink-700 bg-white dark:bg-ink-800 rounded-md text-center text-2xl font-semibold tracking-[0.5em] text-ink-900 dark:text-ink-100 placeholder:text-ink-300 dark:placeholder:text-ink-600 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition-colors"
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="secondary" type="button" onClick={resetSetupState}>Cancelar</Button>
              <Button type="submit" loading={confirming} leftIcon={<ShieldCheck size={14} />}>
                {user.totp_enabled ? 'Confirmar cambio' : 'Verificar y activar'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={disableOpen}
        onClose={resetDisableState}
        title="Desactivar 2FA"
        description="Quitar el segundo factor reduce la seguridad de tu cuenta. Para confirmar necesitamos tu contraseña y un código actual del autenticador."
        size="sm"
      >
        <form onSubmit={submitDisable2fa} className="space-y-4">
          <Input
            label="Contraseña actual"
            leftIcon={<Lock size={14} />}
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            value={disableForm.currentPassword}
            onChange={(e) => setDisableForm({ ...disableForm, currentPassword: e.target.value })}
          />
          <div>
            <label className="block text-xs font-medium text-ink-700 dark:text-ink-300 mb-2 tracking-wide">
              Código 2FA actual
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={disableForm.code}
              onChange={(e) => setDisableForm({ ...disableForm, code: e.target.value.replace(/\D/g, '').slice(0, 6) })}
              placeholder="000000"
              maxLength={6}
              required
              className="block w-full px-4 py-3 border border-ink-300 dark:border-ink-700 bg-white dark:bg-ink-800 rounded-md text-center text-2xl font-semibold tracking-[0.5em] text-ink-900 dark:text-ink-100 placeholder:text-ink-300 dark:placeholder:text-ink-600 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition-colors"
            />
          </div>
          <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-300">
            Después de desactivar entrarás con solo usuario y contraseña. Te recomendamos volverlo a activar pronto.
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={resetDisableState}>Cancelar</Button>
            <Button type="submit" loading={disableSubmitting} leftIcon={<ShieldOff size={14} />} className="bg-red-600 hover:bg-red-700">
              Desactivar 2FA
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: generar/regenerar backup codes */}
      <Modal
        open={bcGenOpen}
        onClose={resetBcGen}
        title={bcStatus?.remaining > 0 ? 'Regenerar códigos de respaldo' : 'Generar códigos de respaldo'}
        description={bcStatus?.remaining > 0
          ? 'Regenerar invalidará TODOS los códigos anteriores. Asegúrate de guardar los nuevos antes de cerrar la ventana.'
          : 'Te entregaremos 10 códigos. Cada uno sirve una sola vez para iniciar sesión cuando no tengas tu dispositivo.'}
        size="sm"
      >
        <form onSubmit={submitGenerateBackupCodes} className="space-y-4">
          {bcStatus?.remaining > 0 && (
            <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-300 flex gap-2">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <span>Los códigos viejos ({bcStatus.remaining} restantes) dejarán de funcionar al regenerar.</span>
            </div>
          )}
          <Input
            label="Contraseña actual"
            leftIcon={<Lock size={14} />}
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            value={bcGenForm.currentPassword}
            onChange={(e) => setBcGenForm({ ...bcGenForm, currentPassword: e.target.value })}
          />
          <div>
            <label className="block text-xs font-medium text-ink-700 dark:text-ink-300 mb-2 tracking-wide">
              Código 2FA actual
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={bcGenForm.code}
              onChange={(e) => setBcGenForm({ ...bcGenForm, code: e.target.value.replace(/\D/g, '').slice(0, 6) })}
              placeholder="000000"
              maxLength={6}
              required
              className="block w-full px-4 py-3 border border-ink-300 dark:border-ink-700 bg-white dark:bg-ink-800 rounded-md text-center text-2xl font-semibold tracking-[0.5em] text-ink-900 dark:text-ink-100 placeholder:text-ink-300 dark:placeholder:text-ink-600 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition-colors"
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={resetBcGen}>Cancelar</Button>
            <Button type="submit" loading={bcGenSubmitting} leftIcon={<FileKey2 size={14} />}>
              {bcStatus?.remaining > 0 ? 'Regenerar' : 'Generar'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: mostrar los códigos generados (UNA SOLA VEZ) */}
      <Modal
        open={bcShowOpen}
        onClose={resetBcShow}
        title="Tus códigos de respaldo"
        description="Guárdalos AHORA. No volverán a mostrarse en pantalla; el servidor solo guarda su huella."
        size="md"
      >
        <div className="space-y-4">
          <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-300 flex gap-2">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            <span>
              Una vez cierres esta ventana <strong>no podrás verlos de nuevo</strong>.
              Cópialos a tu gestor de contraseñas o descárgalos antes de cerrar.
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 p-4 bg-ink-50 dark:bg-ink-800/60 border border-ink-200 dark:border-ink-700 rounded-md font-mono text-sm">
            {bcShowCodes.map((c, i) => (
              <div
                key={i}
                className="px-3 py-2 bg-white dark:bg-ink-900 rounded border border-ink-200 dark:border-ink-700 text-ink-900 dark:text-ink-100 tracking-wider select-all text-center"
              >
                {c}
              </div>
            ))}
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={bcCopied ? <Check size={14} /> : <Copy size={14} />}
              onClick={copyBackupCodes}
            >
              {bcCopied ? 'Copiados' : 'Copiar todos'}
            </Button>
            <Button variant="secondary" size="sm" leftIcon={<Download size={14} />} onClick={downloadBackupCodes}>
              Descargar .txt
            </Button>
            <div className="flex-1" />
            <Button onClick={resetBcShow}>
              Cerrar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: revocar TODAS las sesiones (incluida la actual) */}
      <Modal
        open={revokeAllOpen}
        onClose={() => !revokeAllSubmitting && setRevokeAllOpen(false)}
        title="Cerrar todas las sesiones"
        description="Esto te desconectará de TODOS tus dispositivos, incluyendo este. Después tendrás que iniciar sesión de nuevo."
        size="sm"
      >
        <div className="space-y-4">
          <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-xs text-red-800 dark:text-red-300 flex gap-2">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            <span>
              <strong>Acción de pánico.</strong> Útil si sospechas que alguien tiene
              tu cuenta abierta en otro dispositivo. Tu sesión actual también se cerrará.
            </span>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setRevokeAllOpen(false)}
              disabled={revokeAllSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              loading={revokeAllSubmitting}
              leftIcon={<LogOut size={14} />}
              onClick={handleRevokeAllSessions}
              className="bg-red-600 hover:bg-red-700"
            >
              Cerrar todas
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: revocar todos los backup codes */}
      <Modal
        open={bcRevokeOpen}
        onClose={resetBcRevoke}
        title="Revocar todos los códigos"
        description="Los códigos de respaldo dejarán de funcionar. Si después pierdes el dispositivo, necesitarás generar nuevos."
        size="sm"
      >
        <form onSubmit={submitRevokeBackupCodes} className="space-y-4">
          <Input
            label="Contraseña actual"
            leftIcon={<Lock size={14} />}
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            value={bcRevokeForm.currentPassword}
            onChange={(e) => setBcRevokeForm({ ...bcRevokeForm, currentPassword: e.target.value })}
          />
          <div>
            <label className="block text-xs font-medium text-ink-700 dark:text-ink-300 mb-2 tracking-wide">
              Código 2FA actual
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={bcRevokeForm.code}
              onChange={(e) => setBcRevokeForm({ ...bcRevokeForm, code: e.target.value.replace(/\D/g, '').slice(0, 6) })}
              placeholder="000000"
              maxLength={6}
              required
              className="block w-full px-4 py-3 border border-ink-300 dark:border-ink-700 bg-white dark:bg-ink-800 rounded-md text-center text-2xl font-semibold tracking-[0.5em] text-ink-900 dark:text-ink-100 placeholder:text-ink-300 dark:placeholder:text-ink-600 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition-colors"
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={resetBcRevoke}>Cancelar</Button>
            <Button type="submit" loading={bcRevokeSubmitting} leftIcon={<Trash2 size={14} />} className="bg-red-600 hover:bg-red-700">
              Revocar todos
            </Button>
          </div>
        </form>
      </Modal>

      <CamaraCaptureModal
        open={camOpen}
        onClose={() => setCamOpen(false)}
        onCapture={acceptProfilePicFile}
      />
    </div>
  )
}

function Row({ icon: Icon, value, placeholder }) {
  return (
    <div className="flex items-center gap-2.5 text-ink-700 dark:text-ink-300">
      <Icon size={14} className="text-ink-400 dark:text-ink-500 flex-shrink-0" />
      <span className={`truncate ${value ? '' : 'italic text-ink-400 dark:text-ink-500'}`}>
        {value || placeholder}
      </span>
    </div>
  )
}

// Fila de "configuración" usada en la card "Seguridad de la cuenta".
// Layout: icono pequeño + título/descripción a la izquierda, badge de estado
// centrado y acciones a la derecha. Coherente entre Password / 2FA / Backup
// codes — el look se parece a Settings de GitHub/Linear.
function SettingsRow({ icon: Icon, title, description, statusBadge, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 py-4 px-2 sm:px-1">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="h-9 w-9 rounded-lg bg-ink-100 dark:bg-ink-800 flex items-center justify-center flex-shrink-0 text-ink-600 dark:text-ink-300">
          <Icon size={16} strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-ink-900 dark:text-ink-100 leading-tight">{title}</p>
            {statusBadge}
          </div>
          {description && (
            <p className="text-xs text-ink-500 dark:text-ink-400 mt-1 leading-relaxed">{description}</p>
          )}
        </div>
      </div>
      <div className="flex-shrink-0 sm:ml-2 self-stretch sm:self-center flex sm:block items-center justify-end">
        {children}
      </div>
    </div>
  )
}

function ReadField({ label, value }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-400 mb-0.5">{label}</dt>
      <dd className="text-ink-900 dark:text-ink-100">{value || <span className="italic text-ink-400 dark:text-ink-500">No especificado</span>}</dd>
    </div>
  )
}

// ── Sesiones activas: row + helpers ─────────────────────────────────────────
// El user-agent llega del backend tal como lo mandó el browser. Lo parseamos
// con heurísticas simples (no Chrome.parser por peso) para mostrar
// "Chrome en Windows" o "Safari en iPhone" en lugar del string crudo.

function iconForUA(ua) {
  if (!ua) return Globe
  const s = ua.toLowerCase()
  if (/iphone|android.*mobile|blackberry|webos|iemobile|opera mini/.test(s)) return Smartphone
  if (/ipad|android(?!.*mobile)|tablet/.test(s)) return Tablet
  return Monitor
}

function prettyUA(ua) {
  if (!ua) return 'Dispositivo desconocido'
  const browsers = [
    [/edg\//i, 'Edge'],
    [/opr\//i, 'Opera'],
    [/chrome\//i, 'Chrome'],
    [/firefox\//i, 'Firefox'],
    [/safari\//i, 'Safari'],
    [/postman|insomnia|curl|httpie|python-requests|axios/i, 'Cliente API'],
  ]
  const oses = [
    [/iphone|ipad|ipod/i, 'iOS'],
    [/android/i, 'Android'],
    [/windows nt 10|windows nt 11/i, 'Windows'],
    [/windows nt/i, 'Windows'],
    [/mac os x/i, 'macOS'],
    [/cros/i, 'ChromeOS'],
    [/linux/i, 'Linux'],
  ]
  let browser = null
  for (const [re, name] of browsers) if (re.test(ua)) { browser = name; break }
  let os = null
  for (const [re, name] of oses) if (re.test(ua)) { os = name; break }
  if (browser && os) return `${browser} en ${os}`
  if (browser) return browser
  if (os) return os
  return ua.slice(0, 60)
}

function fmtDate(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function hasCustomPhoto(user) {
  return Boolean(user?.profile_pic) && user.profile_pic !== 'default.png'
}

// ── Preferencias ────────────────────────────────────────────────────────────
function SegmentedToggle({ value, onChange, options }) {
  return (
    <div className="inline-flex items-center rounded-md bg-ink-100 dark:bg-ink-800 p-0.5 ring-1 ring-ink-200 dark:ring-ink-700">
      {options.map((opt) => {
        const Icon = opt.icon
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-colors focus-ring ${
              active
                ? 'bg-white dark:bg-ink-900 text-ink-900 dark:text-ink-100 shadow-sm'
                : 'text-ink-600 dark:text-ink-300 hover:text-ink-900 dark:hover:text-ink-100'
            }`}
            aria-pressed={active}
          >
            {Icon && <Icon size={13} strokeWidth={1.75} />}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Atajos de teclado ───────────────────────────────────────────────────────
// Tabla por rol — refleja src/hooks/useGlobalShortcuts.js. Si cambia ese
// archivo, actualizar acá también (intencionalmente duplicado: la UI debe
// mostrar lo que el usuario realmente puede usar para SU rol).
const SHORTCUTS_BY_ROLE = {
  admin: [
    { key: 'E', label: 'Empleados' },
    { key: 'P', label: 'Prenómina' },
    { key: 'H', label: 'Horas' },
    { key: 'B', label: 'Bitácora' },
    { key: 'D', label: 'Directorio' },
    { key: 'R', label: 'Proyectos' },
    { key: 'I', label: 'Inventario' },
    { key: 'U', label: 'Usuarios' },
    { key: 'C', label: 'Credenciales' },
    { key: 'T', label: 'Proyecto total' },
    { key: 'M', label: 'Métricas' },
  ],
  coordinador: [
    { key: 'H', label: 'Reporte de horas' },
    { key: 'D', label: 'Directorio' },
    { key: 'P', label: 'Mis proyectos' },
    { key: 'C', label: 'Credenciales' },
    { key: 'F', label: 'Ficha técnica' },
    { key: 'S', label: 'Mis solicitudes' },
  ],
  inventario: [
    { key: 'C', label: 'Catálogo' },
    { key: 'S', label: 'Solicitudes' },
    { key: 'M', label: 'Movimientos' },
    { key: 'T', label: 'Tomas físicas' },
    { key: 'E', label: 'Etiquetas' },
    { key: 'H', label: 'Herramientas' },
    { key: 'B', label: 'Bajo mínimo' },
    { key: 'R', label: 'Reportes' },
  ],
  solicitante_material: [
    { key: 'P', label: 'Pedir material' },
    { key: 'S', label: 'Mis solicitudes' },
    { key: 'H', label: 'Mis herramientas' },
  ],
}
SHORTCUTS_BY_ROLE.super_admin = SHORTCUTS_BY_ROLE.admin

function getShortcutsForRole(role) {
  return SHORTCUTS_BY_ROLE[role] || []
}

function KeyboardShortcut({ keys, description }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-ink-700 dark:text-ink-300 truncate">{description}</span>
      <span className="inline-flex items-center gap-1 flex-shrink-0">
        {keys.map((k, i) => (
          <kbd
            key={i}
            className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-[11px] font-mono font-semibold bg-ink-100 dark:bg-ink-800 border border-ink-300 dark:border-ink-700 text-ink-700 dark:text-ink-200 rounded shadow-[0_1px_0_0_rgba(0,0,0,0.05)]"
          >
            {k}
          </kbd>
        ))}
      </span>
    </div>
  )
}

// ── Actividad reciente ──────────────────────────────────────────────────────
function iconForAction(action) {
  const a = (action || '').toLowerCase()
  if (/login.*exitoso|verif.*2fa.*exitoso|login.*ok/.test(a)) return ShieldCheck
  if (/login.*fallido|2fa.*fall|incorrect|inv[áa]lid/.test(a)) return ShieldAlert
  if (/logout/.test(a)) return LogOut
  if (/contrase[ñn]a|password/.test(a)) return KeyRound
  if (/2fa.*activ|2fa.*desact|backup.*code/.test(a)) return ShieldCheck
  if (/foto|perfil/.test(a)) return User
  if (/sesi[oó]n/.test(a)) return Monitor
  return Activity
}

function isWarning(action) {
  return /(fallido|fall|incorrect|inv[áa]lid|bloqueado|denegado|comprometid|replay|sospech)/i.test(action || '')
}

function ActivityRow({ event }) {
  const Icon = iconForAction(event.action)
  const warn = isWarning(event.action)
  const ts = event.created_at ? new Date(event.created_at) : null
  return (
    <li
      className={`flex items-center gap-2.5 px-3 py-1.5 hover:bg-ink-50 dark:hover:bg-ink-800/50 transition-colors ${
        warn ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''
      }`}
    >
      <div
        className={`h-5 w-5 rounded flex items-center justify-center flex-shrink-0 ${
          warn
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
            : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300'
        }`}
      >
        <Icon size={11} strokeWidth={1.75} />
      </div>
      <p
        className={`text-xs leading-snug truncate flex-1 ${
          warn
            ? 'text-amber-900 dark:text-amber-200 font-medium'
            : 'text-ink-800 dark:text-ink-200'
        }`}
        title={event.action}
      >
        {event.action || '—'}
      </p>
      <span
        className="text-[10px] text-ink-500 dark:text-ink-400 tabular-nums flex-shrink-0"
        title={ts ? ts.toLocaleString('es-MX') : ''}
      >
        {ts
          ? ts.toLocaleString('es-MX', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
          : '—'}
      </span>
    </li>
  )
}

function SessionRow({ session, revoking, onRevoke }) {
  const Icon = iconForUA(session.user_agent)
  return (
    <li className="flex items-center gap-3 px-4 py-3 hover:bg-ink-50 dark:hover:bg-ink-800/50 transition-colors">
      <div className="h-9 w-9 rounded-lg bg-ink-100 dark:bg-ink-800 flex items-center justify-center flex-shrink-0 text-ink-600 dark:text-ink-300">
        <Icon size={16} strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink-900 dark:text-ink-100 truncate" title={session.user_agent || ''}>
          {prettyUA(session.user_agent)}
        </p>
        <p className="text-[11px] text-ink-500 dark:text-ink-400 truncate tabular-nums">
          {session.ip ? <><span className="font-mono">{session.ip}</span> · </> : null}
          Iniciada {fmtDate(session.created_at)}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        leftIcon={<X size={13} />}
        loading={revoking}
        onClick={onRevoke}
        className="text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0"
      >
        Revocar
      </Button>
    </li>
  )
}
