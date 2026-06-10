import api from './axios'

const BASE = '/prestamos'

export async function listarPrestamos({ page = 1, q = '', estado = '', perPage = 20, sort = '', dir = '' } = {}) {
  const params = { page, q, estado, per_page: perPage }
  if (sort) {
    params.sort = sort
    params.dir = dir || 'asc'
  }
  const { data } = await api.get(BASE, { params })
  return data
}

export async function obtenerTrabajadoresDisponibles() {
  const { data } = await api.get(`${BASE}/trabajadores-disponibles`)
  return data
}

export async function obtenerPrestamo(id) {
  const { data } = await api.get(`${BASE}/${id}`)
  return data
}

export async function crearPrestamo(payload) {
  const { data } = await api.post(BASE, payload)
  return data
}

export async function editarPrestamo(id, payload) {
  const { data } = await api.put(`${BASE}/${id}`, payload)
  return data
}

export async function abonarPrestamo(id, payload) {
  // { monto, notas? }
  const { data } = await api.post(`${BASE}/${id}/abonar`, payload)
  return data
}

export async function liquidarPrestamo(id) {
  const { data } = await api.post(`${BASE}/${id}/liquidar`)
  return data
}

export async function exportarExcelPrestamos(trabajadorId, nombreSugerido) {
  const res = await api.get(`${BASE}/trabajadores/${trabajadorId}/excel`, { responseType: 'blob' })
  const cd = res.headers['content-disposition'] || ''
  const match = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)/i)
  const filename = match ? decodeURIComponent(match[1]) : (nombreSugerido || `prestamos_${trabajadorId}.xlsx`)
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
