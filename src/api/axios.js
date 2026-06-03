import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    // Header anti-CSRF requerido por el backend en /auth/refresh y /auth/logout
    // (endpoints que autentican vía cookie en lugar de Bearer). Al ser un header
    // custom, los browsers fuerzan preflight CORS — un <form> HTML cross-site
    // no puede setearlo, así que bloquea CSRF.
    'X-Requested-With': 'XMLHttpRequest',
  },
})

const AUTH_ENDPOINTS = ['/auth/login', '/auth/verify-2fa', '/auth/refresh', '/auth/logout']

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let refreshPromise = null

function performRefresh() {
  if (!refreshPromise) {
    refreshPromise = api
      .post('/auth/refresh')
      .then((res) => {
        localStorage.setItem('token', res.data.token)
        if (res.data.user) {
          localStorage.setItem('user', JSON.stringify(res.data.user))
        }
        armProactiveRefresh(res.data.token)
        return res.data.token
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

// ── Refresh proactivo ──────────────────────────────────────────────────────
// Programa un refresh ~60s antes de que el access token expire, para que el
// usuario no vea 401s en consola al volver a la pestaña tras inactividad.
// El interceptor reactivo de abajo sigue siendo la red de seguridad (cubre
// timers throttled en pestañas en background, clock skew, etc.).
const REFRESH_LEAD_MS = 60 * 1000
let refreshTimer = null

function getTokenExpiryMs(token) {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const payload = JSON.parse(atob(padded))
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

export function cancelProactiveRefresh() {
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
}

export function armProactiveRefresh(token) {
  cancelProactiveRefresh()
  const tk = token || localStorage.getItem('token')
  if (!tk) return
  const expMs = getTokenExpiryMs(tk)
  if (!expMs) return
  const delay = expMs - Date.now() - REFRESH_LEAD_MS
  if (delay <= 0) {
    // Token ya expiró o está dentro del lead time: refresh inmediato.
    // El .then re-arma; si falla, el interceptor reactivo lo manejará en el
    // próximo request (no llamamos a bounceToLogin aquí para no patear al
    // usuario por un blip de red mientras la pestaña está en background).
    performRefresh().catch(() => {})
    return
  }
  refreshTimer = setTimeout(() => {
    performRefresh().catch(() => {})
  }, delay)
}

// Browsers throttlean setTimeout en pestañas inactivas (típicamente a 1/min
// después de unos minutos). Cuando la pestaña vuelve a ser visible, re-evaluamos
// el token: si está a punto de expirar o ya expiró, refresh inmediato.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      armProactiveRefresh()
    }
  })
}

// Auto-armar al cargar la SPA si ya hay sesión persistida en localStorage.
// AuthContext también llama a armProactiveRefresh() después de login/verify2fa
// para cubrir el caso de iniciar sesión en la misma carga.
if (typeof window !== 'undefined') {
  armProactiveRefresh()
}

function bounceToLogin() {
  cancelProactiveRefresh()
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  if (window.location.pathname !== '/login') {
    const from = window.location.pathname + window.location.search
    window.location.href = '/login?from=' + encodeURIComponent(from)
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    const url = original?.url || ''
    const status = error.response?.status

    const isAuthCall = AUTH_ENDPOINTS.some((p) => url.includes(p))
    if (status !== 401 || isAuthCall || original?._retry) {
      if (status === 401 && !isAuthCall) {
        bounceToLogin()
      }
      return Promise.reject(error)
    }

    try {
      const newToken = await performRefresh()
      original._retry = true
      original.headers = { ...(original.headers || {}), Authorization: `Bearer ${newToken}` }
      return api.request(original)
    } catch (refreshErr) {
      bounceToLogin()
      return Promise.reject(refreshErr)
    }
  }
)

export default api
