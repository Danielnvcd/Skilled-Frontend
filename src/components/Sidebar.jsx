import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ConfirmDialog } from './ui'
import {
  Home,
  User,
  Users,
  UserCog,
  FolderOpen,
  Clock,
  DollarSign,
  HandCoins,
  Settings2,
  IdCard,
  PieChart,
  FileClock,
  History,
  ChevronLeft,
  ChevronRight,
  LogOut,
  X,
} from 'lucide-react'

const accountGroup = {
  label: 'Cuenta',
  items: [
    { path: '/', label: 'Inicio', icon: Home, end: true },
    { path: '/perfil', label: 'Mi perfil', icon: User },
    { path: '/directorio', label: 'Directorio', icon: Users },
  ],
}

const operacionGroup = {
  label: 'Operación',
  items: [
    { path: '/empleados', label: 'Empleados', icon: UserCog },
    { path: '/credenciales', label: 'Credenciales', icon: IdCard },
    { path: '/proyectos', label: 'Proyectos', icon: FolderOpen },
    { path: '/horas', label: 'Horas', icon: Clock },
    { path: '/prenomina', label: 'Prenómina', icon: DollarSign, requiresAdmin: true },
    { path: '/proyecto-total', label: 'Proyecto Total', icon: PieChart, requiresAdmin: true },
    { path: '/historico', label: 'Histórico nóminas', icon: FileClock, requiresAdmin: true },
    { path: '/prestamos', label: 'Préstamos', icon: HandCoins, requiresAdmin: true },
    { path: '/ajustes', label: 'Ajustes Inbursa', icon: Settings2, requiresAdmin: true },
  ],
}

const adminGroup = {
  label: 'Administración',
  items: [
    { path: '/usuarios', label: 'Usuarios', icon: Users },
    { path: '/bitacora', label: 'Bitácora', icon: History },
  ],
}

function NavItem({ item, compact }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.path}
      end={item.end}
      title={compact ? item.label : undefined}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-md mx-2 px-2.5 py-2 text-sm transition-colors focus-ring ${
          isActive
            ? 'bg-white/10 text-white font-medium'
            : 'text-ink-300 hover:bg-white/5 hover:text-white'
        } ${compact ? 'justify-center' : ''}`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-brand-300" />
          )}
          <Icon size={18} strokeWidth={1.75} className="flex-shrink-0" />
          {!compact && <span className="truncate">{item.label}</span>}
        </>
      )}
    </NavLink>
  )
}

function NavGroup({ group, compact, isAdmin }) {
  const items = group.items.filter((item) => !item.requiresAdmin || isAdmin)
  if (items.length === 0) return null
  return (
    <div className="mb-3">
      {!compact ? (
        <p className="px-4 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-400/70">
          {group.label}
        </p>
      ) : (
        <div className="mx-3 my-2 h-px bg-white/5" />
      )}
      <div className="space-y-0.5">
        {items.map((item) => (
          <NavItem key={item.path} item={item} compact={compact} />
        ))}
      </div>
    </div>
  )
}

export default function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) {
  const { user, logout, isAdmin, isSuperAdmin } = useAuth()
  const [confirmLogout, setConfirmLogout] = useState(false)

  const compact = collapsed && !mobileOpen

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink-950/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`fixed left-0 top-0 z-50 h-full bg-brand-950 text-ink-100 flex flex-col transition-all duration-300 border-r border-white/5
          ${collapsed ? 'lg:w-16' : 'lg:w-64'}
          ${mobileOpen ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0 w-72'}
        `}
      >
        <div className="h-16 flex items-center justify-center border-b border-white/5 relative px-4">
          <img
            src={compact ? '/logo_sidebar.png' : '/logo.png'}
            alt="Logo"
            className={compact ? 'h-9 w-9 object-contain' : 'h-10 max-w-full object-contain'}
            draggable={false}
          />

          {mobileOpen && (
            <button
              onClick={() => setMobileOpen(false)}
              className="lg:hidden absolute right-4 h-8 w-8 inline-flex items-center justify-center rounded-md text-ink-300 hover:bg-white/10 hover:text-white focus-ring"
              aria-label="Cerrar menú"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-dark py-3">
          <NavGroup group={accountGroup} compact={compact} isAdmin={isAdmin} />
          <NavGroup group={operacionGroup} compact={compact} isAdmin={isAdmin} />
          {isAdmin && <NavGroup group={adminGroup} compact={compact} isAdmin={isAdmin} />}
        </nav>

        <div className={`border-t border-white/5 ${compact ? 'p-2' : 'p-3'}`}>
          {compact ? (
            <button
              onClick={() => setConfirmLogout(true)}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="h-9 w-9 mx-auto inline-flex items-center justify-center rounded-md text-ink-300 hover:bg-white/10 hover:text-white focus-ring transition-colors"
            >
              <LogOut size={17} />
            </button>
          ) : (
            <button
              onClick={() => setConfirmLogout(true)}
              className="w-full inline-flex items-center justify-center gap-2 px-2.5 py-2 rounded-md text-sm text-ink-300 hover:bg-white/5 hover:text-white border border-white/5 hover:border-white/10 transition-colors focus-ring"
            >
              <LogOut size={15} />
              Cerrar sesión
            </button>
          )}
        </div>
      </aside>

      <ConfirmDialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={() => { setConfirmLogout(false); logout() }}
        title="Cerrar sesión"
        description={`¿Seguro que quieres cerrar la sesión${user?.fullName || user?.username ? ` de ${user.fullName || user.username}` : ''}?`}
        confirmLabel="Cerrar sesión"
        cancelLabel="Cancelar"
      />
    </>
  )
}
