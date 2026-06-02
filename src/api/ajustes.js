import api from './axios'

const BASE = '/ajustes'

export async function listarPeriodos({ page = 1, q = '', perPage = 20 } = {}) {
  const { data } = await api.get(`${BASE}/periodos`, { params: { page, q, per_page: perPage } })
  return data
}

export async function obtenerTrabajadoresDisponibles() {
  const { data } = await api.get(`${BASE}/trabajadores-disponibles`)
  return data
}

export async function crearPeriodo(payload) {
  // { nombre, fecha_inicio, fecha_fin, trabajadores: [{trabajador_id, monto_meta}] }
  const { data } = await api.post(`${BASE}/periodos`, payload)
  return data
}

export async function detallePeriodo(id) {
  const { data } = await api.get(`${BASE}/periodos/${id}`)
  return data
}

export async function cerrarPeriodo(id) {
  const { data } = await api.post(`${BASE}/periodos/${id}/cerrar`)
  return data
}

export async function agregarDescuento(periodoId, payload) {
  // { trabajador_id, monto, fecha_descuento, notas? }
  const { data } = await api.post(`${BASE}/periodos/${periodoId}/descuentos`, payload)
  return data
}

export async function eliminarDescuento(descuentoId) {
  const { data } = await api.delete(`${BASE}/descuentos/${descuentoId}`)
  return data
}

// Eliminar varios descuentos en una sola transacción.
// El backend salta (no falla) los que estén cobrados o pertenezcan a
// periodos cerrados y los reporta en `skipped`.
export async function bulkEliminarDescuentos(descuentoIds) {
  const { data } = await api.post(`${BASE}/descuentos/bulk-delete`, {
    descuento_ids: descuentoIds,
  })
  return data
}

export async function exportarExcelPeriodo(periodoId, nombreSugerido) {
  const res = await api.get(`${BASE}/periodos/${periodoId}/excel`, { responseType: 'blob' })
  const cd = res.headers['content-disposition'] || ''
  const match = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)/i)
  const filename = match ? decodeURIComponent(match[1]) : (nombreSugerido || `ajuste_periodo_${periodoId}.xlsx`)
  const blob = new Blob([res.data], { type: res.headers['content-type'] })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
