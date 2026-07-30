import { useState } from 'react'
import { PanelLeft, Sun, Moon, RotateCw, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { Link } from 'react-router-dom'
import NotificacionesBell from './NotificacionesBell'
import AlertasBell from './AlertasBell'
import BajoMinimoBell from './BajoMinimoBell'
import UserAvatar from './UserAvatar'
import MenuSearch from './MenuSearch'
import { ConfirmDialog } from './ui'
import { reloadToLatest } from '../utils/forceReload'

export default function Topbar({ collapsed, setCollapsed, setMobileOpen, isMobileDevice = false }) {
  const { user, isAdmin, isInventario, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const [confirmLogout, setConfirmLogout] = useState(false)

  // En los roles inventario y coordinador, la versión móvil en modo claro usa el
  // logo alterno (logo1.png de /public); el resto mantiene logo.png.
  const usaLogoAlterno = ['inventario', 'coordinador'].includes(user?.role)
  const mobileLogo = (usaLogoAlterno && !isDark) ? '/logo1.png' : '/logo.png'

  // Trae la última versión desplegada. Le pide al service worker que busque
  // actualización, espera a que se active y recarga — sin vaciar el caché, que
  // era lo que hacía este botón lento y errático en producción.
  const [reloading, setReloading] = useState(false)
  const handleForceReload = () => {
    if (reloading) return
    setReloading(true)
    reloadToLatest()  // la página se va al terminar.
  }

  return (
    <>
    <header className="sticky top-0 z-30 bg-white/85 dark:bg-ink-900/85 backdrop-blur border-b border-ink-200 dark:border-ink-800">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 h-16">
        <div className="flex items-center gap-2 min-w-0">
          {isMobileDevice ? (
            <Link to="/" className="flex items-center" aria-label="Inicio">
              <img
                src={mobileLogo}
                alt="Skilled"
                className="h-8 max-w-[120px] object-contain"
                draggable={false}
              />
            </Link>
          ) : (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 focus-ring"
              aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            >
              <PanelLeft size={18} />
            </button>
          )}
          <MenuSearch />
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={handleForceReload}
            disabled={reloading}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 focus-ring transition-colors disabled:opacity-60"
            aria-label="Forzar recarga: obtener la última versión"
            title="Forzar recarga (obtener la última versión)"
          >
            <RotateCw size={18} className={reloading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={toggleTheme}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 focus-ring transition-colors"
            aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            title={isDark ? 'Modo claro' : 'Modo oscuro'}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Bajo mínimo: le importa sobre todo a inventario, que no es admin,
              por eso no va dentro de AlertasBell (limitada a admin). */}
          {(isAdmin || isInventario) && <BajoMinimoBell />}
          {isAdmin && <AlertasBell />}
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

          {/* Cerrar sesión: en escritorio el logout vive en el sidebar, así que
              este botón se muestra solo en móvil (donde no hay sidebar visible). */}
          <button
            onClick={() => setConfirmLogout(true)}
            className="sm:hidden inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-600 dark:text-ink-300 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600 dark:hover:text-rose-400 focus-ring transition-colors"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>

    <ConfirmDialog
      open={confirmLogout}
      onClose={() => setConfirmLogout(false)}
      onConfirm={() => { setConfirmLogout(false); logout() }}
      title="Cerrar sesión"
      description="¿Seguro que quieres cerrar tu sesión?"
      confirmLabel="Cerrar sesión"
      tone="warning"
    />
    </>
  )
}
