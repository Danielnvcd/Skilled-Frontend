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
      // Polling primero (HTTP plano) y luego upgrade a WebSocket. Esto sobrevive
      // mejor detrás de proxies que cuesta forwarden los headers Upgrade/
      // Sec-WebSocket-Key (visto en Vite v8 dev server). Si el upgrade falla,
      // se queda en polling y todo sigue funcionando.
      transports: ['polling', 'websocket'],
      withCredentials: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
      timeout: 20_000,
    })

    s.on('connect', () => setConnected(true))
    s.on('disconnect', () => setConnected(false))
    s.on('connect_error', () => setConnected(false))

    setSocket(s)

    return () => {
      s.removeAllListeners()
      s.disconnect()
      setSocket(null)
      setConnected(false)
    }
  }, [user])

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
