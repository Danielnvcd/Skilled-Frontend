// Detección de productos de CABLE por categoría. Debe coincidir con el backend
// (_es_categoria_cable en app/routes/inventario_api/solicitudes.py): una
// categoría es de cable si su texto contiene "cable" (sin acentos, minúsculas).
//
// Los productos de cable llevan dos atributos extra en la plantilla:
//   - cable_tipo    → "Tipo" (THHN, THW, desnudo…)
//   - cable_calibre → "Tamaño (mm²/AWG)" (12, 2/0, 500 kcmil…)
// y su unidad se fuerza a "M" (metros).

export const CABLE_UNIDAD = 'M'

export function esCategoriaCable(categoria) {
  const c = String(categoria || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos
  return c.includes('cable')
}

/** Texto corto "THHN · 12" para chips/etiquetas; '' si no hay datos. */
export function cableResumen(p) {
  if (!p) return ''
  const tipo = (p.cable_tipo || '').trim()
  const cal = (p.cable_calibre || '').trim()
  if (!tipo && !cal) return ''
  return [tipo, cal].filter(Boolean).join(' · ')
}
