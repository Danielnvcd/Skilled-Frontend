import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
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
        return res.data.token
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

function bounceToLogin() {
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
