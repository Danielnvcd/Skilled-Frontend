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
