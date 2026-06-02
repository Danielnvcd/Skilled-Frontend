import api from './axios'

export async function obtenerDashboard() {
  const { data } = await api.get('/dashboard')
  return data
}

// Agregador de alertas accionables del admin (docs/credenciales por vencer,
// préstamos liquidados sin cerrar, periodos de ajuste vencidos).
// Solo lectura, sin paginación: el backend ya capa a 5 items por categoría.
export async function obtenerAlertas() {
  const { data } = await api.get('/dashboard/alertas')
  return data
}
