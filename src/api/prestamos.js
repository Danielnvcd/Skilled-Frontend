import api from './axios'

const BASE = '/prestamos'

export async function listarPrestamos({ page = 1, q = '', estado = '', perPage = 20 } = {}) {
  const { data } = await api.get(BASE, { params: { page, q, estado, per_page: perPage } })
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
