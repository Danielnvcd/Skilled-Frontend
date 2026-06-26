// Regla de decimales por unidad de medida (debe coincidir con el backend en
// app/routes/inventario_api/solicitudes.py:_unidad_permite_decimales).
//
// Unidades "continuas" (kg, metros, litros…) admiten decimales. El resto
// (pieza, unidad, caja, par, rollo…) se piden en enteros. Las HERRAMIENTAS son
// siempre enteras, sin importar su unidad.
const UNIDADES_DECIMALES = new Set([
  'kg', 'kgs', 'kilo', 'kilos', 'kilogramo', 'kilogramos',
  'g', 'gr', 'grs', 'gramo', 'gramos', 'mg',
  'ton', 'tonelada', 'toneladas',
  'l', 'lt', 'lts', 'litro', 'litros', 'ml', 'mililitro', 'mililitros',
  'gal', 'galon', 'galones',
  'm', 'mt', 'mts', 'metro', 'metros',
  'cm', 'centimetro', 'centimetros', 'mm', 'milimetro', 'milimetros',
  'km', 'kilometro', 'kilometros', 'm2', 'm3',
  'pulgada', 'pulgadas', 'in', 'ft', 'pie', 'pies', 'yarda', 'yardas',
  'oz', 'onza', 'onzas', 'lb', 'lbs', 'libra', 'libras',
])

function normalizar(unidad) {
  return String(unidad || '')
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita acentos
    .replace('²', '2').replace('³', '3')     // m² / m³ -> m2 / m3
    .replace(/[.\s]/g, '') // "Kg." / "M TS" -> "kg" / "mts"
}

/** ¿La unidad admite cantidades con decimales (kg, m, litro…)? */
export function unidadPermiteDecimales(unidad) {
  const u = normalizar(unidad)
  return u ? UNIDADES_DECIMALES.has(u) : false
}
