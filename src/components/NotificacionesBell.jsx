import { useEffect, useRef, useState, useCallback } from 'react'
import { Bell, Check, CheckCheck, ExternalLink, Sparkles, FileCheck2, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import { obtenerResumen, marcarLeida, marcarTodas } from '../api/notificaciones'
import { useSocket } from '../context/SocketContext'

// Fallback de polling: solo si el socket está caído. Cuando hay WS, el bell
// se actualiza por push y este intervalo no dispara fetch.
const FALLBACK_POLL_MS = 120_000

const TIPO_META = {
  REPORTE_CERRADO: { icon: FileCheck2, tone: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30' },
  PRENOMINA_CERRADA: { icon: Wallet, tone: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30' },
  ACTUALIZACION: { icon: Sparkles, tone: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30' },
}

function tipoMeta(tipo) {
  return TIPO_META[tipo] || { icon: Bell, tone: 'text-ink-500 bg-ink-100 dark:bg-ink-800' }
}

export default function NotificacionesBell() {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState({ no_leidas: 0, items: [] })
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const wrapperRef = useRef(null)
  const { socket, connected, on } = useSocket()

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await obtenerResumen()
      setData(res)
    } catch {
      // silencio: el bell no debe ser ruidoso
    } finally {
      setLoading(false)
    }
  }, [])

  // Carga inicial: una sola vez al montar.
  useEffect(() => {
    cargar()
  }, [cargar])

  // Push en tiempo real vía Socket.IO. notif:new añade al inicio del listado;
  // notif:read / notif:read_all actualizan el contador y el flag local.
  useEffect(() => {
    if (!socket) return
    const offNew = on('notif:new', (payload) => {
      const n = payload?.notif
      if (!n) return
      setData((prev) => {
        // Evita duplicar si el mismo evento llega dos veces (reconexión).
        if (prev.items.some((x) => x.id === n.id)) return prev
        const items = [n, ...prev.items].slice(0, 15)
        const no_leidas =
          typeof payload.no_leidas === 'number'
            ? payload.no_leidas
            : prev.no_leidas + (n.leida ? 0 : 1)
        return { no_leidas, items }
      })
    })
    const offRead = on('notif:read', (payload) => {
      setData((prev) => ({
        no_leidas: typeof payload?.no_leidas === 'number'
          ? payload.no_leidas
          : Math.max(0, prev.no_leidas - 1),
        items: prev.items.map((n) => (n.id === payload?.id ? { ...n, leida: true } : n)),
      }))
    })
    const offReadAll = on('notif:read_all', () => {
      setData((prev) => ({
        no_leidas: 0,
        items: prev.items.map((n) => ({ ...n, leida: true })),
      }))
    })
    return () => {
      offNew(); offRead(); offReadAll()
    }
  }, [socket, on])

  // Fallback de polling: solo corre cuando el socket NO está conectado.
  // Si vuelve a conectar, el efecto se re-monta y limpia el intervalo.
  useEffect(() => {
    if (connected) return
    const id = setInterval(cargar, FALLBACK_POLL_MS)
    return () => clearInterval(id)
  }, [connected, cargar])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleToggle = () => {
    const next = !open
    setOpen(next)
    if (next) cargar()
  }

  const handleMarcarLeida = async (id, e) => {
    e?.stopPropagation()
    try {
      await marcarLeida(id)
      setData((prev) => ({
        no_leidas: Math.max(0, prev.no_leidas - 1),
        items: prev.items.map((n) => n.id === id ? { ...n, leida: true } : n),
      }))
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo marcar como leída')
    }
  }

  const handleMarcarTodas = async () => {
    if (data.no_leidas === 0 || busy) return
    setBusy(true)
    try {
      await marcarTodas()
      setData((prev) => ({
        no_leidas: 0,
        items: prev.items.map((n) => ({ ...n, leida: true })),
      }))
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al marcar todas')
    } finally {
      setBusy(false)
    }
  }

  const handleClickItem = async (n) => {
    if (!n.leida) await handleMarcarLeida(n.id)
    if (n.url) {
      setOpen(false)
      window.location.href = n.url
    }
  }

  const count = data.no_leidas

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={handleToggle}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 focus-ring transition-colors"
        aria-label="Notificaciones"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold ring-2 ring-white dark:ring-ink-900">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Panel de notificaciones"
          className="absolute right-0 mt-2 w-[22rem] sm:w-96 max-h-[32rem] bg-white dark:bg-ink-900 rounded-xl shadow-xl border border-ink-200 dark:border-ink-800 z-50 flex flex-col overflow-hidden animate-scale-in origin-top-right"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-ink-200 dark:border-ink-800">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-100">Notificaciones</h3>
              <p className="text-xs text-ink-500 dark:text-ink-400">
                {count > 0 ? `${count} sin leer` : 'Todo al día'}
              </p>
            </div>
            <button
              onClick={handleMarcarTodas}
              disabled={count === 0 || busy}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 dark:text-brand-300 hover:text-brand-900 dark:hover:text-brand-100 disabled:text-ink-400 disabled:cursor-not-allowed"
              title="Marcar todas como leídas"
            >
              <CheckCheck size={13} /> Marcar todas
            </button>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {loading && data.items.length === 0 ? (
              <div className="p-6 text-center text-sm text-ink-400">Cargando…</div>
            ) : data.items.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="mx-auto text-ink-300 dark:text-ink-600 mb-2" size={28} />
                <p className="text-sm text-ink-500 dark:text-ink-400">No tienes notificaciones</p>
              </div>
            ) : (
              <ul className="divide-y divide-ink-200 dark:divide-ink-800">
                {data.items.map((n) => {
                  const { icon: Icon, tone } = tipoMeta(n.tipo)
                  const clickable = Boolean(n.url) || !n.leida
                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => handleClickItem(n)}
                        disabled={!clickable}
                        className={`w-full text-left flex gap-3 px-4 py-3 transition-colors ${
                          clickable ? 'hover:bg-ink-50 dark:hover:bg-ink-800/60' : 'cursor-default'
                        } ${!n.leida ? 'bg-brand-50/40 dark:bg-brand-950/20' : ''}`}
                      >
                        <span className={`flex-shrink-0 h-9 w-9 inline-flex items-center justify-center rounded-lg ${tone}`}>
                          <Icon size={16} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm truncate ${!n.leida ? 'font-semibold text-ink-900 dark:text-ink-100' : 'font-medium text-ink-700 dark:text-ink-200'}`}>
                              {n.titulo}
                            </p>
                            {!n.leida && (
                              <span className="flex-shrink-0 mt-1 h-2 w-2 rounded-full bg-brand-500" />
                            )}
                          </div>
                          <p className="text-xs text-ink-500 dark:text-ink-400 mt-0.5 line-clamp-2">
                            {n.mensaje}
                          </p>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-[11px] text-ink-400">{n.tiempo}</span>
                            {n.url && (
                              <span className="text-[11px] text-brand-600 dark:text-brand-300 inline-flex items-center gap-0.5">
                                <ExternalLink size={10} /> Ir
                              </span>
                            )}
                            {!n.leida && (
                              <button
                                onClick={(e) => handleMarcarLeida(n.id, e)}
                                className="ml-auto text-[11px] text-ink-500 dark:text-ink-400 hover:text-brand-700 dark:hover:text-brand-300 inline-flex items-center gap-0.5"
                              >
                                <Check size={10} /> Leída
                              </button>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
