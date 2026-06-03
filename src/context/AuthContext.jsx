import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import api, { armProactiveRefresh, cancelProactiveRefresh } from '../api/axios'

const AuthContext = createContext(null)

function buildPerms(user) {
  const role = user?.role
  const isSuperAdmin = role === 'super_admin'
  const isAdmin = role === 'admin' || isSuperAdmin
  const isCoordinador = role === 'coordinador'
  const isInventario = role === 'inventario'
  const isSolicitante = role === 'solicitante_material'
  return {
    role,
    isSuperAdmin,
    isAdmin,
    isCoordinador,
    isInventario,
    isSolicitante,
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')
    if (token && storedUser) {
      setUser(JSON.parse(storedUser))
      api.get('/auth/me').then((res) => {
        setUser(res.data)
        localStorage.setItem('user', JSON.stringify(res.data))
      }).catch(() => {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        setUser(null)
      }).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (username, password, remember = false) => {
    const res = await api.post('/auth/login', { username, password, remember })
    if (res.data.requires2fa) {
      return { requires2fa: true, username, stepToken: res.data.stepToken }
    }
    localStorage.setItem('token', res.data.token)
    localStorage.setItem('user', JSON.stringify(res.data.user))
    armProactiveRefresh(res.data.token)
    setUser(res.data.user)
    return { requires2fa: false }
  }

  const verify2fa = async (stepToken, code) => {
    const res = await api.post('/auth/verify-2fa', { stepToken, code })
    localStorage.setItem('token', res.data.token)
    localStorage.setItem('user', JSON.stringify(res.data.user))
    armProactiveRefresh(res.data.token)
    setUser(res.data.user)
  }

  const logout = async () => {
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
    cancelProactiveRefresh()
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    // Después de que React monte el Login, dejamos un frame extra para que el
    // browser pinte el opacity:0 inicial — así la transición de vuelta a 1
    // arranca desde el estado correcto.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.remove('auth-transitioning')
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
