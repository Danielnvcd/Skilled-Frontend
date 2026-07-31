/**
 * Peticiones recientes y agregados por ruta.
 *
 * Los datos vienen de un buffer circular en Redis, no de la base de datos —
 * registrar cada request en Postgres habría convertido al panel de diagnóstico
 * en la causa del problema que intenta diagnosticar.
 *
 * Dos cosas que la UI tiene que dejar claras para no engañar a quien mira:
 *   1. El tráfico sano va MUESTREADO (1 de cada N). Los conteos son
 *      representativos, no exhaustivos. Errores y peticiones lentas se
 *      registran siempre.
 *   2. Las rutas se muestran normalizadas (`/api/users/<int:user_id>`), nunca
 *      la URL concreta: este panel lo ve el rol `sistemas`, que a propósito no
 *      tiene acceso a los datos de RRHH.
 */
import { ListTree, RefreshCw, Info } from 'lucide-react'
import {
  PageHeader, Button, Skeleton, Badge, EmptyState, Pagination,
  Table, THead, TH, TBody, TR, TD,
} from '../../components/ui'
import { useResource } from '../../hooks/useResource'
import { getPeticiones } from '../../api/sistemas'
import { EstadoCarga, fmtFechaHora, usePaginacionLocal } from './PanelLayout'

// 25 por página: la tabla es densa (6 columnas, rutas y user-agents largos) y
// más filas obligan a hacer scroll perdiendo los encabezados de vista.
const POR_PAGINA = 25

function tonoStatus(status) {
  if (status >= 500) return 'danger'
  if (status >= 400) return 'warning'
  return 'success'
}

export default function Peticiones() {
  const { data, loading, error, refetch } = useResource(
    'sistemas:peticiones',
    () => getPeticiones(200),
    { staleMs: 10_000 },
  )

  const resumen = data?.resumen
  const eventos = data?.eventos || []
  const pag = usePaginacionLocal(eventos, POR_PAGINA)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Peticiones"
        description="Actividad reciente de la API, agregada por ruta."
        icon={ListTree}
        actions={
          <Button variant="secondary" size="sm" leftIcon={<RefreshCw size={15} />} onClick={refetch}>
            Actualizar
          </Button>
        }
      />

      <EstadoCarga error={error} loading={loading} skeleton={<Skeleton className="h-64" />}>
        {resumen && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Tarjeta etiqueta="Registradas" valor={resumen.total} />
              <Tarjeta etiqueta="Con error" valor={resumen.errores} tono={resumen.errores > 0 ? 'alerta' : undefined} />
              <Tarjeta etiqueta="Tiempo medio" valor={`${resumen.ms_promedio} ms`} />
              <Tarjeta etiqueta="p95" valor={`${resumen.ms_p95} ms`} />
            </div>

            <p className="flex items-start gap-2 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-xs leading-relaxed text-ink-600 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-400">
              <Info size={14} className="mt-0.5 flex-shrink-0" />
              <span>
                Se registra <strong className="font-medium">siempre</strong> lo que falla
                (4xx/5xx) y lo que tarda más de {resumen.umbral_lenta_ms} ms; del tráfico
                normal se guarda 1 de cada {resumen.muestreo_ok}. Las rutas se muestran
                normalizadas, sin los identificadores concretos.
              </span>
            </p>

            {resumen.por_ruta?.length > 0 && (
              <section>
                <h2 className="mb-2 text-sm font-semibold text-ink-900 dark:text-ink-100">
                  Rutas más lentas
                </h2>
                {/* `Table` ya envuelve en un contenedor con overflow-x-auto,
                    y `THead` ya emite su propio <tr>. */}
                <Table>
                  <THead>
                    <TH>Ruta</TH>
                    <TH align="right">Veces</TH>
                    <TH align="right">Errores</TH>
                    <TH align="right">Media</TH>
                    <TH align="right">Máx</TH>
                  </THead>
                  <TBody>
                    {resumen.por_ruta.map((f) => (
                      <TR key={`${f.metodo}-${f.ruta}`}>
                        <TD>
                          <span className="font-mono text-xs text-ink-500 dark:text-ink-400">{f.metodo}</span>{' '}
                          <span className="font-mono text-xs">{f.ruta}</span>
                        </TD>
                        <TD align="right" className="tabular-nums">{f.conteo}</TD>
                        <TD align="right" className="tabular-nums">{f.errores || '—'}</TD>
                        <TD align="right" className="tabular-nums whitespace-nowrap">{f.ms_promedio} ms</TD>
                        <TD align="right" className="tabular-nums whitespace-nowrap">{f.ms_max} ms</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </section>
            )}

            <section>
              <h2 className="mb-2 text-sm font-semibold text-ink-900 dark:text-ink-100">
                Últimas peticiones
              </h2>
              {eventos.length === 0 ? (
                <EmptyState
                  icon={ListTree}
                  title="Sin registros todavía"
                  description="El buffer se llena conforme llega tráfico. Si Redis está caído, no se registra nada."
                />
              ) : (
                <Table>
                  <THead>
                    <TH>Cuándo</TH>
                    <TH>Ruta</TH>
                    <TH>Estado</TH>
                    <TH align="right">Duración</TH>
                    <TH>Usuario</TH>
                    <TH>IP</TH>
                  </THead>
                  <TBody>
                    {pag.visibles.map((e, i) => (
                      <TR key={`${e.ts}-${pag.offset + i}`}>
                        <TD className="whitespace-nowrap text-xs">
                          {fmtFechaHora(new Date(e.ts * 1000).toISOString())}
                        </TD>
                        <TD>
                          <span className="font-mono text-xs text-ink-500 dark:text-ink-400">{e.metodo}</span>{' '}
                          <span className="font-mono text-xs">{e.ruta}</span>
                        </TD>
                        <TD>
                          <Badge tone={tonoStatus(e.status)}>{e.status}</Badge>
                        </TD>
                        <TD align="right" className="tabular-nums whitespace-nowrap">{e.ms} ms</TD>
                        <TD className="whitespace-nowrap">{e.usuario || '—'}</TD>
                        <TD className="font-mono text-xs whitespace-nowrap">{e.ip || '—'}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
              <Pagination
                page={pag.pagina}
                totalPages={pag.totalPaginas}
                totalElements={pag.total}
                size={pag.porPagina}
                onChange={pag.setPagina}
              />
            </section>
          </div>
        )}
      </EstadoCarga>
    </div>
  )
}

function Tarjeta({ etiqueta, valor, tono }) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        tono === 'alerta'
          ? 'border-red-300 bg-red-50 dark:border-red-900/50 dark:bg-red-900/20'
          : 'border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900'
      }`}
    >
      <p className="text-xs text-ink-500 dark:text-ink-400">{etiqueta}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums text-ink-900 dark:text-ink-100">
        {valor}
      </p>
    </div>
  )
}
