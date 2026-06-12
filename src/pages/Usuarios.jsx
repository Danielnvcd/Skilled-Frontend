import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Users, Plus, Search, Trash2, KeyRound, ShieldCheck, ShieldOff, Pencil, Camera, X, IdCard } from 'lucide-react'
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
  listarUsuarios, crearUsuario, eliminarUsuario, cambiarPasswordUsuario, actualizarUsuario,
  subirFotoUsuario,
} from '../api/users'
import { listarTrabajadores } from '../api/trabajadores'
import { useResource } from '../hooks/useResource'

const ROLE_LABELS = {
  super_admin: 'Super administrador',
  admin: 'Administrador',
  finanzas: 'Finanzas',
  coordinador: 'Coordinador',
  inventario: 'Inventario',
  solicitante_material: 'Solicitante material',
}

const ROLE_TONES = {
  super_admin: 'brand',
  admin: 'info',
  finanzas: 'violet',
  coordinador: 'success',
  inventario: 'warning',
  solicitante_material: 'neutral',
}

const NEW_ROLES = ['admin', 'finanzas', 'coordinador', 'inventario', 'solicitante_material']

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

function ComboboxTrabajadores({ trabajadores, value, onChange }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selected = trabajadores.find(t => String(t.id) === String(value))
  
  const filtered = trabajadores.filter(t => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    const fullName = `${t.nombre || ''} ${t.nombre_apellidos || ''}`.toLowerCase()
    return (
      t.no_empleado?.toLowerCase().includes(q) ||
      fullName.includes(q)
    )
  })

  return (
    <div className="relative w-full" ref={ref}>
      <div 
        className="block w-full h-9 px-3 rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm text-left flex items-center justify-between cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        onClick={() => { setOpen(!open); if (!open) setSearch(''); }}
      >
        <span className="truncate text-ink-900 dark:text-ink-100">
          {selected ? `${selected.no_empleado} — ${selected.nombre} ${selected.nombre_apellidos || ''}`.trim() : '— Sin ligar —'}
        </span>
        <span className="text-ink-400 ml-2 text-xs">▼</span>
      </div>

      {open && (
        <div className="absolute z-50 w-full mb-1 bottom-full bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-md shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col">
          <div className="p-2 border-b border-ink-100 dark:border-ink-800">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
              <input
                type="text"
                autoFocus
                placeholder="Buscar por nombre o número…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-8 pl-8 pr-3 text-sm bg-ink-50 dark:bg-ink-950 border border-ink-200 dark:border-ink-800 rounded outline-none focus:border-brand-500"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            <div 
              className={`px-3 py-2 text-sm cursor-pointer hover:bg-ink-50 dark:hover:bg-ink-800 ${!value ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300 font-medium' : 'text-ink-700 dark:text-ink-300'}`}
              onClick={() => { onChange(''); setOpen(false) }}
            >
              — Sin ligar —
            </div>
            {filtered.slice(0, 100).map(t => (
              <div
                key={t.id}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-ink-50 dark:hover:bg-ink-800 truncate ${String(t.id) === String(value) ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300 font-medium' : 'text-ink-700 dark:text-ink-300'}`}
                onClick={() => { onChange(String(t.id)); setOpen(false) }}
              >
                {t.no_empleado} — {`${t.nombre} ${t.nombre_apellidos || ''}`.trim()}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-3 text-sm text-center text-ink-500">No se encontraron empleados.</div>
            )}
            {filtered.length > 100 && (
              <div className="px-3 py-2 text-xs text-center text-ink-400 border-t border-ink-100 dark:border-ink-800 bg-ink-50 dark:bg-ink-900/50">
                Mostrando 100 de {filtered.length}. Usa el buscador para refinar.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


export default function Usuarios() {
  const { user: currentUser } = useAuth()
  const [search, setSearch] = useState('')

  const [openCreate, setOpenCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', role: 'coordinador' })

  const [openPwd, setOpenPwd] = useState(null)
  const [pwdValue, setPwdValue] = useState('')
  const [savingPwd, setSavingPwd] = useState(false)

  const [confirmDel, setConfirmDel] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const [openEdit, setOpenEdit] = useState(null)
  const [editForm, setEditForm] = useState({
    full_name: '', area: '', position: '', factory: '', contact_info: '',
    trabajador_id: '',
  })
  const [savingEdit, setSavingEdit] = useState(false)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const fileInputRef = useRef(null)

  // Catálogo de empleados activos para el selector de "Liga a empleado".
  // Lo cargamos una vez en background; el dropdown filtra localmente.
  const [trabajadores, setTrabajadores] = useState([])
  const [loadingTrab, setLoadingTrab] = useState(false)
  const [trabSearch, setTrabSearch] = useState('')

  const {
    data: rawUsers,
    loading,
    error,
    refetch,
  } = useResource(
    'usuarios',
    () => listarUsuarios(),
    {
      staleMs: 30_000,
      invalidateOn: ['usuario:changed'],
    },
  )
  const users = rawUsers ?? []

  useEffect(() => {
    if (error) toast.error(extractApiError(error, 'Error al cargar usuarios'))
  }, [error])

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
      await refetch()
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
      toast.success('Usuario eliminado')
      setConfirmDel(null)
      await refetch()
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

  const startEdit = (u) => {
    setEditForm({
      full_name: u.full_name || '',
      area: u.area || '',
      position: u.position || '',
      factory: u.factory || '',
      contact_info: u.contact_info || '',
      trabajador_id: u.trabajador_id || '',
    })
    setPhotoFile(null)
    setPhotoPreview(null)
    setTrabSearch('')
    setOpenEdit(u)
    // Carga diferida: solo al abrir el modal por primera vez.
      if (trabajadores.length === 0 && !loadingTrab) {
        setLoadingTrab(true)
        // per_page=5000 para cargar todos los activos al editar.
        listarTrabajadores({ page: 1, perPage: 5000, estado: 'todos' })
          .then((res) => setTrabajadores(res?.items || []))
          .catch(() => toast.error('No se pudieron cargar los empleados'))
          .finally(() => setLoadingTrab(false))
      }
  }

  const closeEdit = () => {
    setOpenEdit(null)
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoPreview(null)
    setPhotoFile(null)
  }

  const onPickPhoto = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!/^image\//.test(f.type)) {
      toast.error('Selecciona un archivo de imagen (JPG o PNG)')
      e.target.value = ''
      return
    }
    if (f.size > 8 * 1024 * 1024) {
      toast.error('La imagen no puede pesar más de 8MB')
      e.target.value = ''
      return
    }
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoFile(f)
    setPhotoPreview(URL.createObjectURL(f))
  }

  const clearPhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoFile(null)
    setPhotoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!openEdit) return
    setSavingEdit(true)
    try {
      // 1. Texto: PUT JSON. trabajador_id puede ser '' (= desvincular) o int.
      const payload = { ...editForm }
      payload.trabajador_id = payload.trabajador_id === '' ? null : Number(payload.trabajador_id)
      await actualizarUsuario(openEdit.id, payload)
      // 2. Foto: POST multipart (solo si el admin eligió una nueva)
      if (photoFile) await subirFotoUsuario(openEdit.id, photoFile)
      toast.success(photoFile ? 'Usuario y foto actualizados' : 'Usuario actualizado')
      closeEdit()
      await refetch()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo actualizar el usuario'))
    } finally {
      setSavingEdit(false)
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
            <TH>Empleado ligado</TH>
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
                    {u.trabajador_id ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                        <IdCard size={13} />
                        <span className="font-mono">{u.trabajador_no_empleado}</span>
                        <span className="text-ink-500 dark:text-ink-400 truncate max-w-[120px]">{u.trabajador_nombre}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-ink-400 dark:text-ink-500">Sin ligar</span>
                    )}
                  </TD>
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
                        onClick={() => startEdit(u)}
                        aria-label="Editar usuario"
                        title="Editar nombre, área, rol y contacto"
                      >
                        <Pencil size={14} />
                      </Button>
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

      <Modal
        open={!!openEdit}
        onClose={closeEdit}
        title={openEdit ? `Editar perfil — ${openEdit.username}` : 'Editar perfil'}
        description="Actualiza la foto, datos de contacto y área del usuario."
        footer={
          <>
            <Button variant="secondary" onClick={closeEdit} disabled={savingEdit}>Cancelar</Button>
            <Button type="submit" form="edit-user-form" loading={savingEdit}>Guardar cambios</Button>
          </>
        }
      >
        <form id="edit-user-form" onSubmit={handleSaveEdit} className="space-y-3">
          {openEdit && (
            <div className="flex items-center gap-4 rounded-md border border-ink-200 dark:border-ink-700 bg-ink-50 dark:bg-ink-800/40 px-3 py-3">
              <div className="relative flex-shrink-0">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Nueva foto"
                    className="h-16 w-16 rounded-full object-cover ring-2 ring-brand-500 ring-offset-2 ring-offset-white dark:ring-offset-ink-900"
                  />
                ) : (
                  <UserAvatar
                    id={openEdit.id}
                    profilePic={openEdit.profile_pic}
                    name={openEdit.full_name || openEdit.username}
                    size="lg"
                  />
                )}
                {photoPreview && (
                  <button
                    type="button"
                    onClick={clearPhoto}
                    className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-rose-500 text-white shadow inline-flex items-center justify-center hover:bg-rose-600"
                    title="Descartar nueva foto"
                    aria-label="Descartar foto"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs text-ink-500 dark:text-ink-400">Rol</span>
                  <Badge tone={ROLE_TONES[openEdit.role] || 'neutral'}>
                    {ROLE_LABELS[openEdit.role] || openEdit.role}
                  </Badge>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={onPickPhoto}
                  className="hidden"
                  id="user-foto-input"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  leftIcon={<Camera size={13} />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {photoPreview ? 'Elegir otra' : 'Cambiar foto'}
                </Button>
                {photoFile && (
                  <p className="text-[10px] text-ink-500 dark:text-ink-400 mt-1 truncate">
                    {photoFile.name} · {(photoFile.size / 1024).toFixed(0)} KB
                  </p>
                )}
              </div>
            </div>
          )}
          <Input
            label="Nombre completo"
            value={editForm.full_name}
            onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
            placeholder="Nombre del usuario"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Área"
              value={editForm.area}
              onChange={(e) => setEditForm({ ...editForm, area: e.target.value })}
            />
            <Input
              label="Puesto"
              value={editForm.position}
              onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Planta"
              value={editForm.factory}
              onChange={(e) => setEditForm({ ...editForm, factory: e.target.value })}
            />
            <Input
              label="Contacto"
              value={editForm.contact_info}
              onChange={(e) => setEditForm({ ...editForm, contact_info: e.target.value })}
              placeholder="Correo o teléfono"
            />
          </div>
          {/* Liga a empleado (RRHH) — habilita asignaciones de herramienta */}
          <div className="border-t border-ink-200 dark:border-ink-700 pt-3 mt-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-ink-700 dark:text-ink-300 inline-flex items-center gap-1.5">
                <IdCard size={14} /> Liga a empleado
              </label>
              {editForm.trabajador_id && (
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, trabajador_id: '' })}
                  className="text-xs text-rose-600 hover:underline"
                >
                  Desvincular
                </button>
              )}
            </div>
            {loadingTrab ? (
              <Skeleton className="h-9 w-full rounded-md" />
            ) : (
              <>
                <ComboboxTrabajadores 
                  trabajadores={trabajadores}
                  value={editForm.trabajador_id}
                  onChange={(val) => setEditForm({ ...editForm, trabajador_id: val })}
                />
                <p className="text-[11px] text-ink-500 dark:text-ink-400 mt-1">
                  Necesario para que solicitantes y coordinadores vean sus herramientas asignadas como empleado.
                </p>
              </>
            )}
          </div>

          <p className="text-[11px] text-ink-500 dark:text-ink-400">
            El rol no es editable desde aquí por seguridad. Si necesitas cambiarlo, elimina la cuenta y vuelve a crearla con el rol correcto.
          </p>
        </form>
      </Modal>
    </div>
  )
}
