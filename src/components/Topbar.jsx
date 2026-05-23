import { Menu, PanelLeft, Sun, Moon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { Link } from 'react-router-dom'
import NotificacionesBell from './NotificacionesBell'
import UserAvatar from './UserAvatar'
import MenuSearch from './MenuSearch'

export default function Topbar({ collapsed, setCollapsed, setMobileOpen }) {
  const { user, isAdmin } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <header className="sticky top-0 z-30 bg-white/85 dark:bg-ink-900/85 backdrop-blur border-b border-ink-200 dark:border-ink-800">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 h-16">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 focus-ring"
            aria-label="Abrir menú"
          >
            <Menu size={18} />
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 focus-ring"
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            <PanelLeft size={18} />
          </button>
          <MenuSearch />
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={toggleTheme}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 focus-ring transition-colors"
            aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            title={isDark ? 'Modo claro' : 'Modo oscuro'}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {isAdmin && <NotificacionesBell />}

          <Link to="/perfil" className="hidden sm:flex items-center gap-2 pl-3 ml-1 py-1 border-l border-ink-200 dark:border-ink-800 hover:bg-ink-50 dark:hover:bg-ink-800/50 transition-colors rounded-r-md">
            <div className="text-right">
              <p className="text-sm font-medium text-ink-900 dark:text-ink-100 leading-tight">{user?.full_name || user?.username}</p>
              <p className="text-[11px] text-ink-500 dark:text-ink-400 leading-tight capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
            <UserAvatar
              id={user?.id}
              profilePic={user?.profile_pic}
              name={user?.full_name || user?.username}
              size="md"
            />
          </Link>
        </div>
      </div>
    </header>
  )
}
