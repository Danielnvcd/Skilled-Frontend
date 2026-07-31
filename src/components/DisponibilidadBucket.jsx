import { Layers, Warehouse } from 'lucide-react'
import { InfoTip } from './ui'
import {
  REGLA_NINGUNA, disponibleSegunRegla, explicaDisponible,
} from '../utils/buckets'

const fmt = (v) => (Number(v) || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 })

/**
 * De dónde va a salir el material, en una línea.
 *
 * Se muestra el DESGLOSE, no solo el total: 40 apartadas al proyecto más 60
 * libres se comportan distinto según la regla del movimiento, y enseñar «100» a
 * secas es exactamente lo que producía la sorpresa al guardar.
 *
 * Props:
 *   bucket    {proyecto, general} — de utils/buckets o del endpoint en lote
 *   regla     'con_fallback' | 'exacto' | 'ninguna'
 *   requerido cuánto se quiere sacar; si excede, se pinta en rojo
 *   proyecto  etiqueta del proyecto en juego (null = sin proyecto)
 */
export default function DisponibilidadBucket({
  bucket, regla, requerido = null, proyecto = null, unidad = '', compacto = false,
}) {
  if (!bucket || regla === REGLA_NINGUNA) return null

  const disponible = disponibleSegunRegla(bucket, regla)
  const conProyecto = !!proyecto
  const excede = requerido != null && Number(requerido) > disponible
  const p = Number(bucket.proyecto) || 0
  const g = Number(bucket.general) || 0

  // En la regla exacta lo libre NO participa, así que mostrarlo al lado del
  // total invitaría a contarlo. Se menciona aparte, en gris, para que quede
  // claro que existe pero no cuenta aquí.
  const exacta = regla === 'exacto'

  return (
    <div className={compacto ? 'text-[11px]' : 'text-xs'}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className={[
          'font-mono tabular-nums font-bold',
          excede ? 'text-rose-600 dark:text-rose-400'
            : disponible > 0 ? 'text-ink-800 dark:text-ink-100'
            : 'text-ink-400',
        ].join(' ')}>
          {fmt(disponible)} {unidad}
        </span>
        <span className="text-ink-400">disponible</span>
        <InfoTip text={explicaDisponible(bucket, regla, { conProyecto })} />
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-ink-500">
        {conProyecto && (
          <span className="inline-flex items-center gap-1">
            <Layers size={10} className="text-ink-400" />
            <span className="font-mono tabular-nums">{fmt(p)}</span>
            <span className="text-ink-400">de {proyecto}</span>
          </span>
        )}
        <span className={[
          'inline-flex items-center gap-1',
          exacta && conProyecto ? 'text-ink-300 line-through decoration-ink-300' : '',
        ].join(' ')}>
          <Warehouse size={10} className="text-ink-400" />
          <span className="font-mono tabular-nums">{fmt(g)}</span>
          <span className="text-ink-400">libre</span>
        </span>
        {exacta && conProyecto && g > 0 && (
          <span className="text-ink-400 italic">no cuenta en este tipo</span>
        )}
      </div>

      {excede && (
        <p className="text-rose-600 dark:text-rose-400 font-medium mt-0.5">
          Pides {fmt(requerido)}; solo hay {fmt(disponible)}.
        </p>
      )}
    </div>
  )
}
