import api from './axios'
import { progresoAxios } from '../utils/subida'

const BASE = '/v1'

// ─── Catálogo ───────────────────────────────────────────────────────────────
export async function getHerramientas(params = {}) {
  const { data } = await api.get(`${BASE}/herramientas/`, { params })
  return data
}

// Listado paginado por páginas: devuelve { items, total, page, per_page, pages }
// para pintar un paginador numérico sin bajar todo el catálogo de herramientas.
export async function getHerramientasPaginado({ page = 1, perPage = 50, q, clasificacion, serializada, incluir_inactivas } = {}) {
  const params = { page, per_page: perPage }
  if (q) params.q = q
  if (clasificacion) params.clasificacion = clasificacion
  if (serializada != null) params.serializada = serializada
  if (incluir_inactivas) params.incluir_inactivas = 1
  const { data } = await api.get(`${BASE}/herramientas/paginado`, { params })
  return data
}

export async function getHerramienta(id) {
  const { data } = await api.get(`${BASE}/herramientas/${id}`)
  return data
}

export async function createHerramienta(payload) {
  const { data } = await api.post(`${BASE}/herramientas/`, payload)
  return data
}

export async function updateHerramienta(id, payload) {
  const { data } = await api.put(`${BASE}/herramientas/${id}`, payload)
  return data
}

export async function deleteHerramienta(id) {
  const { data } = await api.delete(`${BASE}/herramientas/${id}`)
  return data
}

export async function reactivarHerramienta(id) {
  const { data } = await api.post(`${BASE}/herramientas/${id}/reactivar`)
  return data
}

export async function getClasificaciones() {
  const { data } = await api.get(`${BASE}/herramientas/clasificaciones`)
  return data
}

export async function getCategoriasHerramienta() {
  const { data } = await api.get(`${BASE}/herramientas-categorias/`)
  return data
}

export async function upsertCategoriaHerramienta(nombre, payload) {
  const { data } = await api.put(`${BASE}/herramientas-categorias/${encodeURIComponent(nombre)}`, payload)
  return data
}

// ─── Unidades ───────────────────────────────────────────────────────────────
export async function getUnidades(params = {}) {
  const { data } = await api.get(`${BASE}/herramientas-unidades/`, { params })
  return data
}

export async function getUnidad(id) {
  const { data } = await api.get(`${BASE}/herramientas-unidades/${id}`)
  return data
}

export async function createUnidad(payload) {
  const { data } = await api.post(`${BASE}/herramientas-unidades/`, payload)
  return data
}

export async function updateUnidad(id, payload) {
  const { data } = await api.put(`${BASE}/herramientas-unidades/${id}`, payload)
  return data
}

export async function getEventosUnidad(id) {
  const { data } = await api.get(`${BASE}/herramientas-unidades/${id}/eventos`)
  return data
}

export async function validarUnidadQR(qrCode) {
  const { data } = await api.get(`${BASE}/herramientas-unidades/${qrCode}/validar`)
  return data
}

// El QR se pinta con <AuthImage src={authQrPath(id)} />: el endpoint exige
// Bearer, así que NO sirve una URL directa en <img src> (daría 401). Por eso no
// existe un helper que devuelva la URL absoluta — sería una trampa.
export function authQrPath(id) {
  return `${BASE}/herramientas-unidades/${id}/qr-image`
}

export async function darBajaDirecta(unidadId, motivo) {
  const { data } = await api.post(`${BASE}/herramientas-unidades/${unidadId}/dar-baja`, { motivo })
  return data
}

// ─── Asignaciones ───────────────────────────────────────────────────────────
export async function getAsignaciones(params = {}) {
  const { data } = await api.get(`${BASE}/asignaciones-herramienta/`, { params })
  return data
}

export async function crearAsignacion(payload) {
  const { data } = await api.post(`${BASE}/asignaciones-herramienta/`, payload)
  return data
}

export async function devolverAsignacion(id, payload) {
  const { data } = await api.patch(`${BASE}/asignaciones-herramienta/${id}/devolver`, payload)
  return data
}

// ─── Mantenimientos ─────────────────────────────────────────────────────────
export async function getMantenimientos(params = {}) {
  const { data } = await api.get(`${BASE}/mantenimientos-herramienta/`, { params })
  return data
}

export async function crearMantenimiento(payload) {
  const { data } = await api.post(`${BASE}/mantenimientos-herramienta/`, payload)
  return data
}

export async function cerrarMantenimiento(id, payload) {
  const { data } = await api.patch(`${BASE}/mantenimientos-herramienta/${id}/cerrar`, payload)
  return data
}

// ─── Incidencias ────────────────────────────────────────────────────────────
export async function getIncidencias(params = {}) {
  const { data } = await api.get(`${BASE}/incidencias-herramienta/`, { params })
  return data
}

export async function crearIncidencia(payload) {
  const { data } = await api.post(`${BASE}/incidencias-herramienta/`, payload)
  return data
}

export async function atenderIncidencia(id, payload) {
  const { data } = await api.patch(`${BASE}/incidencias-herramienta/${id}/atender`, payload)
  return data
}

// ─── Solicitudes de baja ────────────────────────────────────────────────────
export async function getSolicitudesBaja(params = {}) {
  const { data } = await api.get(`${BASE}/solicitudes-baja-herramienta/`, { params })
  return data
}

export async function crearSolicitudBaja(payload) {
  const { data } = await api.post(`${BASE}/solicitudes-baja-herramienta/`, payload)
  return data
}

export async function autorizarBaja(id, payload = {}) {
  const { data } = await api.patch(`${BASE}/solicitudes-baja-herramienta/${id}/autorizar`, payload)
  return data
}

export async function rechazarBaja(id, payload = {}) {
  const { data } = await api.patch(`${BASE}/solicitudes-baja-herramienta/${id}/rechazar`, payload)
  return data
}

export async function ejecutarBaja(id) {
  const { data } = await api.post(`${BASE}/solicitudes-baja-herramienta/${id}/ejecutar`)
  return data
}

// ─── Fotos / evidencia ──────────────────────────────────────────────────────
export async function subirFotoUnidad(unidadId, file, { tipo = 'FOTO_HERRAMIENTA', eventoId = null } = {}, onProgress) {
  const fd = new FormData()
  fd.append('foto', file)
  fd.append('tipo', tipo)
  if (eventoId) fd.append('evento_id', String(eventoId))
  const { data } = await api.post(`${BASE}/herramientas-unidades/${unidadId}/fotos`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: progresoAxios(onProgress),
  })
  return data
}

// Igual que el QR: la foto se sirve con auth (Bearer). Usar siempre
// <AuthImage src={authFotoPath(...)} />, no una URL directa en <img src>.
export function authFotoPath(unidadId, mediaId) {
  return `${BASE}/herramientas-unidades/${unidadId}/media/${mediaId}`
}

// ─── Dashboard / stats ──────────────────────────────────────────────────────
export async function getStatsHerramientas() {
  const { data } = await api.get(`${BASE}/herramientas/stats`)
  return data
}
