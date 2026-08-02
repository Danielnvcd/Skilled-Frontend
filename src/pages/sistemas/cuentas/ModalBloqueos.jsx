/**
 * Bloqueos activos por intentos fallidos, con la acción de liberar.
 *
 * La columna «Origen de los intentos» es la que hace útil esta pantalla: el
 * bloqueo vive en Redis indexado por cuenta, sin IP, y esto viene de cruzarlo
 * con la bitácora. Es lo que distingue un despiste del usuario (una sola IP,
 * la suya) de un intento ajeno (varias IPs desconocidas).
 */
import { LockOpen, ShieldCheck, AlertTriangle } from 'lucide-react'
import {
  Modal, Button, Badge, EmptyState, Table, THead, TH, TBody, TR, TD,
} from '../../../components/ui'
import { fmtDuracion } from '../PanelLayout'

export default function ModalBloqueos({ open, onClose, bloqueos = [], onLiberar }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Bloqueos activos"
      description="Tras varios intentos fallidos la cuenta se bloquea y la duración escala hasta 24 horas. Liberar la deja como si nunca se hubiera bloqueado: también se borra el nivel de escalación, para que el siguiente error no la deje fuera otra vez de inmediato."
      size="full"
    >
      {bloqueos.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Ninguna cuenta bloqueada"
          description="Nadie está fuera por intentos fallidos en este momento."
        />
      ) : (
        <Table>
          <THead>
            <TH>Usuario</TH>
            <TH>Rol</TH>
            <TH>Motivo</TH>
            <TH>Origen de los intentos</TH>
            <TH align="right">Tiempo restante</TH>
            <TH align="right">Acciones</TH>
          </THead>
          <TBody>
            {bloqueos.map((b) => (
              <TR key={`${b.tipo}-${b.identificador}`}>
                <TD className="whitespace-nowrap font-medium">{b.username}</TD>
                <TD><Badge tone="neutral">{b.rol || 'desconocido'}</Badge></TD>
                <TD>
                  <Badge tone={b.tipo === '2fa' ? 'warning' : 'danger'}>
                    {b.tipo === '2fa' ? 'código 2FA' : 'contraseña'}
                  </Badge>
                </TD>
                <TD>
                  {b.origenes?.length ? (
                    <div className="space-y-0.5">
                      {b.origenes.slice(0, 3).map((o) => (
                        <div key={o.ip} className="flex items-baseline gap-2 text-xs">
                          <span className="font-mono">{o.ip}</span>
                          <span className="text-ink-500 dark:text-ink-400">
                            {o.intentos} {o.intentos === 1 ? 'intento' : 'intentos'}
                          </span>
                        </div>
                      ))}
                      {b.origenes.length > 3 && (
                        <div className="text-xs text-ink-500 dark:text-ink-400">
                          y {b.origenes.length - 3} IP más
                        </div>
                      )}
                      {b.origenes.length > 1 && (
                        <div className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400">
                          <AlertTriangle size={11} />
                          varias IPs distintas
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-ink-500 dark:text-ink-400">sin registro</span>
                  )}
                </TD>
                <TD align="right" className="whitespace-nowrap tabular-nums">
                  {fmtDuracion(b.segundos_restantes)}
                </TD>
                <TD align="right">
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<LockOpen size={14} />}
                    onClick={() => onLiberar(b)}
                  >
                    Liberar
                  </Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Modal>
  )
}
