import { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

// Auto-logout por inactividad.
// El timer se reinicia con cualquier interacción del usuario (mouse, teclado,
// touch, scroll). Si pasa `IDLE_TIMEOUT_MS` sin actividad, cierra sesión.
// `WARN_BEFORE_MS` antes del logout, muestra un toast con un botón "Seguir
// activo" que reinicia el timer.
//
// Multi-tab: usamos localStorage para sincronizar el "último evento de
// actividad" entre pestañas del mismo usuario. Si trabajo en la pestaña A,
// la pestaña B no debería desloguear por inactividad — el usuario sigue
// usando la sesión, solo en otra pestaña.
//
// Inactivo cuando la pestaña está cerrada/dormida: el `setTimeout` no corre
// en pestañas dormidas (los browsers lo throttlean), pero `visibilitychange`
// re-evalúa al volver: si pasamos el threshold, logout inmediato.

const IDLE_TIMEOUT_MS = 30 * 60 * 1000   // 30 minutos
const WARN_BEFORE_MS = 2 * 60 * 1000     // toast de aviso 2 minutos antes
const ACTIVITY_KEY = 'lastActivityTs'
// Eventos que cuentan como actividad. mousemove con throttle para no spamear.
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'wheel']
// mousemove se trata aparte porque dispara MUCHO; throttle de 5s.
const MOUSEMOVE_THROTTLE_MS = 5000

const WARN_TOAST_ID = 'idle-warn'

export default function useIdleLogout({
  enabled = true,
  timeoutMs = IDLE_TIMEOUT_MS,
  warnBeforeMs = WARN_BEFORE_MS,
} = {}) {
  const { user, logout } = useAuth()
  const warnTimerRef = useRef(null)
  const logoutTimerRef = useRef(null)
  const lastMousemoveRef = useRef(0)

  useEffect(() => {
    // No correr si no hay usuario autenticado o si está explícitamente
    // deshabilitado. Logout también limpia listeners (cleanup del effect).
    if (!enabled || !user) return

    const clearTimers = () => {
      if (warnTimerRef.current) { clearTimeout(warnTimerRef.current); warnTimerRef.current = null }
      if (logoutTimerRef.current) { clearTimeout(logoutTimerRef.current); logoutTimerRef.current = null }
    }

    const scheduleTimers = (sinceMs) => {
      // sinceMs = timestamp del último evento de actividad (puede venir de
      // otra pestaña vía storage event). Calculamos cuánto falta para warn y
      // logout relativo a "ahora".
      clearTimers()
      const elapsed = Date.now() - sinceMs
      const remainingToLogout = timeoutMs - elapsed
      const remainingToWarn = remainingToLogout - warnBeforeMs

      if (remainingToLogout <= 0) {
        // Ya pasamos el umbral — logout inmediato (caso típico al volver
        // de pestaña dormida).
        toast.dismiss(WARN_TOAST_ID)
        logout()
        return
      }

      if (remainingToWarn > 0) {
        warnTimerRef.current = setTimeout(() => {
          toast(
            (t) => (
              `Por inactividad cerrarás sesión en ${Math.round(warnBeforeMs / 60000)} minutos. ` +
              `Cualquier movimiento reinicia el contador.`
            ),
            {
              id: WARN_TOAST_ID,
              icon: '⏳',
              duration: warnBeforeMs,
            },
          )
        }, remainingToWarn)
      } else {
        // Ya estamos dentro de la ventana de advertencia; mostrarla ya.
        toast(
          `Por inactividad cerrarás sesión en menos de ${Math.ceil(remainingToLogout / 60000)} minutos.`,
          { id: WARN_TOAST_ID, icon: '⏳', duration: remainingToLogout },
        )
      }

      logoutTimerRef.current = setTimeout(() => {
        toast.dismiss(WARN_TOAST_ID)
        toast.error('Sesión cerrada por inactividad', { duration: 4000 })
        logout()
      }, remainingToLogout)
    }

    const markActivity = () => {
      const now = Date.now()
      try { localStorage.setItem(ACTIVITY_KEY, String(now)) } catch {}
      toast.dismiss(WARN_TOAST_ID)
      scheduleTimers(now)
    }

    const handleEvent = () => {
      markActivity()
    }

    const handleMousemove = () => {
      const now = Date.now()
      if (now - lastMousemoveRef.current < MOUSEMOVE_THROTTLE_MS) return
      lastMousemoveRef.current = now
      markActivity()
    }

    // Sincronización entre pestañas: si otra pestaña tuvo actividad, esta
    // pestaña debe extender SU contador también.
    const handleStorage = (e) => {
      if (e.key !== ACTIVITY_KEY || !e.newValue) return
      const ts = parseInt(e.newValue, 10)
      if (!Number.isFinite(ts)) return
      toast.dismiss(WARN_TOAST_ID)
      scheduleTimers(ts)
    }

    // Al volver de pestaña dormida/oculta, re-evaluar: si el delta ya supera
    // el threshold, logout. Si no, re-programar timers desde el último ts.
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return
      let lastTs = Date.now()
      try {
        const stored = parseInt(localStorage.getItem(ACTIVITY_KEY) || '0', 10)
        if (Number.isFinite(stored) && stored > 0) lastTs = stored
      } catch {}
      scheduleTimers(lastTs)
    }

    // Init: arrancamos contando desde "ahora" o desde el último ts conocido.
    let initialTs = Date.now()
    try {
      const stored = parseInt(localStorage.getItem(ACTIVITY_KEY) || '0', 10)
      if (Number.isFinite(stored) && stored > 0) initialTs = stored
    } catch {}
    scheduleTimers(initialTs)

    for (const ev of ACTIVITY_EVENTS) window.addEventListener(ev, handleEvent, { passive: true })
    window.addEventListener('mousemove', handleMousemove, { passive: true })
    window.addEventListener('storage', handleStorage)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearTimers()
      toast.dismiss(WARN_TOAST_ID)
      for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, handleEvent)
      window.removeEventListener('mousemove', handleMousemove)
      window.removeEventListener('storage', handleStorage)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [enabled, user, timeoutMs, warnBeforeMs, logout])
}
