import api from './axios'

const BASE = '/horas'

export async function listarReportes({ page = 1, q = '', estado = '', perPage = 20 } = {}) {
  const { data } = await api.get(`${BASE}/reportes`, {
    params: { page, q, estado, per_page: perPage },
  })
  return data
}

export async function obtenerProyectosDisponibles() {
  const { data } = await api.get(`${BASE}/proyectos-disponibles`)
  return data
}

export async function crearReporte({ proyecto_id, fecha_inicio, fecha_fin }) {
  const { data } = await api.post(`${BASE}/reportes`, { proyecto_id, fecha_inicio, fecha_fin })
  return data
}

export async function detalleReporte(reporteId) {
  const { data } = await api.get(`${BASE}/reportes/${reporteId}`)
  return data
}

export async function cerrarReporte(reporteId) {
  const { data } = await api.post(`${BASE}/reportes/${reporteId}/cerrar`)
  return data
}

export async function crearRegistro(reporteId, payload) {
  const { data } = await api.post(`${BASE}/reportes/${reporteId}/registros`, payload)
  return data
}

export async function editarRegistro(registroId, payload) {
  const { data } = await api.put(`${BASE}/registros/${registroId}`, payload)
  return data
}

export async function eliminarRegistro(registroId) {
  const { data } = await api.delete(`${BASE}/registros/${registroId}`)
  return data
}
