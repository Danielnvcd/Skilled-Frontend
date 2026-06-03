import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext'

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
  const { user } = useAuth()
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
      timeout: 20_000,
    })

    s.on('connect', () => setConnected(true))
    s.on('disconnect', () => setConnected(false))
    s.on('connect_error', () => setConnected(false))

    // Pulso de presencia. Mantiene `user.last_seen` fresco en el backend
    // mientras el SPA esté abierto (incluso si el usuario solo lee, sin
    // hacer requests HTTP). El servidor lo usa para el indicador "en línea".
    const heartbeatId = setInterval(() => {
      if (s.connected) s.emit('heartbeat')
    }, 90_000)

    setSocket(s)

    return () => {
      clearInterval(heartbeatId)
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
