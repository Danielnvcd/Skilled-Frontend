import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { extractApiError } from '../utils/apiError'
import { useAuth } from '../context/AuthContext'
import {
  User, Building2, Briefcase, Factory, Phone, ShieldCheck, Save,
  KeyRound, ShieldAlert, ShieldOff, ArrowLeft, Mail, Lock,
} from 'lucide-react'
import {
  Button, Card, CardHeader, PageHeader, Badge, Input, Modal,
  PasswordStrengthIndicator,
} from '../components/ui'
import UserAvatar from '../components/UserAvatar'
import {
  obtenerUsuario, updateProfile, changeOwnPassword,
  setupTwoFa, confirmTwoFa, disableTwoFa,
} from '../api/auth'
import { useResource } from '../hooks/useResource'

export default function Profile() {
  const { id } = useParams()
  const { user: me, updateUser, logout } = useAuth()
  const viewingId = id ? Number(id) : null
  const isOwn = !viewingId || viewingId === me?.id
  const readonly = !isOwn

  const [form, setForm] = useState({ full_name: '', area: '', position: '', factory: '', contact_info: '' })
  const [profilePicFile, setProfilePicFile] = useState(null)
  const [saving, setSaving] = useState(false)

  const [pwdChangeOpen, setPwdChangeOpen] = useState(false)
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
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
      await refetch()
      toast.success('Perfil actualizado')
    } catch (err) {
      toast.error(extractApiError(err, 'Error al actualizar perfil'))
    } finally {
      setSaving(false)
    }
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
    setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
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
    setPwdSubmitting(true)
    try {
      await changeOwnPassword(user.id, {
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword,
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
    <div>
      <PageHeader
        icon={User}
        title={readonly ? `Perfil de ${user.full_name || user.username}` : 'Mi perfil'}
        description={readonly ? 'Información del miembro del equipo.' : 'Información personal y configuración de la cuenta.'}
        actions={
          readonly && (
            <Link to="/directorio">
              <Button variant="secondary" leftIcon={<ArrowLeft size={14} />}>Volver al directorio</Button>
            </Link>
          )
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 !p-6">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <UserAvatar
                id={user.id}
                profilePic={user.profile_pic}
                name={user.full_name || user.username}
                size="xl"
                className="!h-24 !w-24 !text-3xl ring-4 ring-white dark:ring-ink-900"
              />
              {isOnline && (
                <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-ink-900 shadow-[0_0_10px_currentColor] text-emerald-500" title="En línea" />
              )}
            </div>
            <h2 className="mt-4 text-base font-semibold text-ink-900 dark:text-ink-100">{user.full_name || user.username}</h2>
            <p className="text-sm text-ink-500 dark:text-ink-400">@{user.username}</p>
            <div className="mt-3 flex items-center gap-2 flex-wrap justify-center">
              <Badge tone="brand" leftIcon={<ShieldCheck size={11} />}>
                {user.role?.replace('_', ' ')}
              </Badge>
              {user.totp_enabled && <Badge tone="success" dot>2FA activo</Badge>}
            </div>
            {user.last_seen && (
              <p className="mt-2 text-[11px] text-ink-500 dark:text-ink-400">
                {isOnline
                  ? <span className="text-emerald-700 dark:text-emerald-400">En línea ahora</span>
                  : `Última conexión: ${new Date(user.last_seen).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
              </p>
            )}
          </div>
          <div className="mt-6 pt-6 border-t border-ink-100 dark:border-ink-800 space-y-3 text-sm">
            <Row icon={Briefcase} value={user.position} placeholder="Sin puesto asignado" />
            <Row icon={Building2} value={user.area} placeholder="Sin área asignada" />
            <Row icon={Factory} value={user.factory} placeholder="Sin planta asignada" />
            {user.contact_info && (
              <Row icon={user.contact_info.includes('@') ? Mail : Phone} value={user.contact_info} placeholder="" />
            )}
          </div>
        </Card>

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
                <CardHeader
                  title="Editar información"
                  description="Mantén actualizados tus datos para que el equipo pueda contactarte."
                />
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Input
                    label="Nombre completo"
                    leftIcon={<User size={14} />}
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  />
                  <div>
                    <label className="block text-xs font-medium text-ink-700 dark:text-ink-300 mb-1.5 tracking-wide">
                      Foto de perfil
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setProfilePicFile(e.target.files[0])}
                      className="block w-full text-sm text-ink-500 dark:text-ink-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 dark:file:bg-brand-900/40 dark:file:text-brand-300 dark:hover:file:bg-brand-800/60 transition-colors"
                    />
                    {profilePicFile && (
                      <p className="mt-1.5 text-xs text-ink-500">Seleccionado: {profilePicFile.name}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input label="Área" leftIcon={<Building2 size={14} />} value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
                    <Input label="Puesto" leftIcon={<Briefcase size={14} />} value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input label="Planta" leftIcon={<Factory size={14} />} value={form.factory} onChange={(e) => setForm({ ...form, factory: e.target.value })} />
                    <Input label="Contacto" leftIcon={<Phone size={14} />} value={form.contact_info} onChange={(e) => setForm({ ...form, contact_info: e.target.value })} placeholder="Email o teléfono" />
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button type="submit" loading={saving} leftIcon={<Save size={15} />}>
                      Guardar cambios
                    </Button>
                  </div>
                </form>
              </Card>

              <Card>
                <CardHeader
                  title="Contraseña"
                  description="Cambia tu contraseña periódicamente. Al guardarla se cierra tu sesión y debes volver a entrar."
                />
                <div className="flex items-center justify-between gap-4 p-4 bg-ink-50 dark:bg-ink-800/60 border border-ink-200 dark:border-ink-700 rounded-md">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-brand-50 dark:bg-brand-900/40 flex items-center justify-center">
                      <Lock size={18} className="text-brand-700 dark:text-brand-300" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">Cambiar contraseña</p>
                      <p className="text-xs text-ink-500 dark:text-ink-400">Necesitas tu contraseña actual para confirmar.</p>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" leftIcon={<KeyRound size={14} />} onClick={() => setPwdChangeOpen(true)}>
                    Cambiar
                  </Button>
                </div>
              </Card>

              <Card>
                <CardHeader
                  title="Verificación en dos pasos (2FA)"
                  description="Protege tu cuenta con un código adicional desde tu app autenticadora (Google Authenticator, Authy, 1Password)."
                />
                {user.totp_enabled ? (
                  <div className="flex items-center justify-between gap-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-md flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                        <ShieldCheck size={18} className="text-emerald-700 dark:text-emerald-300" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">2FA activado</p>
                        <p className="text-xs text-emerald-700 dark:text-emerald-400">Tu cuenta está protegida.</p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button variant="secondary" size="sm" leftIcon={<KeyRound size={14} />} onClick={startSetup2fa}>
                        Cambiar dispositivo
                      </Button>
                      <Button variant="ghost" size="sm" leftIcon={<ShieldOff size={14} />} onClick={() => setDisableOpen(true)} className="text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                        Desactivar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                        <ShieldAlert size={18} className="text-amber-700 dark:text-amber-300" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">2FA no configurado</p>
                        <p className="text-xs text-amber-700 dark:text-amber-400">Recomendamos activarlo.</p>
                      </div>
                    </div>
                    <Button leftIcon={<KeyRound size={14} />} onClick={startSetup2fa}>
                      Activar 2FA
                    </Button>
                  </div>
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
    </div>
  )
}

function Row({ icon: Icon, value, placeholder }) {
  return (
    <div className="flex items-center gap-2.5 text-ink-700 dark:text-ink-300">
      <Icon size={14} className="text-ink-400 dark:text-ink-500 flex-shrink-0" />
      <span className={value ? '' : 'italic text-ink-400 dark:text-ink-500'}>{value || placeholder}</span>
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
