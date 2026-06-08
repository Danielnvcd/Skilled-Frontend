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

// Lee el `exp` del JWT sin verificar firma (solo necesitamos saber si está
// vencido para decidir si refrescar antes del handshake WS). Retorna el
// timestamp Unix en segundos, o null si el token no es decodificable.
function decodeJwtExp(token) {
  if (!token || typeof token !== 'string') return null
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const obj = JSON.parse(json)
    return typeof obj.exp === 'number' ? obj.exp : null
  } catch {
    return null
  }
}

export function SocketProvider({ children }) {
  const { user, logout } = useAuth()
  const [socket, setSocket] = useState(null)
  const [connected, setConnected] = useState(false)
  // Trigger para forzar un socket nuevo cuando el manager queda muerto tras
  // reconnect_failed (bug socket.io-client #1179 — skipReconnect=true bloquea
  // que s.connect() revive el manager). Incrementar este contador re-corre
  // el useEffect, que limpia el socket podrido y abre uno desde cero.
  const [reconnectTrigger, setReconnectTrigger] = useState(0)

  useEffect(() => {
    if (!user) {
      setSocket(null)
      setConnected(false)
      return
    }
    // Sin token guardado no abrimos socket (la auth de handshake fallaría).
    if (!localStorage.getItem('token')) return

    let cancelled = false
    let s = null
    let heartbeatId = null
    let appPingId = null
    let cleanupListeners = () => {}

    const setup = async () => {
      // Pre-refresh del JWT ANTES de abrir el socket. Si el token vence en
      // <60s o ya venció, lo refrescamos. Esto mata el race del primer load
      // en la mañana: antes, el socket arrancaba con el token vencido de
      // ayer, el backend rechazaba con token_expired, y socket.io reintentaba
      // con el mismo token viejo porque performRefresh corre async y todavía
      // no había terminado de actualizar localStorage. Si los 10 reintentos
      // se agotaban antes que el refresh terminara, el socket quedaba en
      // reconnect_failed y solo F5 lo revivía (a veces). Documentado en
      // socket.io-client #1179 / socket.io #3358.
      const tokenNow = localStorage.getItem('token')
      const exp = decodeJwtExp(tokenNow)
      const needsRefresh = !exp || exp * 1000 - Date.now() < 60_000
      if (needsRefresh) {
        try {
          await performRefresh()
        } catch {
          // Refresh falló — el refresh token también está vencido. No
          // abrimos socket; el próximo request HTTP disparará bounceToLogin
          // desde el interceptor de axios y limpiará la sesión.
          return
        }
      }
      if (cancelled) return

      s = io(getServerOrigin(), {
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
        // 10 intentos ~90s. Si se agotan, NO confiamos en s.connect() para
        // revivir el manager (bug socket.io-client #1179 — skipReconnect=true
        // bloquea el reuse). En su lugar, reconnect_failed dispara
        // setReconnectTrigger que reabre un socket completamente nuevo. El
        // pre-refresh de arriba lo gatekeepea: si el RT también murió, no
        // spammeamos handshakes — return temprano sin crear socket.
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

      // Al agotar reconnectionAttempts, socket.io-client setea skipReconnect=true
      // y el manager queda muerto: s.connect() ya no revive de forma confiable
      // (bug #1179). En vez de quedarnos en estado "terminado", forzamos un
      // socket completamente nuevo via setReconnectTrigger → el useEffect
      // re-corre, el cleanup destruye este socket podrido, y setup crea uno
      // nuevo (con pre-refresh del token, así arranca con JWT fresco).
      s.on('reconnect_failed', () => {
        setConnected(false)
        if (cancelled) return
        // Pequeño delay para no entrar en loop apretado si el backend está
        // genuinamente caído. El pre-refresh del próximo setup será el que
        // corte definitivamente si el RT también murió.
        setTimeout(() => {
          if (!cancelled) setReconnectTrigger((t) => t + 1)
        }, 2000)
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
      heartbeatId = setInterval(() => {
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
      appPingId = setInterval(() => {
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
      cleanupListeners = () => {
        document.removeEventListener('visibilitychange', onVisible)
        window.removeEventListener('online', reconnectIfDown)
      }

      setSocket(s)
    }

    setup()

    return () => {
      cancelled = true
      cleanupListeners()
      if (heartbeatId) clearInterval(heartbeatId)
      if (appPingId) clearInterval(appPingId)
      if (s) {
        s.removeAllListeners()
        s.disconnect()
      }
      setSocket(null)
      setConnected(false)
    }
    // Dep en primitivos (id + role) en lugar del objeto `user`. AuthContext
    // hace dos setUser() al montar (uno desde localStorage, otro tras /me) y
    // updateUser() a veces, lo que cambia la referencia del objeto user
    // aunque id/role sigan iguales. Sin esto, cada cambio de referencia
    // tiraba el socket y abría uno nuevo (cycle observable como doClose →
    // open en la consola del browser). Reconectamos SOLO si cambia el user
    // físico (login/logout), el rol (que define la sala `role:{rol}`), o el
    // contador reconnectTrigger (forzado por reconnect_failed).
  }, [user?.id, user?.role, reconnectTrigger])

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
