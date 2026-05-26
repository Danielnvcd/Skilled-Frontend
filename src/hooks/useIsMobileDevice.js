/**
 * Detección de "dispositivo móvil real" (celular o tablet).
 *
 * A diferencia de `useIsMobile`, NO usa el viewport. PC con ventana redimensionada
 * a tamaño chico devuelve `false`. Solo devuelve `true` si es un celular/tablet
 * de verdad (UA + touchscreen).
 *
 * Útil para decidir si mostrar bottom nav, esconder sidebar, etc., sin que se
 * dispare por error al redimensionar el navegador del escritorio.
 */
const UA_RE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i

function detect() {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (UA_RE.test(ua)) return true
  // iPadOS 13+ se reporta como "Macintosh" por defecto. Si es Mac CON pantalla
  // táctil, asumimos iPad.
  if (/Macintosh/i.test(ua) && (navigator.maxTouchPoints || 0) > 1) return true
  return false
}

export default function useIsMobileDevice() {
  // No usamos useState/useEffect: el UA no cambia en vivo y queremos un
  // valor estable desde el primer render (evita flash de bottom nav al cargar).
  return detect()
}
