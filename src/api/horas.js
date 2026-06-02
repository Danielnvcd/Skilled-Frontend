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

// Bulk upsert (usado por "Pegar desde Excel"). Devuelve
// { created, updated, skipped: [{idx, reason}] }.
export async function bulkUpsertRegistros(reporteId, registros) {
  const { data } = await api.post(
    `${BASE}/reportes/${reporteId}/registros/bulk`,
    { registros },
  )
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

// ── Móvil / QR ──────────────────────────────────────────────────────────────

export async function obtenerResumenMovil() {
  const { data } = await api.get(`${BASE}/movil/resumen`)
  return data
}

export async function qrCheck({ qr_code, reporte_id }) {
  const { data } = await api.post(`${BASE}/qr-check`, { qr_code, reporte_id })
  return data
}

// ── Admin QR ────────────────────────────────────────────────────────────────

export async function listarTrabajadoresQR() {
  const { data } = await api.get(`${BASE}/qr/trabajadores`)
  return data
}

export async function generarQR(trabajadorId) {
  const { data } = await api.post(`${BASE}/qr/generar/${trabajadorId}`)
  return data
}

export async function descargarImagenQR(qrCode) {
  const res = await api.get(`${BASE}/qr/imagen/${encodeURIComponent(qrCode)}`, {
    responseType: 'blob',
  })
  return URL.createObjectURL(new Blob([res.data], { type: 'image/png' }))
}
