/**
 * Estado del servidor: Redis, base de datos y proceso.
 *
 * Nota de despliegue: en producción corren 4 workers de gunicorn detrás de
 * nginx (+ Cloudflare Tunnel). El pid, el uptime y el pool de conexiones que
 * llegan aquí describen SOLO al worker que atendió la petición, así que
 * cambian entre refrescos. El backend lo declara en `alcance` y lo mostramos
 * explícitamente: sin ese aviso el panel parecería estar diciendo que el
 * servidor se reinicia solo.
 */
import {
  Gauge, RefreshCw, Server, Database, Zap, GitCommitHorizontal,
} from 'lucide-react'
import { PageHeader, Button, Skeleton } from '../../components/ui'
import { useResource } from '../../hooks/useResource'
import { getEstadoServidor } from '../../api/sistemas'
import { EstadoCarga, Indicador, fmtDuracion, useRefrescar, BotonActualizar } from './PanelLayout'

export default function EstadoServidor() {
  const { data, loading, error, refetch } = useResource(
    'sistemas:estado',
    getEstadoServidor,
    // Estado de infraestructura: se revalida seguido, pero sin polling activo
    // — refrescar es explícito para no generar tráfico de fondo constante.
    { staleMs: 10_000 },
  )
  const { refrescando, refrescar } = useRefrescar(refetch)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Estado del servidor"
        description="Salud de la infraestructura que sostiene la aplicación."
        icon={Gauge}
        actions={
          <BotonActualizar onClick={refrescar} refrescando={refrescando} ruta="/sistemas/estado" />
        }
      />

      <EstadoCarga
        error={error}
        loading={loading}
        skeleton={<div className="grid gap-3 sm:grid-cols-2"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>}
      >
        {data && (
          <div className="space-y-5">
            {Array.isArray(data.defensas_degradadas) && data.defensas_degradadas.length > 0 && (
              <div className="rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/20">
                <h2 className="text-sm font-semibold text-red-900 dark:text-red-200">
                  Defensas degradadas
                </h2>
                <p className="mt-1 text-xs text-red-800/80 dark:text-red-300/80">
                  Estas protecciones dependen de Redis y ahora mismo no están activas.
                  La aplicación sigue funcionando; la seguridad está reducida.
                </p>
                <ul className="mt-2 space-y-1">
                  {data.defensas_degradadas.map((d) => (
                    <li key={d} className="text-xs leading-relaxed text-red-800 dark:text-red-300">
                      • {d}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Indicador ok={data.redis?.ok} titulo="Redis" detalle={data.redis?.detalle} />
              <Indicador ok={data.base_datos?.ok} titulo="Base de datos" detalle={data.base_datos?.detalle} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel titulo="Proceso" icono={Server}>
                <Dato etiqueta="PID" valor={data.proceso?.pid} />
                <Dato etiqueta="Activo desde hace" valor={fmtDuracion(data.proceso?.uptime_segundos)} />
                <Dato etiqueta="Entorno" valor={data.proceso?.entorno} />
                <Dato etiqueta="Modo Socket.IO" valor={data.proceso?.modo_socketio} />
              </Panel>

              {/* Saber qué versión corre evita diagnosticar durante media hora
                  un fallo cuya causa es que el servidor va atrás del repo. */}
              <Panel titulo="Versión desplegada" icono={GitCommitHorizontal}>
                <Dato etiqueta="Commit" valor={data.version?.commit || 'desconocido'} />
                <Dato
                  etiqueta="Fecha"
                  valor={data.version?.fecha
                    ? new Date(data.version.fecha).toLocaleString('es-MX', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })
                    : '—'}
                />
                <Dato etiqueta="Origen del dato" valor={data.version?.origen} />
                {data.version?.asunto && (
                  <p className="pt-1 text-xs leading-snug text-ink-500 dark:text-ink-400">
                    {data.version.asunto}
                  </p>
                )}
                {/* Si no se pudo averiguar la versión, se dice POR QUÉ. Un
                    «desconocido» a secas no permite corregir nada. */}
                {data.version?.detalle && (
                  <p className="mt-1 rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] leading-snug text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
                    No se pudo leer del repositorio: {data.version.detalle}. Lo más
                    robusto en el servidor es escribir un archivo VERSION al desplegar.
                  </p>
                )}
              </Panel>

              <Panel titulo="Pool de conexiones a BD" icono={Database}>
                <Dato etiqueta="En uso" valor={data.base_datos?.pool?.en_uso} />
                <Dato etiqueta="Disponibles" valor={data.base_datos?.pool?.disponibles} />
                <Dato etiqueta="Tamaño del pool" valor={data.base_datos?.pool?.tamano} />
                <Dato
                  etiqueta="Overflow"
                  valor={
                    data.base_datos?.pool?.overflow_en_uso === null ||
                    data.base_datos?.pool?.overflow_en_uso === undefined
                      ? '—'
                      : `${data.base_datos.pool.overflow_en_uso} de ${data.base_datos.pool.overflow_maximo ?? '?'}`
                  }
                />
              </Panel>
            </div>

            {data.alcance?.nota && (
              <p className="flex items-start gap-2 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-xs leading-relaxed text-ink-600 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-400">
                <Zap size={14} className="mt-0.5 flex-shrink-0" />
                <span>
                  {data.alcance.nota}{' '}
                  <strong className="font-medium">Redis y el registro de peticiones sí son globales.</strong>
                </span>
              </p>
            )}
          </div>
        )}
      </EstadoCarga>
    </div>
  )
}

function Panel({ titulo, icono: Icono, children }) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-ink-100">
        <Icono size={16} className="text-ink-400" />
        {titulo}
      </h2>
      <dl className="space-y-1.5">{children}</dl>
    </div>
  )
}

function Dato({ etiqueta, valor }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <dt className="text-ink-500 dark:text-ink-400">{etiqueta}</dt>
      <dd className="font-medium tabular-nums text-ink-900 dark:text-ink-100">
        {valor === null || valor === undefined ? '—' : String(valor)}
      </dd>
    </div>
  )
}
