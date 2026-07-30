// Recarga la app trayendo la última versión desplegada.
//
// Hay dos caminos:
//
//   reloadToLatest()  ← USAR ESTE. Le pide al service worker que busque versión
//                       nueva; si la hay, espera a que se active y recarga. El
//                       precache se conserva, así que la recarga es rápida.
//
//   forceReload()     ← Camino nuclear: borra TODO el Cache Storage. Lento (hay
//                       que rebajar ~3.5 MB) y con una condición de carrera: el
//                       SW viejo sigue controlando la página hasta que se cierra,
//                       así que puede atender la recarga con el precache ya
//                       borrado → pantalla en blanco. Queda solo como fallback.

// Cuánto esperamos a que el SW nuevo termine de activarse antes de recargar igual.
const ESPERA_ACTIVACION_MS = 5000

function recargar() {
  window.location.reload()
}

function conTimeout(promesa, ms) {
  return Promise.race([promesa, new Promise((r) => setTimeout(r, ms))])
}

// Espera a que el SW que se está instalando llegue a 'activated'.
// Resuelve de inmediato si no hay ninguno (= no había versión nueva).
function esperarActivacion(registration) {
  return new Promise((resolve) => {
    const nuevo = registration.installing || registration.waiting
    if (!nuevo) return resolve()
    const timer = setTimeout(resolve, ESPERA_ACTIVACION_MS)
    nuevo.addEventListener('statechange', () => {
      if (nuevo.state === 'activated' || nuevo.state === 'redundant') {
        clearTimeout(timer)
        resolve()
      }
    })
  })
}

/**
 * Trae la última versión desplegada sin vaciar el caché.
 *
 * Si no hay versión nueva, es una recarga normal (rápida, servida del precache).
 * Si la hay, espera a que el SW nuevo tome el control y entonces recarga, de modo
 * que la navegación ya la atiende el precache nuevo.
 *
 * Ante cualquier fallo cae a `forceReload()`, que es el comportamiento anterior.
 */
export async function reloadToLatest() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return recargar()
  }
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    if (!registration) return recargar()

    // `update()` puede colgarse sin red: lo acotamos.
    await conTimeout(registration.update(), ESPERA_ACTIVACION_MS)
    await esperarActivacion(registration)
    recargar()
  } catch {
    // Si algo sale mal, el camino de siempre.
    forceReload()
  }
}

// Fuerza que el cliente cargue la ÚLTIMA versión desplegada.
//
// La app es una PWA con service worker `autoUpdate` (vite-plugin-pwa). Tras un
// deploy, el SW puede seguir sirviendo el bundle anterior desde el Cache
// Storage hasta que el navegador lo actualice — por eso "hay que forzar la
// recarga" manualmente. Un F5 normal NO basta porque vuelve a pegarle al SW.
//
// Esta función desregistra el SW y borra TODAS las cachés del Cache Storage
// (que es lo que retiene los assets viejos), luego recarga. NO toca
// localStorage ni la sesión: solo invalida el caché de código, así el usuario
// no pierde su login al actualizar.
export async function forceReload() {
  // 1) Desregistrar cualquier service worker activo.
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
  } catch { /* el SW podría no estar disponible; seguimos */ }

  // 2) Vaciar el Cache Storage (precache de Workbox + cualquier runtime cache).
  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  } catch { /* ignore */ }

  // 3) Recargar saltándose el bfcache. Añadimos un parámetro efímero para
  //    evitar que el navegador sirva el index.html desde su caché HTTP de
  //    disco; el SPA ignora `_r` así que no afecta el ruteo.
  try {
    const url = new URL(window.location.href)
    url.searchParams.set('_r', Date.now().toString(36))
    window.location.replace(url.toString())
  } catch {
    window.location.reload()
  }
}
