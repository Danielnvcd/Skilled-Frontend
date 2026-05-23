import api from './axios'

export async function getMetricas() {
  const { data } = await api.get('/metricas')
  return data
}
