import api from './axios'

const BASE = '/auth'

export async function listarDirectorio() {
  const { data } = await api.get(`${BASE}/users`)
  return data
}

export async function obtenerUsuario(id) {
  const { data } = await api.get(`${BASE}/users/${id}`)
  return data
}

export async function updateProfile(formData) {
  // formData es un FormData con full_name, area, position, factory, contact_info, profile_pic
  const { data } = await api.post(`${BASE}/profile`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function changeOwnPassword(userId, { currentPassword, newPassword }) {
  const { data } = await api.post(`${BASE}/change-password/${userId}`, {
    current_password: currentPassword,
    new_password: newPassword,
  })
  return data
}

export async function setupTwoFa(currentPassword) {
  const { data } = await api.post(`${BASE}/setup-2fa`, {
    current_password: currentPassword,
  })
  return data // { secret, qr }
}

export async function confirmTwoFa({ code, secret, currentPassword }) {
  const { data } = await api.post(`${BASE}/confirm-2fa`, {
    code,
    secret,
    current_password: currentPassword,
  })
  return data
}
