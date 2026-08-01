/**
 * Reglas de disponibilidad por bucket (stock por proyecto).
 *
 * El stock vive en buckets (bodega × proyecto), donde `proyecto = null` es el
 * material libre — «General». El backend aplica DOS reglas distintas al sacar
 * material, y las pantallas mostraban el stock global en vez de la que aplica.
 * De ahí venía el «hay 500» seguido de un error al guardar.
 *
 * Este archivo es el ÚNICO lugar del SPA donde vive la tabla de qué tipo usa
 * qué regla. Repetirla en cada pantalla es como se desincronizan.
 *
 *   'con_fallback'  se agota el bucket del proyecto y el resto sale de General.
 *                   SALIDA, AJUSTE−, entrega directa, entrega de solicitud.
 *   'exacto'        solo el bucket del proyecto; NO echa mano de lo libre,
 *                   porque el material conserva su etiqueta al moverse.
 *                   TRASPASO, REASIGNACION.
 *   'ninguna'       el movimiento no consume: ENTRADA, AJUSTE+.
 *
 * Referencia en el backend: `_consumir_proyecto_luego_general` y
 * `_consumir_bucket_exacto` en app/routes/inventario_api/_core/stock.py
 */

export const REGLA_CON_FALLBACK = 'con_fallback'
export const REGLA_EXACTA = 'exacto'
export const REGLA_NINGUNA = 'ninguna'

/**
 * Qué regla aplica un movimiento.
 * @param {string} tipo ENTRADA | SALIDA | AJUSTE | TRASPASO | REASIGNACION
 * @param {string} ajusteDir '+' | '-' — solo relevante para AJUSTE
 */
export function reglaDeDisponibilidad(tipo, ajusteDir = '+') {
  if (tipo === 'SALIDA') return REGLA_CON_FALLBACK
  if (tipo === 'AJUSTE') return ajusteDir === '-' ? REGLA_CON_FALLBACK : REGLA_NINGUNA
  if (tipo === 'TRASPASO' || tipo === 'REASIGNACION') return REGLA_EXACTA
  return REGLA_NINGUNA   // ENTRADA
}

/**
 * Cuánto se puede sacar realmente, dado un bucket y una regla.
 * @param {{proyecto:number, general:number}} bucket
 */
export function disponibleSegunRegla(bucket, regla) {
  if (!bucket) return null
  const proyecto = Number(bucket.proyecto) || 0
  const general = Number(bucket.general) || 0
  if (regla === REGLA_EXACTA) return proyecto
  if (regla === REGLA_CON_FALLBACK) return proyecto + general
  return null
}

/**
 * Arma los buckets a partir de `stocks_proyecto` de /productos/<id>/stocks.
 *
 * Ese endpoint devuelve una fila por (bodega, proyecto); aquí se colapsa a los
 * dos números que interesan para una bodega concreta. `proyectoId` vacío o null
 * significa que no hay bucket de proyecto en juego.
 */
export function bucketDesdeStocks(stocksProyecto, almacenId, proyectoId) {
  const filas = stocksProyecto ?? []
  let proyecto = 0
  let general = 0
  for (const f of filas) {
    if (String(f.almacen_id) !== String(almacenId)) continue
    if (f.proyecto_id == null) general += Number(f.cantidad) || 0
    else if (proyectoId && String(f.proyecto_id) === String(proyectoId)) {
      proyecto += Number(f.cantidad) || 0
    }
  }
  return { proyecto, general }
}

/**
 * Explica de dónde saldría el material, en una frase.
 *
 * Se nombra el desglose y no solo el total porque el total esconde justo lo que
 * confunde: 40 del proyecto más 60 libres se comportan distinto según la regla,
 * y ver solo «100» es lo que producía la sorpresa al guardar.
 */
export function explicaDisponible(bucket, regla, { conProyecto = false } = {}) {
  if (!bucket || regla === REGLA_NINGUNA) return null
  const proyecto = Number(bucket.proyecto) || 0
  const general = Number(bucket.general) || 0

  if (regla === REGLA_EXACTA) {
    return conProyecto
      ? `Solo puede salir lo apartado a este proyecto (${fmt(proyecto)}). Lo libre no cuenta: el material conserva su etiqueta al moverse.`
      : `Sale del stock libre (${fmt(general)}).`
  }
  if (!conProyecto) return `Sale del stock libre (${fmt(general)}).`
  if (proyecto === 0) return `Este proyecto no tiene nada apartado; saldría todo de General (${fmt(general)}).`
  if (general === 0) return `Sale de lo apartado a este proyecto (${fmt(proyecto)}).`
  return `Primero sale lo del proyecto (${fmt(proyecto)}), luego de General (${fmt(general)}).`
}

function fmt(v) {
  return (Number(v) || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 })
}
