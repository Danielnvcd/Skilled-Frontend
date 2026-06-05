// Preferencias de UI persistidas localmente (no requieren backend).
// Cada preferencia tiene su key dedicada en localStorage; al cambiar emitimos
// un `storage`-like event en window para que componentes que las consumen
// puedan re-renderizar sin tener que prop-drillear.

const DENSITY_KEY = 'ui:density'
const LANG_KEY = 'ui:lang'

export function getDensity() {
  try {
    const v = localStorage.getItem(DENSITY_KEY)
    return v === 'compact' ? 'compact' : 'comfortable'
  } catch {
    return 'comfortable'
  }
}

export function setDensity(value) {
  try {
    localStorage.setItem(DENSITY_KEY, value === 'compact' ? 'compact' : 'comfortable')
    // Hint a la app: clase en <html> que CSS puede usar globalmente para
    // ajustar paddings/heights de tablas. Componentes que quieran reaccionar
    // pueden escuchar el `storage` event (cross-tab) o el custom abajo.
    document.documentElement.dataset.density = value
    window.dispatchEvent(new CustomEvent('uiprefs:density', { detail: value }))
  } catch {}
}

export function getLang() {
  try {
    return localStorage.getItem(LANG_KEY) || 'es'
  } catch {
    return 'es'
  }
}

export function setLang(value) {
  try {
    localStorage.setItem(LANG_KEY, value || 'es')
    window.dispatchEvent(new CustomEvent('uiprefs:lang', { detail: value }))
  } catch {}
}

// Inicialización al cargar el módulo: marcar dataset.density para que CSS
// global pueda aplicar reglas tipo `[data-density="compact"] td { py-1 }`.
if (typeof document !== 'undefined') {
  try { document.documentElement.dataset.density = getDensity() } catch {}
}
