/**
 * Salud de la conexión ERP ↔ lector (pestaña «Equipo»).
 *
 * Todo sale de la base del ERP, no del lector: reconexiones y retraso de las
 * últimas 24 h, el último problema y la bitácora de sucesos que escribe la
 * escucha. Se refresca sola cuando la escucha se conecta/desconecta o llega
 * un evento.
 */
import { Activity, AlertTriangle } from 'lucide-react'
import { Card, CardHeader, Badge, Skeleton } from '../../components/ui'
import { useResource } from '../../hooks/useResource'
import { extractApiError } from '../../utils/apiError'
import { getSalud } from '../../api/hikvision'
import { formatoFecha } from './formato'

const SUCESOS = {
  CONECTADO: { texto: 'Conectado', tono: 'success' },
  DESCONECTADO: { texto: 'Desconectado', tono: 'warning' },
  AUTENTICACION: { texto: 'Contraseña rechazada', tono: 'danger' },
  SERIALES_REINICIADOS: { texto: 'Numeración reiniciada', tono: 'warning' },
  EQUIPO_CAMBIADO: { texto: 'Equipo distinto', tono: 'danger' },
  FIRMWARE_CAMBIADO: { texto: 'Firmware actualizado', tono: 'info' },
  RELOJ_DESFASADO: { texto: 'Reloj desajustado', tono: 'warning' },
  IP_DINAMICA: { texto: 'IP dinámica', tono: 'warning' },
}

export default function TarjetaSalud({ dispositivoId }) {
  const salud = useResource(['hikvision:salud', { id: dispositivoId }], () => getSalud(dispositivoId), {
    staleMs: 30_000, invalidateOn: ['hikvision:changed', 'hikvision:evento'],
  })
  const s = salud.data

  return (
    <Card className="p-5 lg:col-span-2">
      <CardHeader
        title={<span className="inline-flex items-center gap-2"><Activity size={16} /> Salud de la conexión</span>}
        description="Cómo le ha ido a la conexión en tiempo real con el lector en las últimas 24 horas."
        actions={s && (s.tiempo_real.en_vivo
          ? <Badge tone="success" dot>En vivo</Badge>
          : <Badge tone="warning" dot>Sin tiempo real</Badge>)}
      />
      {salud.loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : salud.error ? (
        <p className="inline-flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertTriangle size={16} className="mt-0.5" />
          {extractApiError(salud.error, 'No se pudo leer la salud de la conexión.')}
        </p>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metrica
              etiqueta="Retraso típico"
              valor={s.ultimas_24h.retraso_mediana_s === null ? '—' : `${s.ultimas_24h.retraso_mediana_s} s`}
              detalle={s.ultimas_24h.retraso_max_s === null ? 'sin accesos en 24 h'
                : `máx. ${s.ultimas_24h.retraso_max_s} s · del acceso a su registro`}
            />
            <Metrica
              etiqueta="Reconexiones"
              valor={s.ultimas_24h.conexiones}
              detalle={`${s.ultimas_24h.desconexiones} desconexión(es) en 24 h`}
              alerta={s.ultimas_24h.desconexiones > 3}
            />
            <Metrica
              etiqueta="Eventos recibidos"
              valor={s.ultimas_24h.eventos}
              detalle={s.ultimas_24h.recuperados_tras_caida
                ? `${s.ultimas_24h.recuperados_tras_caida} recuperado(s) tras una caída`
                : 'todos llegaron en vivo'}
            />
            <Metrica
              etiqueta="Último evento"
              valor={s.segundos_desde_ultimo_evento === null ? '—' : hace(s.segundos_desde_ultimo_evento)}
              detalle={s.ultimo_evento ? formatoFecha(s.ultimo_evento) : 'aún no hay eventos'}
            />
          </div>

          {s.ultimo_problema && (
            <p className="rounded-md bg-ink-50 px-3 py-2 text-xs text-ink-600 dark:bg-ink-800/60 dark:text-ink-300">
              Último problema: <strong>{(SUCESOS[s.ultimo_problema.tipo] || {}).texto || s.ultimo_problema.tipo}</strong>
              {s.ultimo_problema.detalle && <> — {s.ultimo_problema.detalle}</>}
              {' '}({formatoFecha(s.ultimo_problema.creado_en)})
            </p>
          )}

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
              Bitácora reciente
            </p>
            {s.sucesos.length ? (
              <ul className="divide-y divide-ink-100 rounded-lg ring-1 ring-ink-200 dark:divide-ink-800 dark:ring-ink-700">
                {s.sucesos.map((x) => {
                  const tipo = SUCESOS[x.tipo] || { texto: x.tipo, tono: 'neutral' }
                  return (
                    <li key={x.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <span className="w-32 flex-shrink-0 text-xs tabular-nums text-ink-500 dark:text-ink-400">
                        {formatoFecha(x.creado_en)}
                      </span>
                      <Badge tone={tipo.tono}>{tipo.texto}</Badge>
                      <span className="min-w-0 flex-1 truncate text-xs text-ink-600 dark:text-ink-300">
                        {x.detalle}
                      </span>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-sm text-ink-500 dark:text-ink-400">Sin sucesos registrados todavía.</p>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

function Metrica({ etiqueta, valor, detalle, alerta }) {
  return (
    <div className="rounded-lg bg-ink-50 p-3 dark:bg-ink-800/50">
      <p className="text-xs text-ink-500 dark:text-ink-400">{etiqueta}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${alerta ? 'text-amber-600 dark:text-amber-400' : 'text-ink-900 dark:text-ink-100'}`}>
        {valor}
      </p>
      <p className="mt-0.5 truncate text-xs text-ink-500 dark:text-ink-400">{detalle}</p>
    </div>
  )
}

function hace(segundos) {
  if (segundos < 60) return `hace ${segundos} s`
  if (segundos < 3600) return `hace ${Math.round(segundos / 60)} min`
  if (segundos < 172800) return `hace ${Math.round(segundos / 3600)} h`
  return `hace ${Math.round(segundos / 86400)} días`
}
