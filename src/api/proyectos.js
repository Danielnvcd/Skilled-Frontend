import api from './axios'

const BASE = '/proyectos'

export async function listarProyectos({ q = '', estado = 'todos', page = 1, perPage = 20, sort = '', dir = 'asc' } = {}) {
  const { data } = await api.get(BASE, { params: { q, estado, page, per_page: perPage, sort, dir } })
  return data
}

export async function listarMisProyectos() {
  const { data } = await api.get(`${BASE}/mios`)
  return data
}

export async function obtenerMeta() {
  const { data } = await api.get(`${BASE}/meta`)
  return data
}

export async function obtenerProyecto(id) {
  const { data } = await api.get(`${BASE}/${id}`)
  return data
}

export async function crearProyecto(payload) {
  // payload = { numero_proyecto, nombre, activo, coordinador_id, participantes_ids }
  const { data } = await api.post(BASE, payload)
  return data
}

export async function actualizarProyecto(id, payload) {
  const { data } = await api.put(`${BASE}/${id}`, payload)
  return data
}
