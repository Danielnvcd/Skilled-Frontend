import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import api, { armProactiveRefresh, cancelProactiveRefresh, setLoggingOut } from '../api/axios'
import { clearAll as clearResourceCache } from '../utils/resourceCache'
import { clearBlobCache } from '../hooks/useAuthenticatedBlob'

const AuthContext = createContext(null)

// Limpia los caches globales (datos de useResource + blob URLs de fotos).
// Llamar en cualquier cambio de identidad: sin esto, la cuenta nueva ve datos
// privados de la cuenta anterior antes del refetch, o (peor) los ve permanente
// si su request al endpoint correspondiente regresa 403/404.
function purgeUserScopedCaches() {
  try { clearResourceCache() } catch { /* noop */ }
  try { clearBlobCache() } catch { /* noop */ }
}

function buildPerms(user) {
  const role = user?.role
  const isSuperAdmin = role === 'super_admin'
  // `isAdmin` = acceso a la operación de RRHH/nómina. `sistemas` NO entra aquí
  // a propósito: administra el sistema (cuentas, sesiones, servidor), no los
  // sueldos ni los expedientes. Espeja `is_admin()` del backend.
  const isAdmin = role === 'admin' || isSuperAdmin
  // Eje independiente: administración del sistema. super_admin cruza los dos
  // porque es la cuenta de recuperación.
  const isSistemas = role === 'sistemas'
  const puedeGestionarSistema = isSistemas || isSuperAdmin
  const isCoordinador = role === 'coordinador'
  const isInventario = role === 'inventario'
  const isSolicitante = role === 'solicitante_material'
  const isFinanzas = role === 'finanzas'
  return {
    role,
    isSuperAdmin,
    isAdmin,
    isSistemas,
    puedeGestionarSistema,
    isCoordinador,
    isInventario,
    isSolicitante,
    isFinanzas,
    // El panel de sistemas exige 2FA; lo reflejamos en el cliente para poder
    // mandar a inscribirlo ANTES de que el backend devuelva 403 y la pantalla
    // quede en un error seco. El backend sigue siendo la autoridad.
    tiene2fa: !!user?.totp_enabled,
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')
    if (!token || !storedUser) {
      setLoading(false)
      return
    }
    setUser(JSON.parse(storedUser))
    // AbortController + flag de cancelación: si el componente se desmonta
    // (por logout rápido, hot-reload o navegación) antes de que /auth/me
    // responda, no llamamos a setUser con datos viejos — eso re-logueaba
    // al usuario que acababa de cerrar sesión durante el gap del fade-out.
    const controller = new AbortController()
    let cancelled = false
    api.get('/auth/me', { signal: controller.signal })
      .then((res) => {
        if (cancelled) return
        setUser(res.data)
        localStorage.setItem('user', JSON.stringify(res.data))
      })
      .catch((err) => {
        if (cancelled || err?.name === 'CanceledError' || err?.name === 'AbortError') return
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        setUser(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  // Sincroniza el state del provider cuando:
  //   - performRefresh() en esta pestaña actualiza el user con datos frescos
  //     del backend (rol, foto, perfil, etc.) → emite 'auth:user-updated'.
  //   - Otra pestaña actualiza `localStorage.user` (perfil editado allá) →
  //     el listener `storage` de axios.js reemite el mismo evento.
  // Sin esto, el state de React quedaba stale hasta el próximo F5.
  useEffect(() => {
    const handler = (e) => {
      const next = e.detail
      if (next && typeof next === 'object') setUser(next)
    }
    window.addEventListener('auth:user-updated', handler)
    return () => window.removeEventListener('auth:user-updated', handler)
  }, [])

  const login = async (username, password, remember = false) => {
    // Apaga el flag por si el usuario cerró sesión y vuelve a entrar en la
    // misma pestaña sin recargar. Sin esto, performRefresh post-login no
    // escribiría el token nuevo.
    setLoggingOut(false)
    const res = await api.post('/auth/login', { username, password, remember })
    if (res.data.requires2fa) {
      return { requires2fa: true, username, stepToken: res.data.stepToken }
    }
    // Purga caches ANTES de marcar al user nuevo: garantiza que cualquier
    // componente que se monte tras setUser vea cache vacío y dispare su fetch.
    purgeUserScopedCaches()
    localStorage.setItem('token', res.data.token)
    localStorage.setItem('user', JSON.stringify(res.data.user))
    armProactiveRefresh(res.data.token)
    setUser(res.data.user)
    return { requires2fa: false }
  }

  const verify2fa = async (stepToken, code) => {
    setLoggingOut(false)
    const res = await api.post('/auth/verify-2fa', { stepToken, code })
    purgeUserScopedCaches()
    localStorage.setItem('token', res.data.token)
    localStorage.setItem('user', JSON.stringify(res.data.user))
    armProactiveRefresh(res.data.token)
    setUser(res.data.user)
  }

  const logout = async () => {
    // Activa el flag global ANTES de cualquier await: si hay un performRefresh
    // en vuelo (timer proactivo o interceptor reactivo), su .then verá el flag
    // y no reescribirá el token. cancelProactiveRefresh() se llama dentro de
    // setLoggingOut(true) también.
    setLoggingOut(true)
    cancelProactiveRefresh()
    try {
      await api.post('/auth/logout')
    } catch {
      // local cleanup happens regardless
    }
    // Fade-out coordinado: marcamos el <html> para que el body se desvanezca,
    // esperamos que la animación CSS corra, y recién entonces swapeamos el
    // árbol. Esto evita el "pop" abrupto al saltar al Login.
    const root = document.documentElement
    root.classList.add('auth-transitioning')
    await new Promise((r) => setTimeout(r, 220))
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    // Limpia caches privadas para que la siguiente cuenta NO vea datos viejos
    // mientras se hace el refetch (o, peor, los vea permanente si el endpoint
    // ahora regresa 403/404 para esa cuenta).
    purgeUserScopedCaches()
    setUser(null)
    // Después de que React monte el Login, dejamos un frame extra para que el
    // browser pinte el opacity:0 inicial — así la transición de vuelta a 1
    // arranca desde el estado correcto.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.remove('auth-transitioning')
        // Apagamos el flag aquí: la pantalla de Login ya está montada y
        // cualquier login posterior debe permitir refresh normalmente.
        setLoggingOut(false)
      })
    })
  }

  const updateUser = (userData) => {
    setUser(userData)
    localStorage.setItem('user', JSON.stringify(userData))
  }

  const perms = useMemo(() => buildPerms(user), [user])

  return (
    <AuthContext.Provider value={{ user, login, verify2fa, logout, updateUser, loading, ...perms }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
