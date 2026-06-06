import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext'
import { performRefresh } from '../api/axios'

const SocketContext = createContext({ socket: null, connected: false, on: () => () => {} })

// El backend Flask-SocketIO vive en el mismo origen que la API REST. Si
// VITE_API_URL apunta a un host (prod: https://app.skilledmx.cloud/api),
// extraemos solo el origin. En dev sin VITE_API_URL devolvemos undefined
// para que socket.io-client use el host actual (window.location) y caiga
// en el proxy /socket.io de vite.config.js.
function getServerOrigin() {
  const raw = import.meta.env.VITE_API_URL
  if (!raw) return undefined
  try {
    return new URL(raw, window.location.origin).origin
  } catch {
    return undefined
  }
}

export function SocketProvider({ children }) {
  const { user, logout } = useAuth()
  const [socket, setSocket] = useState(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!user) {
      setSocket(null)
      setConnected(false)
      return
    }
    // Sin token guardado no abrimos socket (la auth de handshake fallaría).
    if (!localStorage.getItem('token')) return

    const s = io(getServerOrigin(), {
      // auth como función → se evalúa en cada handshake/reconexión. Así, si
      // axios refresca el JWT (cada 20 min) y el socket cae, la reconexión
      // usa el token fresco en vez del que capturamos al montar.
      auth: (cb) => cb({ token: localStorage.getItem('token') || '' }),
      path: '/socket.io',
      // WebSocket-only — saltamos la fase de polling de Socket.IO.
      //
      // Prod usa gunicorn con 4 workers + worker-class geventwebsocket. El
      // polling de Socket.IO requiere sticky sessions (cada sid debe pegar
      // siempre al mismo worker), y gunicorn con un solo bind no las soporta.
      // WebSocket sí: una vez abierto, la conexión es persistente en un único
      // worker. Con Redis como message_queue cualquier worker puede emitir a
      // cualquier sala, independiente de dónde viva el socket.
      transports: ['websocket'],
      withCredentials: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
      // Tope de reintentos. Default de socket.io-client es Infinity → si el
      // JWT/RT están permanentemente vencidos, el cliente reintentaba cada
      // 10s para siempre y disparaba un performRefresh por cada intento.
      // 10 reintentos = ~90s con backoff, suficiente para sobrevivir blips
      // de red comunes; pasado eso, nos rendimos y dejamos que el
      // visibilitychange/online listener decida cuándo retomar.
      reconnectionAttempts: 10,
      timeout: 20_000,
    })

    s.on('connect', () => setConnected(true))
    s.on('disconnect', () => setConnected(false))

    // Push de seguridad emitido por el backend cuando invalida todas las
    // sesiones (panic-revoke). La pestaña debe cerrar sesión al instante en
    // lugar de esperar a que el siguiente HTTP retorne 401 por pv mismatch.
    s.on('auth:force_logout', () => {
      // El logout limpia caches, RT cookie y manda al Login. El POST /auth/logout
      // que dispara probablemente falle con 401 (el AT ya está revocado), pero
      // la limpieza local se ejecuta de todos modos.
      logout().catch(() => {})
    })

    // Si agotamos los `reconnectionAttempts`, socket.io-client deja de
    // reintentar. No es estado terminal definitivo: el listener de visibility
    // u online de abajo puede llamar `s.connect()` para retomar manualmente.
    s.on('reconnect_failed', () => {
      // No mostramos error visible al usuario — la app sigue funcionando con
      // polling REST. Cuando vuelva el foco o internet, intentamos otra vez.
      setConnected(false)
    })

    // Cuando un timer de refresh proactivo se throttlea en una pestaña
    // background, el token en localStorage puede haber expirado para cuando
    // el WS intenta reconectar. El backend rechaza el handshake (token
    // inválido → ConnectionRefusedError 'token_expired') y socket.io-client
    // reporta connect_error. Aquí refrescamos el token y dejamos que la
    // reconexión automática (reconnection: true) tome el token fresco vía
    // el callback de `auth` en el próximo intento.
    //
    // Si el refresh falla (ej. cookie de refresh también expiró), no hacemos
    // nada extra: el siguiente request HTTP disparará bounceToLogin desde el
    // interceptor de axios. No queremos forzar logout aquí porque un blip de
    // red transitorio no debería patear al usuario.
    let refreshingFromSocket = false
    s.on('connect_error', async (err) => {
      setConnected(false)
      const msg = (err && (err.message || err.data)) || ''
      const looksLikeAuth =
        typeof msg === 'string' &&
        /token|auth|unauth|forbidden|refused/i.test(msg)
      if (!looksLikeAuth || refreshingFromSocket) return
      refreshingFromSocket = true
      try {
        await performRefresh()
      } catch {
        // Refresh falló — no escalamos; el interceptor de axios lo manejará.
      } finally {
        refreshingFromSocket = false
      }
    })

    // Pulso de presencia. Mantiene `user.last_seen` fresco en el backend
    // mientras el SPA esté abierto (incluso si el usuario solo lee, sin
    // hacer requests HTTP). El servidor lo usa para el indicador "en línea".
    const heartbeatId = setInterval(() => {
      if (s.connected) s.emit('heartbeat')
    }, 90_000)

    // Ping/pong a nivel de aplicación con ack + timeout. Engine.IO ya hace
    // su propio ping_interval=25s/ping_timeout=60s a nivel de transporte,
    // pero a través de Cloudflare Tunnel a veces el TCP se cierra por idle
    // y el browser no se entera hasta el próximo write — la conexión queda
    // "zombie" (s.connected=true pero los emits no llegan al server).
    //
    // Solución: cada APP_PING_INTERVAL_MS emitimos `app:ping` con un ack
    // callback. Si el server no devuelve el ack en APP_PING_TIMEOUT_MS,
    // asumimos zombie y forzamos disconnect→connect. Así el SPA detecta
    // el corte en ~28s en vez de los 60s del ping_timeout nativo.
    const APP_PING_INTERVAL_MS = 20_000
    const APP_PING_TIMEOUT_MS = 8_000
    const appPingId = setInterval(() => {
      if (!s.connected) return
      let acked = false
      const timeoutId = setTimeout(() => {
        if (acked) return
        // Sin pong → socket zombie. Forzamos reconexión.
        try {
          s.disconnect()
          s.connect()
        } catch {
          // socket.io tira si ya está conectando; ignorar.
        }
      }, APP_PING_TIMEOUT_MS)
      // socket.io-client: el último argumento como función es el ack.
      s.emit('app:ping', () => {
        acked = true
        clearTimeout(timeoutId)
      })
    }, APP_PING_INTERVAL_MS)

    // Al volver el foco a la pestaña, si el socket quedó desconectado por
    // expiración de token mientras estaba en background, refrescamos el token
    // y forzamos el reconnect (socket.io no reintenta agresivamente si la
    // pestaña estaba background — el callback de auth ya leerá el nuevo
    // token de localStorage en el siguiente handshake).
    const reconnectIfDown = async () => {
      if (s.connected) return
      try {
        await performRefresh()
      } catch {
        // Igual que arriba — no escalamos por un fallo de refresh.
      }
      try {
        s.connect()
      } catch {
        // socket.io tira si ya está conectando; lo ignoramos.
      }
    }
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      reconnectIfDown()
    }
    document.addEventListener('visibilitychange', onVisible)
    // Volver del modo offline: si el socket agotó sus reintentos durante el
    // outage, este listener lo destrabaa cuando vuelve internet. Sin esto
    // el socket podía quedar muerto hasta el próximo cambio de visibilidad.
    window.addEventListener('online', reconnectIfDown)

    setSocket(s)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', reconnectIfDown)
      clearInterval(heartbeatId)
      clearInterval(appPingId)
      s.removeAllListeners()
      s.disconnect()
      setSocket(null)
      setConnected(false)
    }
    // Dep en primitivos (id + role) en lugar del objeto `user`. AuthContext
    // hace dos setUser() al montar (uno desde localStorage, otro tras /me) y
    // updateUser() a veces, lo que cambia la referencia del objeto user
    // aunque id/role sigan iguales. Sin esto, cada cambio de referencia
    // tiraba el socket y abría uno nuevo (cycle observable como doClose →
    // open en la consola del browser). Reconectamos SOLO si cambia el user
    // físico (login/logout) o el rol (que define la sala `role:{rol}`).
  }, [user?.id, user?.role])

  const value = useMemo(
    () => ({
      socket,
      connected,
      on(event, handler) {
        if (!socket) return () => {}
        socket.on(event, handler)
        return () => socket.off(event, handler)
      },
    }),
    [socket, connected],
  )

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}

export function useSocket() {
  return useContext(SocketContext)
}
