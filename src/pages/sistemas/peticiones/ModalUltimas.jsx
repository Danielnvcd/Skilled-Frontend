/**
 * Log detallado de peticiones recientes.
 *
 * Las cifras de la muestra viven AQUÍ y no en el tablero a propósito: son
 * números muestreados y ponerlos junto a los exactos del día invitaba a
 * compararlos como si midieran lo mismo. Al lado de la tabla que describen, el
 * aviso de muestreo se lee en su contexto.
 */
import { Network, Info } from 'lucide-react'
import {
  Modal, Badge, EmptyState, Pagination,
  Table, THead, TH, TBody, TR, TD,
} from '../../../components/ui'
import { fmtFechaHora, usePaginacionLocal, TarjetaDato } from '../PanelLayout'

// 25 por página: la tabla es densa (6 columnas, rutas largas) y más filas
// obligan a hacer scroll perdiendo los encabezados de vista.
const POR_PAGINA = 25

function tonoStatus(status) {
  if (status >= 500) return 'danger'
  if (status >= 400) return 'warning'
  return 'success'
}

export default function ModalUltimas({ open, onClose, eventos = [], resumen }) {
  const pag = usePaginacionLocal(eventos, POR_PAGINA)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Últimas peticiones"
      description="Muestra con detalle del tráfico reciente."
      size="full"
    >
      <div className="space-y-4">
        {resumen && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <TarjetaDato etiqueta="En la muestra" valor={resumen.total} />
              <TarjetaDato
                etiqueta="Con error"
                valor={resumen.errores}
                tono={resumen.errores > 0 ? 'alerta' : undefined}
              />
              <TarjetaDato etiqueta="Tiempo medio" valor={`${resumen.ms_promedio} ms`} />
              <TarjetaDato etiqueta="p95" valor={`${resumen.ms_p95} ms`} />
            </div>

            <p className="flex items-start gap-2 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-xs leading-relaxed text-ink-600 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-400">
              <Info size={14} className="mt-0.5 flex-shrink-0" />
              <span>
                Esto es una <strong className="font-medium">muestra</strong>, no el total:
                se guarda siempre lo que falla (4xx/5xx) y lo que tarda más de{' '}
                {resumen.umbral_lenta_ms} ms, y del tráfico normal 1 de cada{' '}
                {resumen.muestreo_ok}. Para cifras reales, mira las del día en el tablero.
                Las rutas van normalizadas, sin los identificadores concretos.
              </span>
            </p>
          </>
        )}

        {eventos.length === 0 ? (
          <EmptyState
            icon={Network}
            title="Sin registros todavía"
            description="El buffer se llena conforme llega tráfico. Si Redis está caído, no se registra nada."
          />
        ) : (
          <>
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
                    <TD><Badge tone={tonoStatus(e.status)}>{e.status}</Badge></TD>
                    <TD align="right" className="whitespace-nowrap tabular-nums">{e.ms} ms</TD>
                    <TD className="whitespace-nowrap">{e.usuario || '—'}</TD>
                    <TD className="whitespace-nowrap font-mono text-xs">{e.ip || '—'}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination
              page={pag.pagina}
              totalPages={pag.totalPaginas}
              totalElements={pag.total}
              size={pag.porPagina}
              onChange={pag.setPagina}
            />
          </>
        )}
      </div>
    </Modal>
  )
}
