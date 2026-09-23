// Ayudantes compartidos por las pestañas del lector. Viven aparte de los
// componentes para que el fast refresh de Vite funcione (un archivo .jsx que
// exporta también funciones sueltas obliga a recargar la página entera).

export function formatoFecha(iso) {
  // El backend manda UTC sin zona (naive): se marca como UTC para que el
  // navegador la pase a la hora local de quien mira.
  const d = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
}

export function describirDesfase(s) {
  if (s === null || s === undefined) return '—'
  const abs = Math.abs(s)
  if (abs < 5) return 'sin diferencia'
  const sentido = s > 0 ? 'adelantado' : 'atrasado'
  if (abs < 90) return `${abs} s ${sentido}`
  if (abs < 5400) return `${Math.round(abs / 60)} min ${sentido}`
  if (abs < 172800) return `${Math.round(abs / 3600)} h ${sentido}`
  return `${Math.round(abs / 86400)} días ${sentido}`
}

/** Clave del recurso de eventos. La usa también el encabezado para los KPIs de hoy. */
export function claveEventos(id, filtro = 'todos', horas = 24) {
  return ['hikvision:eventos', { id, filtro, horas }]
}
