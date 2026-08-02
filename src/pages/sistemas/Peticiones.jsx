/**
 * Peticiones — TABLERO de la actividad de la API.
 *
 * Los datos vienen de un buffer circular en Redis, no de la base de datos:
 * registrar cada request en Postgres habría convertido al panel de diagnóstico
 * en la causa del problema que intenta diagnosticar.
 *
 * Dos cosas que la UI tiene que dejar claras para no engañar a quien mira:
 *   1. El tráfico sano va MUESTREADO (1 de cada N). Por eso arriba se muestran
 *      solo las cifras EXACTAS del día, y las muestreadas viven dentro del
 *      modal de «Últimas peticiones», junto a la tabla que describen — ponerlas
 *      lado a lado invitaba a compararlas como si midieran lo mismo.
 *   2. Las rutas se muestran normalizadas (`/api/users/<int:user_id>`), nunca
 *      la URL concreta: este panel lo ve el rol `sistemas`, que a propósito no
 *      tiene acceso a los datos de RRHH.
 *
 * Las tres tablas pesadas (serie diaria, rutas lentas y log) se abren en modal
 * desde `./peticiones/`, para que la pantalla quepa sin scroll.
 */
import { useState } from 'react'
import { Network, Info, CalendarDays, Gauge, ListOrdered } from 'lucide-react'
import { PageHeader, Skeleton } from '../../components/ui'
import { useResource } from '../../hooks/useResource'
import { getPeticiones } from '../../api/sistemas'
import {
  EstadoCarga, useRefrescar, BotonActualizar, TarjetaDato, TarjetaTema, fmtNumero,
} from './PanelLayout'
import ModalPorDia from './peticiones/ModalPorDia'
import ModalRutasLentas from './peticiones/ModalRutasLentas'
import ModalUltimas from './peticiones/ModalUltimas'

export default function Peticiones() {
  const { data, loading, error, refetch } = useResource(
    'sistemas:peticiones',
    () => getPeticiones({ limite: 200, dias: 7 }),
    { staleMs: 10_000 },
  )
  const { refrescando, refrescar } = useRefrescar(refetch)

  // 'dia' | 'rutas' | 'ultimas' | null
  const [abierto, setAbierto] = useState(null)

  const resumen = data?.resumen
  const eventos = data?.eventos || []
  const contadores = data?.contadores
  const hoy = contadores?.hoy
  const serie = contadores?.serie || []

  const erroresHoy = hoy?.errores || 0
  const rutas = resumen?.por_ruta || []
  const rutaMasLenta = rutas[0]
  const rutasConError = rutas.some((r) => r.errores > 0)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Peticiones"
        description="Actividad reciente de la API, agregada por ruta."
        icon={Network}
        actions={
          <BotonActualizar onClick={refrescar} refrescando={refrescando} ruta="/sistemas/peticiones" />
        }
      />

      <EstadoCarga error={error} loading={loading} skeleton={<Skeleton className="h-64" />}>
        {resumen && (
          <div className="space-y-6">
            {/* ── Cifras EXACTAS del día ───────────────────────────────────
                Contadores que se incrementan en TODA petición: estos números
                son reales, no una estimación sobre la muestra. Van arriba y sin
                modal porque responden a "¿cómo va el sistema hoy?" */}
            {hoy && hoy.total > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-ink-900 dark:text-ink-100">
                  Hoy — cifras exactas
                </h2>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <TarjetaDato etiqueta="Peticiones" valor={fmtNumero(hoy.total)} />
                  <TarjetaDato
                    etiqueta="Con error"
                    valor={fmtNumero(erroresHoy)}
                    tono={erroresHoy > 0 ? 'alerta' : undefined}
                    pie={hoy.total ? `${((erroresHoy / hoy.total) * 100).toFixed(1)}%` : null}
                  />
                  <TarjetaDato etiqueta="Tiempo medio" valor={`${hoy.ms_promedio} ms`} />
                  <TarjetaDato
                    etiqueta="p95"
                    valor={hoy.percentiles?.p95 ? `${hoy.percentiles.p95} ms` : '—'}
                    pie="aproximado"
                  />
                </div>
              </section>
            )}

            {contadores && contadores.disponible === false && (
              <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
                <Info size={14} className="mt-0.5 flex-shrink-0" />
                <span>
                  Las cifras exactas no están disponibles: dependen de Redis y ahora
                  mismo no responde. La muestra reciente sí sigue disponible.
                </span>
              </p>
            )}

            {/* ── Detalle: cada tabla en su modal ─────────────────────────── */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <TarjetaTema
                icono={CalendarDays}
                titulo="Actividad por día"
                valor={fmtNumero(serie.length)}
                unidad={serie.length === 1 ? 'día registrado' : 'días registrados'}
                detalle="Peticiones, errores y tiempos día a día. Cifras exactas."
                tono="neutral"
                etiqueta="Historial"
                accion="Ver serie"
                onClick={() => setAbierto('dia')}
              />

              <TarjetaTema
                icono={Gauge}
                titulo="Rutas más lentas"
                valor={rutaMasLenta ? `${rutaMasLenta.ms_promedio} ms` : '—'}
                unidad={rutaMasLenta ? 'la peor en promedio' : 'sin datos todavía'}
                detalle={
                  rutaMasLenta
                    ? `${rutaMasLenta.metodo} ${rutaMasLenta.ruta}`
                    : 'Aún no hay suficiente tráfico en la muestra.'
                }
                tono={rutasConError ? 'aviso' : 'ok'}
                etiqueta={rutasConError ? 'Con errores' : 'Sin errores'}
                accion={`Ver ${rutas.length} ruta(s)`}
                onClick={() => setAbierto('rutas')}
              />

              <TarjetaTema
                icono={ListOrdered}
                titulo="Últimas peticiones"
                valor={fmtNumero(resumen.errores)}
                unidad="con error en la muestra"
                detalle={`${fmtNumero(resumen.total)} registradas · ${resumen.ms_promedio} ms de media`}
                tono={resumen.errores > 0 ? 'alerta' : 'ok'}
                etiqueta={resumen.errores > 0 ? 'Revisar' : 'Al día'}
                accion="Ver detalle"
                onClick={() => setAbierto('ultimas')}
              />
            </div>
          </div>
        )}
      </EstadoCarga>

      <ModalPorDia
        open={abierto === 'dia'}
        onClose={() => setAbierto(null)}
        serie={serie}
      />

      <ModalRutasLentas
        open={abierto === 'rutas'}
        onClose={() => setAbierto(null)}
        porRuta={rutas}
        umbralMs={resumen?.umbral_lenta_ms}
      />

      <ModalUltimas
        open={abierto === 'ultimas'}
        onClose={() => setAbierto(null)}
        eventos={eventos}
        resumen={resumen}
      />
    </div>
  )
}
