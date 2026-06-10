import { Outlet, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import BottomNav from './BottomNav'
import Breadcrumbs from './Breadcrumbs'
import ShortcutsHelp from './ShortcutsHelp'
import useIsMobileDevice from '../hooks/useIsMobileDevice'
import useGlobalShortcuts from '../hooks/useGlobalShortcuts'

const STORAGE_KEY = 'sidebar:collapsed'

function readInitial() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(readInitial)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const mainRef = useRef(null)
  const isMobileDevice = useIsMobileDevice()

  // Atajos `g + letra` tipo Linear/GitHub. El hook se autodesactiva en
  // inputs y filtra destinos por rol — no rompe el tecleo en formularios.
  useGlobalShortcuts()

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0') } catch {}
  }, [collapsed])

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    el.classList.remove('page-fade')
    void el.offsetWidth
    el.classList.add('page-fade')
  }, [location.pathname])

  return (
    // overflow-x-CLIP (no hidden): hidden convierte este div en el contenedor
    // de referencia de position:sticky y el Topbar dejaba de pegarse al hacer
    // scroll; clip recorta el desborde horizontal sin crear scroll container.
    <div className="min-h-screen relative overflow-x-clip">
      {/* Fondo base global. Va en -z-20 para que cada página pueda meter su propio
          fondo (p. ej. video HLS) en -z-10 sin que el bg lo tape. */}
      <div className="fixed inset-0 -z-20 bg-ink-50 dark:bg-ink-950 pointer-events-none" />
      {!isMobileDevice && (
        <Sidebar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
        />
      )}
      <div
        className={`min-w-0 transition-all duration-300 ${
          isMobileDevice ? '' : collapsed ? 'pl-16' : 'pl-64'
        }`}
      >
        <Topbar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          setMobileOpen={setMobileOpen}
          isMobileDevice={isMobileDevice}
        />
        <main
          ref={mainRef}
          className={`px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-[1500px] mx-auto ${
            isMobileDevice ? 'pb-8' : 'pb-8'
          }`}
          style={isMobileDevice
            ? { paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 6rem)' }
            : undefined}
        >
          <Breadcrumbs />
          <Outlet />
        </main>
      </div>
      {isMobileDevice && <BottomNav />}
      {/* Overlay de atajos — abre con `?`, autocontenido (listener propio). */}
      <ShortcutsHelp />
    </div>
  )
}


