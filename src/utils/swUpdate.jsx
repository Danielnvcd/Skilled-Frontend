/**
 * Aviso de "nueva versión disponible" para pestañas que quedan abiertas.
 *
 * El problema: el service worker solo busca actualizaciones al cargar la página.
 * Quien deja la app abierta todo el día nunca se entera de un deploy nuevo.
 *
 * Aquí forzamos una revisión periódica y, cuando detectamos que se instaló una
 * versión nueva, mostramos un toast con un botón que llama a `forceReload()`
 * (que desregistra el SW, limpia el Cache Storage y recarga sin tocar la sesión).
 *
 * El usuario decide cuándo actualizar: NO recargamos solos, porque en este
 * sistema alguien puede estar a media captura y perdería lo no guardado.
 *
 * Complementa el fix de cache headers en `vercel.json` — sin aquellos headers
 * el navegador ni siquiera se entera de que hay un sw.js nuevo, y esto no
 * dispararía nunca.
 */
import toast from 'react-hot-toast'
import { forceReload } from './forceReload'

// Cada cuánto le preguntamos al servidor si hay versión nueva.
const INTERVALO_MS = 5 * 60 * 1000 // 5 min

let yaAvisado = false

function avisarVersionNueva() {
  if (yaAvisado) return
  yaAvisado = true

  toast(
    (t) => (
      <div className="flex items-center gap-3">
        <span className="text-sm">Nueva versión disponible</span>
        <button
          type="button"
          onClick={() => {
            toast.dismiss(t.id)
            forceReload()
          }}
          className="shrink-0 rounded-md bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-brand-500"
        >
          Actualizar
        </button>
      </div>
    ),
    {
      // Persistente: si se va solo, el usuario nunca se entera.
      duration: Infinity,
      // El id evita toasts duplicados si la detección se dispara dos veces.
      id: 'sw-update',
    }
  )
}

export function initServiceWorkerUpdates() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  // ¿La página ya venía controlada por un SW al cargar? Si NO, es la primera
  // visita: el SW se instala por primera vez y eso NO es "versión nueva".
  // Sin esta bandera, todo usuario nuevo vería el toast sin haber deploy.
  const yaEstabaControlada = !!navigator.serviceWorker.controller

  navigator.serviceWorker.ready
    .then((registration) => {
      // 1) Un SW nuevo empezó a instalarse. Si la página YA estaba controlada
      //    por otro SW, entonces es una actualización (no la primera visita).
      registration.addEventListener('updatefound', () => {
        const nuevo = registration.installing
        if (!nuevo || !navigator.serviceWorker.controller) return
        nuevo.addEventListener('statechange', () => {
          if (nuevo.state === 'installed') avisarVersionNueva()
        })
      })

      // 2) Revisión periódica: es lo que cubre la pestaña abierta sin navegar.
      const revisar = () => {
        registration.update().catch(() => {
          /* sin red o SW no disponible: reintentamos en el siguiente ciclo */
        })
      }
      setInterval(revisar, INTERVALO_MS)

      // 3) Al volver a la pestaña, revisar de inmediato en vez de esperar.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') revisar()
      })
    })
    .catch(() => {
      /* si el SW no llega a estar listo, simplemente no avisamos */
    })

  // Red de seguridad: si otro SW toma el control (p.ej. por skipWaiting),
  // también es señal de que hay versión nueva corriendo. Solo aplica si la
  // página ya venía controlada — si no, es la instalación inicial.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (yaEstabaControlada) avisarVersionNueva()
  })
}
