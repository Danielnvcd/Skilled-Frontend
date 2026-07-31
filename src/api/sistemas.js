import api from './axios'

// Panel de sistemas (TI/soporte). Todos estos endpoints exigen rol `sistemas`
// o `super_admin` CON 2FA activo; si falta el segundo factor el backend
// responde 403 con `requiere_2fa: true` para que la UI mande a inscribirlo en
// vez de mostrar un error seco.

export async function getEstadoServidor() {
  const { data } = await api.get('/sistemas/estado')
  return data
}

// Devuelve dos capas: `eventos`/`resumen` (muestra con detalle, muestreada) y
// `contadores` (métricas exactas por día, sin muestreo).
export async function getPeticiones({ limite = 200, dias = 7 } = {}) {
  const { data } = await api.get('/sistemas/peticiones', { params: { limite, dias } })
  return data
}

// ── Cuentas ─────────────────────────────────────────────────────────────────

export async function getBloqueos() {
  const { data } = await api.get('/sistemas/bloqueos')
  return data
}

export async function liberarBloqueo(tipo, identificador) {
  const { data } = await api.delete(
    `/sistemas/bloqueos/${tipo}/${encodeURIComponent(identificador)}`,
  )
  return data
}

export async function getSin2fa() {
  const { data } = await api.get('/sistemas/sin-2fa')
  return data
}

// ── Mantenimiento ───────────────────────────────────────────────────────────

export async function getAlmacenamiento() {
  const { data } = await api.get('/sistemas/almacenamiento')
  return data
}

export async function purgarBitacora(meses) {
  const { data } = await api.post('/sistemas/purgar-bitacora', { meses })
  return data
}

export async function getImagenes() {
  const { data } = await api.get('/sistemas/imagenes')
  return data
}

export async function reintentarImagenes() {
  const { data } = await api.post('/sistemas/imagenes/reintentar')
  return data
}

export async function getSesiones() {
  const { data } = await api.get('/sistemas/sesiones')
  return data
}

export async function revocarSesion(sessionId) {
  const { data } = await api.delete(`/sistemas/sesiones/${sessionId}`)
  return data
}

export async function getEventosSeguridad({ dias = 7, limite = 100 } = {}) {
  const { data } = await api.get('/sistemas/eventos-seguridad', { params: { dias, limite } })
  return data
}

/** ¿El 403 viene de que falta el 2FA, y no de un rol incorrecto? */
export function esFalta2fa(err) {
  return err?.response?.status === 403 && err?.response?.data?.requiere_2fa === true
}
