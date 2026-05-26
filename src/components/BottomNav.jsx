import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { BOTTOM_NAV } from '../config/menus'

export default function BottomNav() {
  const { user } = useAuth()
  if (!user) return null
  const items = BOTTOM_NAV[user.role] ?? BOTTOM_NAV.admin

  return (
    <nav
      role="navigation"
      aria-label="Navegación móvil"
      className="fixed bottom-0 inset-x-0 z-30 border-t border-ink-200 dark:border-ink-800 bg-white/95 dark:bg-ink-950/95 backdrop-blur supports-[backdrop-filter]:bg-white/80"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <ul className="flex justify-around">
        {items.map(it => {
          const Icon = it.icon
          return (
            <li key={it.path} className="flex-1">
              <NavLink
                to={it.path}
                end={it.end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2 px-1 text-[10px] font-medium transition-colors ${
                    isActive
                      ? 'text-brand-600 dark:text-brand-400'
                      : 'text-ink-500 hover:text-ink-900 dark:hover:text-ink-100'
                  }`
                }
              >
                {Icon && <Icon size={20} strokeWidth={2} />}
                <span className="truncate max-w-full">{it.label}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
