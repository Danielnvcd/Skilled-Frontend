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
