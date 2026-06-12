import api from './axios'

// Panel financiero (rol finanzas; admin también puede verlo). Agregados de
// solo lectura: dispersión de nómina por semana, préstamos por recuperar y
// ajustes Inbursa pendientes. Sin PII — solo montos y conteos.
export async function obtenerPanelFinanzas() {
  const { data } = await api.get('/dashboard/finanzas')
  return data
}
