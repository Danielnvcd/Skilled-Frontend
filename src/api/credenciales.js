import api from './axios'

const BASE = '/trabajadores'

export async function listarCredencialesPlanta({ page = 1, q = '', perPage = 20 } = {}) {
  const { data } = await api.get(`${BASE}/credenciales-lista`, {
    params: { page, q, per_page: perPage },
  })
  return data
}

export async function guardarCredencialesPlanta(id, { credenciales, observaciones }) {
  const { data } = await api.post(`${BASE}/${id}/credenciales`, {
    credenciales,
    observaciones,
  })
  return data
}
