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

export async function deleteProfilePhoto() {
  // Elimina la foto de perfil del propio usuario. La UI debe mostrar
  // iniciales en su lugar después de esta llamada.
  const { data } = await api.delete(`${BASE}/profile/foto`)
  return data
}

export async function changeOwnPassword(userId, { currentPassword, newPassword, totpCode }) {
  // Si el usuario tiene 2FA activo, el backend ahora exige también `code`.
  // El cliente debe pasarlo como `totpCode`; lo enviamos como `code` en el body.
  // Si el backend responde 401 con `requires_totp: true`, el caller sabrá
  // mostrar el campo de TOTP y reintentar.
  const body = {
    current_password: currentPassword,
    new_password: newPassword,
  }
  if (totpCode) body.code = totpCode
  const { data } = await api.post(`${BASE}/change-password/${userId}`, body)
  return data
}

export async function setupTwoFa(currentPassword) {
  const { data } = await api.post(`${BASE}/setup-2fa`, {
    current_password: currentPassword,
  })
  return data // { secret, qr }
}

export async function confirmTwoFa({ code, secret, currentPassword, currentTwoFaCode }) {
  // currentTwoFaCode es obligatorio SOLO si el usuario ya tiene 2FA activo
  // (re-keying de dispositivo). El backend responde 401 con
  // `requires_current_2fa_code: true` si lo necesita.
  const { data } = await api.post(`${BASE}/confirm-2fa`, {
    code,
    secret,
    current_password: currentPassword,
    current_2fa_code: currentTwoFaCode || undefined,
  })
  return data
}

export async function disableTwoFa({ currentPassword, code }) {
  const { data } = await api.post(`${BASE}/disable-2fa`, {
    current_password: currentPassword,
    code,
  })
  return data
}

// ── Sesiones activas (refresh tokens) ──────────────────────────────────────
// Permite al usuario ver desde qué devices (UA + IP) están abiertas sus
// sesiones y revocar individualmente las que no reconozca.

export async function getMyActivity({ limit = 20 } = {}) {
  const { data } = await api.get(`${BASE}/me/activity`, { params: { limit } })
  return data // [{ id, action, ip, created_at }]
}

export async function listSessions() {
  const { data } = await api.get(`${BASE}/sessions`)
  return data // [{ id, created_at, expires_at, user_agent, ip }, ...]
}

export async function revokeSession(sessionId) {
  const { data } = await api.delete(`${BASE}/sessions/${sessionId}`)
  return data
}

export async function revokeAllSessions() {
  // OJO: este endpoint también invalida el access token actual (bump
  // password_version). Tras la llamada, cualquier request siguiente da 401
  // → bounceToLogin. El llamador debe asumir que la sesión muere acá.
  const { data } = await api.delete(`${BASE}/sessions/all`)
  return data
}

// ── Backup codes para 2FA ──────────────────────────────────────────────────
// Solo aplica si el usuario tiene 2FA activo. El backend rechaza si no.

export async function getBackupCodesStatus() {
  const { data } = await api.get(`${BASE}/backup-codes`)
  return data // { enabled, remaining, low }
}

export async function generateBackupCodes({ currentPassword, code }) {
  // Backend devuelve plaintext UNA SOLA VEZ. El cliente debe mostrarlos y
  // permitir copiar/descargar — el servidor solo guarda hashes.
  const { data } = await api.post(`${BASE}/backup-codes`, {
    current_password: currentPassword,
    code,
  })
  return data // { codes: [...], count, warning }
}

export async function revokeBackupCodes({ currentPassword, code }) {
  const { data } = await api.delete(`${BASE}/backup-codes`, {
    data: { current_password: currentPassword, code },
  })
  return data
}
