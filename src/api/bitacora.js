import api from './axios'

const BASE = '/bitacora'

export async function listarBitacora({ page = 1, fechaFiltro = '', perPage = 50 } = {}) {
  const { data } = await api.get(BASE, {
    params: { page, fecha_filtro: fechaFiltro, per_page: perPage },
  })
  return data
}

export async function detalleLog(id) {
  const { data } = await api.get(`${BASE}/${id}`)
  return data
}
