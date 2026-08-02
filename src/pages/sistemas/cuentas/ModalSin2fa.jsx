/**
 * Cuentas activas sin segundo factor.
 *
 * No bloquea a nadie: es visibilidad. Una cuenta con acceso a nómina o al
 * sistema sin 2FA está a una contraseña filtrada del compromiso, y las de rol
 * privilegiado se resaltan porque son las que de verdad urge cubrir.
 */
import { ShieldCheck, ShieldOff, AlertTriangle } from 'lucide-react'
import {
  Modal, Badge, EmptyState, Pagination, Table, THead, TH, TBody, TR, TD,
} from '../../../components/ui'
import { usePaginacionLocal } from '../PanelLayout'

const POR_PAGINA = 25

export default function ModalSin2fa({ open, onClose, datos }) {
  const pag = usePaginacionLocal(datos?.usuarios || [], POR_PAGINA)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cuentas sin segundo factor"
      description="No bloquea a nadie: es visibilidad. Una cuenta con acceso a nómina o al sistema sin 2FA está a una contraseña filtrada del compromiso."
      size="full"
    >
      {datos && (
        <div className="space-y-3">
          {datos.sensibles_sin_2fa > 0 && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5 dark:border-amber-900/50 dark:bg-amber-900/20">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-sm leading-snug text-amber-900 dark:text-amber-200">
                <strong className="font-semibold">{datos.sensibles_sin_2fa}</strong>
                {' '}cuenta{datos.sensibles_sin_2fa === 1 ? '' : 's'} con rol privilegiado
                {datos.sensibles_sin_2fa === 1 ? ' no tiene' : ' no tienen'} segundo factor.
              </p>
            </div>
          )}

          <p className="text-xs text-ink-500 dark:text-ink-400">
            {datos.total_sin_2fa} de {datos.total_activos} cuentas activas.
          </p>

          {datos.usuarios.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="Todas las cuentas tienen 2FA"
              description="No hay cuentas activas sin segundo factor."
            />
          ) : (
            <>
              <Table>
                <THead>
                  <TH>Usuario</TH>
                  <TH>Nombre</TH>
                  <TH>Rol</TH>
                  <TH align="right">Último acceso</TH>
                </THead>
                <TBody>
                  {pag.visibles.map((u) => (
                    <TR
                      key={u.id}
                      className={u.sensible ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''}
                    >
                      <TD className="whitespace-nowrap font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          {u.sensible && (
                            <ShieldOff size={14} className="flex-shrink-0 text-amber-600 dark:text-amber-400" />
                          )}
                          {u.username}
                        </span>
                      </TD>
                      <TD>{u.full_name || '—'}</TD>
                      <TD>
                        <Badge tone={u.sensible ? 'warning' : 'neutral'}>{u.rol}</Badge>
                      </TD>
                      <TD align="right" className="whitespace-nowrap text-xs">
                        {u.ultimo_acceso
                          ? new Date(u.ultimo_acceso).toLocaleDateString('es-MX')
                          : 'nunca'}
                      </TD>
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
      )}
    </Modal>
  )
}
