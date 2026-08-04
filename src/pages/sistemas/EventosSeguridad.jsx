/**
 * Vista enfocada de la bitácora: solo eventos de seguridad.
 *
 * El backend filtra en SQL por patrones (logins fallidos, lockouts, uso de
 * códigos de respaldo, detección de robo de refresh token, altas y bajas de
 * cuentas) para no traer la tabla entera — el AuditLog crece sin límite.
 */
import { useState } from 'react'
import { ShieldAlert, RefreshCw } from 'lucide-react'
import {
  PageHeader, Button, Skeleton, Badge, EmptyState, Select, Pagination,
  Table, THead, TH, TBody, TR, TD,
} from '../../components/ui'
import { useResource } from '../../hooks/useResource'
import { getEventosSeguridad } from '../../api/sistemas'
import { EstadoCarga, fmtFechaHora, usePaginacionLocal, useRefrescar, BotonActualizar } from './PanelLayout'

// El endpoint devuelve hasta 200 eventos; sin paginar la tabla se vuelve larga.
const POR_PAGINA = 25

// Lo que merece destacarse en rojo: intentos de entrar que fallaron o señales
// de cuenta comprometida. Lo demás es actividad administrativa normal.
function esCritico(accion) {
  return /fallido|rechazado|replay|robo|comprometid|bloquead|backup code/i.test(accion || '')
}

export default function EventosSeguridad() {
  const [dias, setDias] = useState(7)
  const { data, loading, error, refetch } = useResource(
    ['sistemas:eventos', dias],
    () => getEventosSeguridad({ dias, limite: 200 }),
    // Dos eventos a propósito: `bitacora:new` solo se emite a admin/super_admin,
    // así que para el rol `sistemas` —el dueño de esta pantalla— nunca llegaba y
    // la vista no se refrescaba en vivo. `seguridad:new` es el push que sí le
    // llega, y solo cuando la entrada del AuditLog es de seguridad. Trae únicamente
    // el id: la lista se vuelve a pedir por REST, que filtra en el servidor.
    { staleMs: 20_000, invalidateOn: ['bitacora:new', 'seguridad:new'] },
  )

  const { refrescando, refrescar } = useRefrescar(refetch)
  const eventos = data || []
  const pag = usePaginacionLocal(eventos, POR_PAGINA)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Eventos de seguridad"
        description="Intentos de acceso, bloqueos y cambios sobre cuentas."
        icon={ShieldAlert}
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={String(dias)}
              onChange={(e) => setDias(Number(e.target.value))}
              wrapperClassName="w-44"
              aria-label="Periodo"
            >
              <option value="1">Último día</option>
              <option value="7">Últimos 7 días</option>
              <option value="30">Últimos 30 días</option>
              <option value="90">Últimos 90 días</option>
            </Select>
            <BotonActualizar onClick={refrescar} refrescando={refrescando} ruta="/sistemas/eventos-seguridad" />
          </div>
        }
      />

      <EstadoCarga error={error} loading={loading} skeleton={<Skeleton className="h-64" />}>
        {eventos.length === 0 ? (
          <EmptyState
            icon={ShieldAlert}
            title="Sin eventos en el periodo"
            description="No se registraron intentos fallidos, bloqueos ni cambios de cuentas."
          />
        ) : (
          <Table>
            <THead>
              <TH>Cuándo</TH>
              <TH>Usuario</TH>
              <TH>Evento</TH>
              <TH>IP</TH>
            </THead>
            <TBody>
              {pag.visibles.map((e) => {
                const critico = esCritico(e.accion)
                return (
                  <TR key={e.id} className={critico ? 'bg-red-50/60 dark:bg-red-900/10' : ''}>
                    <TD className="whitespace-nowrap text-xs">{fmtFechaHora(e.fecha)}</TD>
                    <TD className="whitespace-nowrap font-medium">{e.usuario || '—'}</TD>
                    <TD>
                      <div className="flex items-start gap-2">
                        {critico && <Badge tone="danger" className="mt-0.5 flex-shrink-0">alerta</Badge>}
                        <span className="text-sm">{e.accion}</span>
                      </div>
                    </TD>
                    <TD className="whitespace-nowrap font-mono text-xs">{e.ip || '—'}</TD>
                  </TR>
                )
              })}
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
      </EstadoCarga>
    </div>
  )
}
