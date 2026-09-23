/**
 * Botón «Abrir puerta» de la barra superior. Solo admin (lo decide Topbar).
 *
 * Abre la puerta de un lector sin tener que entrar a su pantalla. Con un solo
 * lector activo va directo a la confirmación; con varios, primero se elige
 * cuál. No se muestra si no hay lectores activos.
 *
 * El ícono se pone verde mientras la cerradura está abierta. El estado llega
 * por Socket.IO (`hikvision:puerta`), que emite la escucha cuando el lector
 * reporta el cambio — sin consultar al lector desde aquí.
 *
 * Siempre pide confirmación: abre una puerta física sin que nadie se
 * identifique, y queda en la bitácora con el usuario.
 */
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { DoorOpen, DoorClosed, ChevronRight } from 'lucide-react'
import { ConfirmDialog } from './ui'
import { useResource } from '../hooks/useResource'
import { useSocket } from '../context/SocketContext'
import { extractApiError } from '../utils/apiError'
import { getDispositivos, abrirPuerta, EVENTO_PUERTA } from '../api/hikvision'

export default function PuertaRapida() {
  // Misma clave que la pantalla de Lectores: comparten caché y petición.
  const lectores = useResource('hikvision:dispositivos', getDispositivos, {
    staleMs: 60_000, invalidateOn: ['hikvision:changed'],
  })
  const activos = (lectores.data || []).filter((d) => d.activo)

  const { on } = useSocket()
  // { [dispositivo_id]: true } mientras la cerradura esté abierta.
  const [abiertas, setAbiertas] = useState({})
  const [menu, setMenu] = useState(false)
  const [porAbrir, setPorAbrir] = useState(null)
  const [abriendo, setAbriendo] = useState(false)

  useEffect(() => on(EVENTO_PUERTA, (e) => {
    setAbiertas((prev) => ({ ...prev, [e.dispositivo_id]: e.cerradura === 'Abierta' }))
  }), [on])

  if (!activos.length) return null

  const algunaAbierta = activos.some((d) => abiertas[d.id])

  const alPulsar = () => {
    if (activos.length === 1) setPorAbrir(activos[0])
    else setMenu((m) => !m)
  }

  const abrir = async () => {
    const d = porAbrir
    setAbriendo(true)
    try {
      const r = await abrirPuerta(d.id)
      toast.success(`${d.nombre}: puerta abierta por ${r.segundos_apertura} s`)
      setPorAbrir(null)
      // Se marca abierta al instante; el aviso del lector la cierra. Si la
      // escucha no corre, se da por cerrada cuando el relé ya debió cerrar.
      setAbiertas((prev) => ({ ...prev, [d.id]: true }))
      setTimeout(() => setAbiertas((prev) => ({ ...prev, [d.id]: false })),
                 ((r.segundos_apertura || 5) + 1) * 1000)
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo abrir la puerta'))
    } finally {
      setAbriendo(false)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={alPulsar}
        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-md focus-ring transition-colors ${
          algunaAbierta
            ? 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30'
            : 'text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800'
        }`}
        aria-label={algunaAbierta ? 'Puerta abierta' : 'Abrir puerta'}
        aria-haspopup={activos.length > 1 ? 'menu' : undefined}
        aria-expanded={activos.length > 1 ? menu : undefined}
        title={algunaAbierta ? 'Puerta abierta' : 'Abrir puerta'}
      >
        {algunaAbierta ? <DoorOpen size={18} /> : <DoorClosed size={18} />}
        {algunaAbierta && (
          <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
        )}
      </button>

      {menu && (
        <>
          {/* Capa invisible: cerrar el menú al hacer clic fuera. */}
          <button type="button" aria-label="Cerrar menú" tabIndex={-1}
                  className="fixed inset-0 z-40 cursor-default" onClick={() => setMenu(false)} />
          <div role="menu"
               className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-700">
            <p className="border-b border-ink-100 px-3 py-2 text-xs font-medium text-ink-500 dark:border-ink-800 dark:text-ink-400">
              ¿Qué puerta abrir?
            </p>
            {activos.map((d) => (
              <button
                key={d.id} type="button" role="menuitem"
                onClick={() => { setMenu(false); setPorAbrir(d) }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-ink-800 hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-ink-800"
              >
                {abiertas[d.id]
                  ? <DoorOpen size={16} className="text-emerald-600 dark:text-emerald-400" />
                  : <DoorClosed size={16} className="text-ink-400" />}
                <span className="min-w-0 flex-1 truncate">{d.nombre}</span>
                <ChevronRight size={14} className="text-ink-400" />
              </button>
            ))}
          </div>
        </>
      )}

      <ConfirmDialog
        open={porAbrir !== null}
        onClose={() => setPorAbrir(null)}
        onConfirm={abrir}
        loading={abriendo}
        tone="warning"
        title={porAbrir ? `Abrir puerta — ${porAbrir.nombre}` : 'Abrir puerta'}
        description={
          'La puerta se abrirá sin que nadie se identifique en el lector. ' +
          'La acción queda registrada en la bitácora con tu usuario.'
        }
        confirmLabel="Abrir"
      />
    </div>
  )
}
