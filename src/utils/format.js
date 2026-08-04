/**
 * Formato de fechas, moneda y números. Una sola definición para toda la app.
 *
 * ── Por qué existe ──────────────────────────────────────────────────────────
 * Había ~18 `fmtFecha` / `fmtMoney` locales, uno por pantalla, y NO eran
 * equivalentes entre sí: unos hacían `new Date(iso + 'T00:00:00')` y otros
 * `new Date(iso)`. La diferencia no es cosmética.
 *
 * Cuando el backend manda una fecha SIN hora ("2026-08-04" — todo lo que sale
 * de un `db.Date`), `new Date("2026-08-04")` la interpreta como medianoche UTC
 * por especificación. En México (UTC-6) eso son las 18:00 del día ANTERIOR, así
 * que la pantalla muestra 03/ago. Añadir "T00:00:00" la hace local y arregla el
 * corrimiento — pero aplicado a un timestamp completo lo rompería.
 *
 * `parseFecha` distingue los dos casos, así que estos helpers son correctos con
 * ambos formatos y ninguna pantalla tiene que acordarse de la regla.
 */

const LOCALE = 'es-MX'
const MONEDA = 'MXN'

// "2026-08-04" sí; "2026-08-04T10:30:00Z" no.
const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/

/**
 * Convierte lo que mande el backend a un `Date`, o `null` si no es una fecha.
 * Acepta string ISO (con o sin hora), `Date` y epoch en milisegundos.
 */
export function parseFecha(valor) {
  if (valor == null || valor === '') return null
  if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor
  if (typeof valor === 'number') {
    const d = new Date(valor)
    return isNaN(d.getTime()) ? null : d
  }
  if (typeof valor !== 'string') return null
  // La T00:00:00 es lo que ancla la fecha al huso local en vez de a UTC.
  const d = new Date(SOLO_FECHA.test(valor) ? `${valor}T00:00:00` : valor)
  return isNaN(d.getTime()) ? null : d
}

function formatear(valor, opciones, vacio) {
  const d = parseFecha(valor)
  if (!d) return vacio
  return d.toLocaleString(LOCALE, opciones)
}

/** `04 ago 2026` — el formato más usado en listados y fichas. */
export function fmtFecha(valor, vacio = '—') {
  return formatear(valor, { day: '2-digit', month: 'short', year: 'numeric' }, vacio)
}

/** `04/08/2026` — para tablas densas y columnas estrechas. */
export function fmtFechaCorta(valor, vacio = '—') {
  return formatear(valor, { day: '2-digit', month: '2-digit', year: 'numeric' }, vacio)
}

/** `04 de agosto de 2026` — encabezados y documentos impresos. */
export function fmtFechaLarga(valor, vacio = '—') {
  return formatear(valor, { day: '2-digit', month: 'long', year: 'numeric' }, vacio)
}

/** `04/08/2026, 10:30 a.m.` — bitácora, timeline, auditoría. */
export function fmtFechaHora(valor, vacio = '—') {
  return formatear(
    valor,
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    },
    vacio,
  )
}

/** `$1,234.56` — siempre con dos decimales, que es como se lee el dinero. */
export function fmtMoneda(valor, vacio = '—') {
  const n = Number(valor)
  if (valor == null || valor === '' || isNaN(n)) return vacio
  return n.toLocaleString(LOCALE, {
    style: 'currency',
    currency: MONEDA,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * `1,234.5` — cantidades de inventario. Sin decimales forzados: una pieza es
 * "3", no "3.00"; el cable sí necesita "12.5".
 */
export function fmtNumero(valor, { maxDecimales = 2, vacio = '—' } = {}) {
  const n = Number(valor)
  if (valor == null || valor === '' || isNaN(n)) return vacio
  return n.toLocaleString(LOCALE, { maximumFractionDigits: maxDecimales })
}
