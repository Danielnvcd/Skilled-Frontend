import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Users, Plus, Search, Trash2, KeyRound, ShieldCheck, ShieldOff } from 'lucide-react'
import {
  Button, Card, PageHeader, Badge, Modal, ConfirmDialog,
  EmptyState, Input, Select, Skeleton,
  Table, THead, TH, TBody, TR, TD,
  PasswordStrengthIndicator,
} from '../components/ui'
import UserAvatar from '../components/UserAvatar'
import { extractApiError } from '../utils/apiError'
import { useAuth } from '../context/AuthContext'
import {
  listarUsuarios, crearUsuario, eliminarUsuario, cambiarPasswordUsuario,
} from '../api/users'

const ROLE_LABELS = {
  super_admin: 'Super administrador',
  admin: 'Administrador',
  coordinador: 'Coordinador',
  inventario: 'Inventario',
  solicitante_material: 'Solicitante material',
}

const ROLE_TONES = {
  super_admin: 'brand',
  admin: 'info',
  coordinador: 'success',
  inventario: 'warning',
  solicitante_material: 'neutral',
}

const NEW_ROLES = ['admin', 'coordinador', 'inventario', 'solicitante_material']

function OnlineIndicator({ lastSeen }) {
  if (!lastSeen) {
    return <p className="text-[11px] text-ink-400 dark:text-ink-500">Nunca conectado</p>
  }
  const ms = Date.now() - new Date(lastSeen).getTime()
  const online = ms < 5 * 60 * 1000
  if (online) {
    return (
      <p className="text-[11px] inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_currentColor]" /> En línea
      </p>
    )
  }
  return (
    <p className="text-[11px] inline-flex items-center gap-1 text-ink-500 dark:text-ink-400">
      <span className="h-1.5 w-1.5 rounded-full bg-ink-300 dark:bg-ink-600" />
      {new Date(lastSeen).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
    </p>
  )
}

export default function Usuarios() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [openCreate, setOpenCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', role: 'coordinador' })

  const [openPwd, setOpenPwd] = useState(null)
  const [pwdValue, setPwdValue] = useState('')
  const [savingPwd, setSavingPwd] = useState(false)

  const [confirmDel, setConfirmDel] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = () => {
    setLoading(true)
    listarUsuarios()
      .then(setUsers)
      .catch((err) => toast.error(extractApiError(err, 'Error al cargar usuarios')))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return users
    const s = search.toLowerCase()
    return users.filter((u) =>
      u.username?.toLowerCase().includes(s) ||
      u.full_name?.toLowerCase().includes(s) ||
      u.role?.toLowerCase().includes(s),
    )
  }, [users, search])

  const handleCreate = async (e) => {
    e.preventDefault()
    setCreating(true)
    try {
      await crearUsuario(form)
      toast.success('Usuario creado')
      setOpenCreate(false)
      setForm({ username: '', password: '', role: 'coordinador' })
      load()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo crear el usuario'))
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDel) return
    setDeleting(true)
    try {
      await eliminarUsuario(confirmDel.id)
      setUsers((prev) => prev.filter((u) => u.id !== confirmDel.id))
      toast.success('Usuario eliminado')
      setConfirmDel(null)
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo eliminar el usuario'))
    } finally {
      setDeleting(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (!openPwd) return
    setSavingPwd(true)
    try {
      await cambiarPasswordUsuario(openPwd.id, pwdValue)
      toast.success('Contraseña actualizada')
      setOpenPwd(null)
      setPwdValue('')
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo actualizar la contraseña'))
    } finally {
      setSavingPwd(false)
    }
  }

  const isSelf = (u) => u.id === currentUser?.id
  const isProtectedAdmin = (u) => u.username === 'admin'

  return (
    <div>
      <PageHeader
        icon={Users}
        title="Usuarios"
        description="Administración de cuentas, roles y accesos del sistema."
        actions={<Button leftIcon={<Plus size={15} />} onClick={() => setOpenCreate(true)}>Nuevo usuario</Button>}
      />

      <Card className="!p-3 mb-5">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 dark:text-ink-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por usuario, nombre o rol..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full h-9 pl-9 pr-3 rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm text-ink-900 dark:text-ink-100 placeholder:text-ink-400 dark:placeholder:text-ink-500 focus:border-brand-500 dark:focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
          />
        </div>
      </Card>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState icon={Users} title="Sin usuarios" description="No hay usuarios que coincidan con la búsqueda." />
        </Card>
      ) : (
        <Table>
          <THead>
            <TH>Usuario</TH>
            <TH>Rol</TH>
            <TH>Nombre completo</TH>
            <TH>2FA</TH>
            <TH align="right">Acciones</TH>
          </THead>
          <TBody>
            {filtered.map((u) => {
              const blockedDelete = isSelf(u) || isProtectedAdmin(u)
              return (
                <TR key={u.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        id={u.id}
                        profilePic={u.profile_pic}
                        name={u.full_name || u.username}
                        size="sm"
                        lazy
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-ink-900 dark:text-ink-100 flex items-center gap-2">
                          {u.username}
                          {isSelf(u) && <span className="text-[10px] uppercase tracking-wider text-brand-600 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/30 px-1.5 py-0.5 rounded">Tú</span>}
                        </p>
                        <OnlineIndicator lastSeen={u.last_seen} />
                      </div>
                    </div>
                  </TD>
                  <TD>
                    <Badge tone={ROLE_TONES[u.role] || 'neutral'}>
                      {ROLE_LABELS[u.role] || u.role}
                    </Badge>
                  </TD>
                  <TD>{u.full_name || <span className="text-ink-400">—</span>}</TD>
                  <TD>
                    {u.totp_enabled ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                        <ShieldCheck size={13} /> Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-ink-500 dark:text-ink-400">
                        <ShieldOff size={13} /> Inactivo
                      </span>
                    )}
                  </TD>
                  <TD align="right">
                    <div className="inline-flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setOpenPwd(u)}
                        aria-label="Cambiar contraseña"
                        title="Cambiar contraseña"
                      >
                        <KeyRound size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={blockedDelete}
                        onClick={() => setConfirmDel({ id: u.id, name: u.username })}
                        aria-label="Eliminar"
                        title={blockedDelete ? (isSelf(u) ? 'No puedes eliminar tu propia cuenta' : 'El usuario admin no se puede eliminar') : 'Eliminar usuario'}
                      >
                        <Trash2 size={14} className={blockedDelete ? 'text-ink-300 dark:text-ink-600' : 'text-red-600 dark:text-red-400'} />
                      </Button>
                    </div>
                  </TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      )}

      <Modal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Nuevo usuario"
        description="Crea una cuenta con el rol correspondiente."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpenCreate(false)} disabled={creating}>Cancelar</Button>
            <Button type="submit" form="user-form" loading={creating}>Crear usuario</Button>
          </>
        }
      >
        <form id="user-form" onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Nombre de usuario"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
            autoFocus
          />
          <div>
            <Input
              label="Contraseña"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={8}
              placeholder="Mínimo 8 caracteres"
            />
            <PasswordStrengthIndicator password={form.password} className="mt-2" />
          </div>
          <Select label="Rol" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {NEW_ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </Select>
        </form>
      </Modal>

      <Modal
        open={!!openPwd}
        onClose={() => { setOpenPwd(null); setPwdValue('') }}
        title="Cambiar contraseña"
        description={openPwd ? `Actualiza la contraseña de ${openPwd.username}. Se cerrará la sesión del usuario en todos sus dispositivos.` : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setOpenPwd(null); setPwdValue('') }} disabled={savingPwd}>Cancelar</Button>
            <Button type="submit" form="pwd-form" leftIcon={<KeyRound size={15} />} loading={savingPwd}>Actualizar</Button>
          </>
        }
      >
        <form id="pwd-form" onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <Input
              label="Nueva contraseña"
              type="password"
              value={pwdValue}
              onChange={(e) => setPwdValue(e.target.value)}
              required
              autoFocus
              minLength={8}
              placeholder="Mínimo 8 caracteres"
            />
            <PasswordStrengthIndicator password={pwdValue} className="mt-2" />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Eliminar usuario"
        description={`Se eliminará el usuario "${confirmDel?.name}". Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        tone="danger"
      />
    </div>
  )
}
