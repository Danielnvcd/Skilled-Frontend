import api from './axios'
import { progresoAxios } from '../utils/subida'

const BASE = '/users'

export async function listarUsuarios() {
  const { data } = await api.get(BASE)
  return data
}

export async function crearUsuario({ username, password, role }) {
  const { data } = await api.post(BASE, { username, password, role })
  return data
}

// Desactiva (borrado lógico) — el backend conserva el historial del usuario.
export async function eliminarUsuario(id) {
  const { data } = await api.delete(`${BASE}/${id}`)
  return data
}

export async function reactivarUsuario(id) {
  const { data } = await api.post(`${BASE}/${id}/reactivar`)
  return data
}

export async function cambiarPasswordUsuario(id, newPassword) {
  const { data } = await api.post(`${BASE}/${id}/password`, { new_password: newPassword })
  return data
}

export async function actualizarUsuario(id, payload) {
  // payload = { full_name?, area?, position?, factory?, contact_info? }
  // role NO se acepta (se ignora en backend por seguridad)
  const { data } = await api.put(`${BASE}/${id}`, payload)
  return data
}

export async function subirFotoUsuario(id, file, onProgress) {
  const fd = new FormData()
  fd.append('foto_perfil', file)
  const { data } = await api.post(`${BASE}/${id}/foto`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: progresoAxios(onProgress),
  })
  return data
}
