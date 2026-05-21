import api from './axios'

export async function obtenerDashboard() {
  const { data } = await api.get('/dashboard')
  return data
}
