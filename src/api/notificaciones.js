import api from './axios'

const BASE = '/notificaciones'

export async function obtenerResumen() {
  const { data } = await api.get(`${BASE}/resumen`)
  return data
}

export async function marcarLeida(id) {
  const { data } = await api.post(`${BASE}/${id}/leer`)
  return data
}

export async function marcarTodas() {
  const { data } = await api.post(`${BASE}/marcar_todas`)
  return data
}
