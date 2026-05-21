import api from './axios'

const BASE = '/users'

export async function listarUsuarios() {
  const { data } = await api.get(BASE)
  return data
}

export async function crearUsuario({ username, password, role }) {
  const { data } = await api.post(BASE, { username, password, role })
  return data
}

export async function eliminarUsuario(id) {
  const { data } = await api.delete(`${BASE}/${id}`)
  return data
}

export async function cambiarPasswordUsuario(id, newPassword) {
  const { data } = await api.post(`${BASE}/${id}/password`, { new_password: newPassword })
  return data
}
