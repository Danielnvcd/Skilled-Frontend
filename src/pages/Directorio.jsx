import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Users, Search, Briefcase, Building2, Factory, Phone, Mail, ShieldCheck, IdCard } from 'lucide-react'
import { Card, PageHeader, Badge, EmptyState, Skeleton } from '../components/ui'
import UserAvatar from '../components/UserAvatar'
import { listarDirectorio } from '../api/auth'
import { extractApiError } from '../utils/apiError'

const ROLE_TONES = {
  super_admin: 'brand',
  admin: 'info',
  coordinador: 'success',
  inventario: 'warning',
  solicitante_material: 'neutral',
}

const ROLE_LABELS = {
  super_admin: 'Super admin',
  admin: 'Administrador',
  coordinador: 'Coordinador',
  inventario: 'Inventario',
  solicitante_material: 'Solicitante',
}

const ROLE_ORDER = { super_admin: 0, admin: 1, coordinador: 2, inventario: 3, solicitante_material: 4 }

function isOnline(lastSeen) {
  if (!lastSeen) return false
  return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000
}

export default function Directorio() {
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [areaFilter, setAreaFilter] = useState('todas')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listarDirectorio()
      .then(setUsers)
      .catch((err) => {
        toast.error(extractApiError(err, 'Error al cargar directorio'))
        setUsers([])
      })
      .finally(() => setLoading(false))
  }, [])

  const areas = useMemo(() => {
    const set = new Set(users.map((u) => u.area).filter(Boolean))
    return ['todas', ...Array.from(set).sort()]
  }, [users])

  const filtered = useMemo(() => {
    let list = users
    if (areaFilter !== 'todas') list = list.filter((u) => u.area === areaFilter)
    if (search.trim()) {
      const s = search.toLowerCase()
      list = list.filter((u) =>
        u.username?.toLowerCase().includes(s) ||
        u.full_name?.toLowerCase().includes(s) ||
        u.position?.toLowerCase().includes(s) ||
        u.area?.toLowerCase().includes(s) ||
        u.factory?.toLowerCase().includes(s),
      )
    }
    return [...list].sort((a, b) => {
      const ra = ROLE_ORDER[a.role] ?? 99
      const rb = ROLE_ORDER[b.role] ?? 99
      if (ra !== rb) return ra - rb
      return (a.full_name || a.username || '').localeCompare(b.full_name || b.username || '')
    })
  }, [users, search, areaFilter])

  return (
    <div>
      <PageHeader
        title="Directorio del equipo"
        description="Listado de personas registradas en la plataforma."
      />

      <Card className="!p-3 mb-5">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 dark:text-ink-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por nombre, puesto, área o planta..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block w-full h-9 pl-9 pr-3 rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm text-ink-900 dark:text-ink-100 placeholder:text-ink-400 dark:placeholder:text-ink-500 focus:border-brand-500 dark:focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
            />
          </div>
          {areas.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {areas.map((a) => (
                <button
                  key={a}
                  onClick={() => setAreaFilter(a)}
                  className={`px-3 h-9 rounded-md text-xs font-medium border transition-colors ${areaFilter === a ? 'bg-brand-800 dark:bg-brand-600 text-white border-brand-800 dark:border-brand-600' : 'bg-white dark:bg-ink-800 text-ink-700 dark:text-ink-300 border-ink-200 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-700'}`}
                >
                  {a === 'todas' ? 'Todas las áreas' : a}
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card><EmptyState icon={Users} title="Sin resultados" description="No hay usuarios que coincidan con los filtros." /></Card>
      ) : (
        <>
          <p className="text-xs text-ink-500 dark:text-ink-400 mb-4">
            {filtered.length} {filtered.length === 1 ? 'persona' : 'personas'}{areaFilter !== 'todas' ? ` en ${areaFilter}` : ''}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((u) => (
              <UserCard key={u.id} user={u} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function UserCard({ user }) {
  const online = isOnline(user.last_seen)

  return (
    <Card className="!p-0 overflow-hidden flex flex-col group hover:shadow-elevated transition-shadow">
      <div className="relative h-20 bg-gradient-to-br from-brand-600/20 via-brand-500/10 to-brand-400/20 dark:from-brand-900/50 dark:via-brand-800/30 dark:to-brand-700/40">
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2">
          <div className="relative">
            <UserAvatar
              id={user.id}
              profilePic={user.profile_pic}
              name={user.full_name || user.username}
              size="xl"
              lazy
              className="!h-20 !w-20 !text-2xl ring-2 ring-ink-200 dark:ring-ink-700 shadow-lg"
            />
            {online && (
              <span
                className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-ink-900 shadow-[0_0_8px_currentColor] text-emerald-500"
                title="En línea"
              />
            )}
          </div>
        </div>
      </div>

      <div className="pt-12 pb-4 px-4 flex-1 flex flex-col text-center">
        <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-100 truncate">
          {user.full_name || user.username}
        </h3>
        <p className="text-[11px] text-ink-500 dark:text-ink-400 mb-2">@{user.username}</p>

        <div className="flex items-center justify-center gap-1.5 mb-3 flex-wrap">
          <Badge tone={ROLE_TONES[user.role] || 'neutral'}>
            {ROLE_LABELS[user.role] || user.role}
          </Badge>
          {user.totp_enabled && (
            <span title="2FA activo" className="inline-flex items-center text-[10px] text-emerald-700 dark:text-emerald-400">
              <ShieldCheck size={11} />
            </span>
          )}
        </div>

        <div className="space-y-1.5 text-xs text-ink-600 dark:text-ink-300 mb-4 text-left">
          {user.trabajador_no_empleado && (
            <div className="flex items-center gap-2 truncate">
              <IdCard size={11} className="text-ink-400 dark:text-ink-500 flex-shrink-0" />
              <span className="truncate font-mono">{user.trabajador_no_empleado}</span>
            </div>
          )}
          {user.position && (
            <div className="flex items-center gap-2 truncate">
              <Briefcase size={11} className="text-ink-400 dark:text-ink-500 flex-shrink-0" />
              <span className="truncate">{user.position}</span>
            </div>
          )}
          {user.area && (
            <div className="flex items-center gap-2 truncate">
              <Building2 size={11} className="text-ink-400 dark:text-ink-500 flex-shrink-0" />
              <span className="truncate">{user.area}</span>
            </div>
          )}
          {user.factory && (
            <div className="flex items-center gap-2 truncate">
              <Factory size={11} className="text-ink-400 dark:text-ink-500 flex-shrink-0" />
              <span className="truncate">{user.factory}</span>
            </div>
          )}
          {user.contact_info && (
            <div className="flex items-center gap-2 truncate" title={user.contact_info}>
              {user.contact_info.includes('@') ? <Mail size={11} className="text-ink-400 dark:text-ink-500 flex-shrink-0" /> : <Phone size={11} className="text-ink-400 dark:text-ink-500 flex-shrink-0" />}
              <span className="truncate">{user.contact_info}</span>
            </div>
          )}
          {!user.trabajador_no_empleado && !user.position && !user.area && !user.factory && !user.contact_info && (
            <p className="text-[11px] italic text-ink-400 dark:text-ink-500 text-center">Perfil sin información adicional</p>
          )}
        </div>

        <Link
          to={`/perfil/${user.id}`}
          className="mt-auto inline-flex items-center justify-center h-8 px-4 rounded-full text-xs font-semibold border border-brand-700 dark:border-brand-400 text-brand-700 dark:text-brand-300 hover:bg-brand-700 dark:hover:bg-brand-600 hover:text-white transition-colors focus-ring"
        >
          Ver perfil
        </Link>
      </div>
    </Card>
  )
}
