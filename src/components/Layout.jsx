import { Outlet, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

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
    <div className="min-h-screen relative overflow-x-hidden">
      {/* Fondo base global. Va en -z-20 para que cada página pueda meter su propio
          fondo (p. ej. video HLS) en -z-10 sin que el bg lo tape. */}
      <div className="fixed inset-0 -z-20 bg-ink-50 dark:bg-ink-950 pointer-events-none" />
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      <div className={`min-w-0 transition-all duration-300 ${collapsed ? 'lg:pl-16' : 'lg:pl-64'}`}>
        <Topbar collapsed={collapsed} setCollapsed={setCollapsed} setMobileOpen={setMobileOpen} />
        <main ref={mainRef} className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-[1500px] mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}


