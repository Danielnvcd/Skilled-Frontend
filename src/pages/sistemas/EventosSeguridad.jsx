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
  PageHeader, Button, Skeleton, Badge, EmptyState, Select,
  Table, THead, TH, TBody, TR, TD,
} from '../../components/ui'
import { useResource } from '../../hooks/useResource'
import { getEventosSeguridad } from '../../api/sistemas'
import { EstadoCarga, fmtFechaHora } from './PanelLayout'

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
    { staleMs: 20_000, invalidateOn: ['bitacora:new'] },
  )

  const eventos = data || []

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
            <Button variant="secondary" size="sm" leftIcon={<RefreshCw size={15} />} onClick={refetch}>
              Actualizar
            </Button>
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
              {eventos.map((e) => {
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
      </EstadoCarga>
    </div>
  )
}
