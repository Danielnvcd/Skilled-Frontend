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
// Endpoints que NO deben llevar `Authorization: Bearer`. /refresh y /logout
// autentican por cookie HttpOnly; /login y /verify-2fa son anónimos. Mandar
// un Bearer aquí es ruido inútil y, en /refresh, podría confundir logs.
const NO_BEARER_ENDPOINTS = ['/auth/refresh', '/auth/logout', '/auth/login', '/auth/verify-2fa']

// Bandera de "logout en curso": cuando AuthContext.logout arranca, levanta este
// flag. El `.then` de performRefresh y el setter de armProactiveRefresh lo
// consultan para no reescribir el token después de que el usuario ya pidió
// cerrar sesión. Cierra el race entre un refresh en vuelo y el logout.
let isLoggingOut = false
export function setLoggingOut(v) {
  isLoggingOut = !!v
  if (isLoggingOut) cancelProactiveRefresh()
}

api.interceptors.request.use((config) => {
  const url = config.url || ''
  const skipBearer = NO_BEARER_ENDPOINTS.some((p) => url.includes(p))
  if (!skipBearer) {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

let refreshPromise = null

export function performRefresh() {
  if (!refreshPromise) {
    refreshPromise = api
      .post('/auth/refresh')
      .then((res) => {
        const token = res?.data?.token
        // Defensa: si el backend respondió 200 pero sin `token` (bug en server,
        // proxy que recorta body, etc.), no escribimos `undefined` ni
        // reintentamos requests con `Bearer undefined`. Forzamos el catch.
        if (!token || typeof token !== 'string') {
          throw new Error('refresh_no_token')
        }
        // Race fix: si el usuario ya pidió logout mientras este refresh estaba
        // en vuelo, no escribimos nada. Devolvemos el token igual para que
        // quien lo esté esperando (interceptor reactivo) lo use en su retry,
        // pero NO tocamos localStorage ni rearmamos el timer.
        if (isLoggingOut) return token
        localStorage.setItem('token', token)
        if (res.data.user) {
          localStorage.setItem('user', JSON.stringify(res.data.user))
          // Notifica a AuthContext (misma pestaña) para que actualice su state.
          // Sin esto, cambios en role/perfil hechos en backend se quedaban
          // stale en memoria hasta el siguiente F5.
          window.dispatchEvent(new CustomEvent('auth:user-updated', { detail: res.data.user }))
        }
        armProactiveRefresh(token)
        return token
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
    // `atob` devuelve una "binary string" (un byte por char). Si el payload
    // del JWT incluye caracteres no-ASCII (acentos en username, área, etc.),
    // pasarla directo a JSON.parse rompe en mojibake o ya en atob.
    // Pipeline correcto: atob → Uint8Array(byte por char) → TextDecoder UTF-8.
    const bin = atob(padded)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    const json = new TextDecoder('utf-8').decode(bytes)
    const payload = JSON.parse(json)
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
  // Si estamos cerrando sesión, no rearmar — evita que refreshes tardíos
  // resuciten el timer después del logout.
  if (isLoggingOut) return
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

// Recuperación al volver internet: si la conexión cae mientras un timer estaba
// programado y dispara durante la caída, performRefresh falla y queda sin
// re-programar (refreshPromise vuelve a null sin nuevo arm). Al volver online
// re-evaluamos el token y, si ya pasó el exp/lead, refrescamos inmediato.
// Sin esto, el usuario debe hacer una acción manual para que el interceptor
// reactivo tome el control.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    armProactiveRefresh()
  })
}

// Sincronización entre pestañas: el `storage` event se dispara en TODAS las
// pestañas EXCEPTO la que hizo el cambio. Cuando otra pestaña hace login,
// logout, refresh o actualiza el perfil, debemos reaccionar:
//  - token cambió → re-armar timer (login/refresh) o bounce (logout)
//  - user cambió  → notificar a AuthContext para actualizar el state
// Sin esto, esta pestaña se queda con datos stale hasta el próximo F5.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'token') {
      if (e.newValue) {
        armProactiveRefresh(e.newValue)
      } else {
        cancelProactiveRefresh()
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
      }
      return
    }
    if (e.key === 'user') {
      if (e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue)
          window.dispatchEvent(new CustomEvent('auth:user-updated', { detail: parsed }))
        } catch {
          // user corrupto en localStorage: ignorar
        }
      }
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
  // Best-effort: avisa al backend para que revoque el RT actual antes de
  // limpiar storage. Si la cookie ya no es válida (RT expirado/revocado),
  // el backend simplemente responde 200/401 y seguimos. No bloqueamos el
  // bounce esperando: usamos fetch sin await + keepalive para que el request
  // sobreviva al window.location.href que viene después.
  try {
    const url = (api.defaults.baseURL || '/api') + '/auth/logout'
    fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      keepalive: true,
    }).catch(() => {})
  } catch {
    // Si fetch falla por cualquier razón, seguir con el bounce igual.
  }
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
      if (!newToken || typeof newToken !== 'string') {
        // Defensa: si performRefresh resolvió sin token válido, no reintentar
        // con `Bearer undefined`. Forzar bounce a login.
        throw new Error('refresh_no_token')
      }
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
