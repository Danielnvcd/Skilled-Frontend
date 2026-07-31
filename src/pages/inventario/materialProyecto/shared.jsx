import { AlertTriangle, Check, X } from 'lucide-react'
import { Badge } from '../../../components/ui'

export const money = (v) =>
  (Number(v) || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

export const num = (v) =>
  (Number(v) || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 })

/**
 * Estado de una línea previsualizada.
 *
 * Tres niveles, no dos: un AVISO se aplica ajustado, un ERROR se omite. Si se
 * mezclaran en un solo «problema», la gente acabaría ignorando los dos.
 */
export function EstadoLinea({ estado }) {
  if (estado === 'ok') {
    return <Badge tone="success" leftIcon={<Check size={11} />}>Lista</Badge>
  }
  if (estado === 'aviso') {
    return <Badge tone="warning" leftIcon={<AlertTriangle size={11} />}>Ajustada</Badge>
  }
  return <Badge tone="danger" leftIcon={<X size={11} />}>Se omite</Badge>
}

/**
 * Resumen de un lote: cuántas líneas listas, ajustadas y omitidas.
 *
 * Se muestra siempre que haya líneas, incluso cuando todas están bien: saber
 * que no hay problemas es parte de poder confirmar con confianza.
 */
export function ResumenLote({ resumen }) {
  if (!resumen) return null
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Badge tone="success" leftIcon={<Check size={11} />}>
        {resumen.ok} lista{resumen.ok === 1 ? '' : 's'}
      </Badge>
      {resumen.avisos > 0 && (
        <Badge tone="warning" leftIcon={<AlertTriangle size={11} />}>
          {resumen.avisos} ajustada{resumen.avisos === 1 ? '' : 's'}
        </Badge>
      )}
      {resumen.errores > 0 && (
        <Badge tone="danger" leftIcon={<X size={11} />}>
          {resumen.errores} se omite{resumen.errores === 1 ? '' : 'n'}
        </Badge>
      )}
      <span className="text-ink-500 tabular-nums">
        · {num(resumen.unidades)} unidades en total
      </span>
    </div>
  )
}

/**
 * El antes y el después de una línea: «120 → 170».
 *
 * Se muestra el RESULTADO, no el incremento. «+50» obliga a hacer la cuenta
 * mental contra un número que no está a la vista.
 */
export function AntesDespues({ actual, resultado, unidad, tone = 'ink' }) {
  const sube = Number(resultado) > Number(actual)
  return (
    <span className="inline-flex items-center gap-1.5 font-mono tabular-nums text-xs">
      <span className="text-ink-400">{num(actual)}</span>
      <span className="text-ink-300">→</span>
      <span className={[
        'font-bold',
        tone === 'muted' ? 'text-ink-500'
          : sube ? 'text-emerald-700 dark:text-emerald-300'
          : 'text-amber-700 dark:text-amber-300',
      ].join(' ')}>
        {num(resultado)}
      </span>
      {unidad && <span className="text-ink-400 font-sans">{unidad}</span>}
    </span>
  )
}

/**
 * Convierte las líneas previsualizadas en el payload de `/asignar`.
 *
 * Se manda `cantidad_pedida` —lo que el usuario pidió— y NO `cantidad_aplicada`
 * —el movimiento que salió de la simulación—. Parece un rodeo, pero es lo
 * correcto: en modo reemplazar la cantidad es el OBJETIVO, no el incremento, así
 * que reenviar el delta haría que el backend lo interpretara como objetivo y
 * asignara de menos. Mandando lo pedido, `/asignar` vuelve a resolver con la
 * misma función que `/previsualizar` y llega al mismo resultado en los dos modos.
 *
 * `almacen_id` y `producto_id` van ya resueltos: reenviar el SKU y el nombre de
 * la bodega en texto obligaría a resolverlos otra vez, sin ganar nada.
 */
export function lineasAplicables(lineas) {
  return (lineas || [])
    .filter((f) => f.estado !== 'error' && f.producto_id && f.almacen_id)
    .map((f) => ({
      producto_id: f.producto_id,
      almacen_id: f.almacen_id,
      cantidad: f.cantidad_pedida,
    }))
}
