import api from './axios'

/**
 * Búsqueda global para el Command Palette (Ctrl+K).
 * Devuelve { productos, solicitudes, categorias, herramientas, trabajadores, proyectos, total }.
 * Cada item tiene { tipo, id, label, subtitle, url }.
 */
export async function buscarGlobal(q, { signal } = {}) {
  const { data } = await api.get('/v1/buscar', {
    params: { q },
    signal,
  })
  return data
}
