import { useEffect } from 'react'

/**
 * Avisa al usuario antes de perder cambios sin guardar.
 *
 *   useUnsavedChanges(isDirty)
 *
 * Cubre la salida a nivel navegador (recargar, cerrar pestaña, atrás del
 * navegador, escribir otra URL): registra un `beforeunload` mientras `isDirty`
 * sea true, lo que dispara el diálogo nativo "¿Salir del sitio?".
 *
 * OJO: la navegación SPA interna (hacer clic en un <Link> o en el menú) NO la
 * intercepta `beforeunload` — react-router con BrowserRouter no expone un
 * blocker. Para esos casos usa `confirmIfDirty` en los botones/links de salida
 * del propio formulario (Cancelar, "Volver", etc.).
 */
export function useUnsavedChanges(isDirty) {
  useEffect(() => {
    if (!isDirty) return
    const handler = (e) => {
      e.preventDefault()
      // Navegadores modernos ignoran el texto y muestran su mensaje estándar,
      // pero hay que setear returnValue para que el diálogo aparezca.
      e.returnValue = ''
      return ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])
}

/**
 * Helper para guardas de navegación interna (Link/botón "Volver"/Cancelar).
 * Devuelve true si se puede continuar (no hay cambios, o el usuario confirma
 * descartarlos). Úsalo así:
 *
 *   onClick={(e) => { if (!confirmIfDirty(isDirty)) e.preventDefault() }}
 */
export function confirmIfDirty(isDirty, mensaje = 'Tienes cambios sin guardar. ¿Salir y descartarlos?') {
  if (!isDirty) return true
  return window.confirm(mensaje)
}

export default useUnsavedChanges
