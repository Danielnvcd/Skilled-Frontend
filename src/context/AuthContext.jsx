import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import api from '../api/axios'

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
    setUser(res.data.user)
    return { requires2fa: false }
  }

  const verify2fa = async (stepToken, code) => {
    const res = await api.post('/auth/verify-2fa', { stepToken, code })
    localStorage.setItem('token', res.data.token)
    localStorage.setItem('user', JSON.stringify(res.data.user))
    setUser(res.data.user)
  }

  const logout = async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // local cleanup happens regardless
    }
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
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
