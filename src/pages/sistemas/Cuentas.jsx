/**
 * Cuentas: bloqueos por intentos fallidos y estado del 2FA.
 *
 * Los bloqueos son la operación de soporte más frecuente que el sistema no
 * sabía atender: el lockout escalado llega a 24 horas y hasta ahora no había
 * forma de liberar a alguien salvo esperar.
 */
import { useState } from 'react'
import toast from 'react-hot-toast'
import {
  LockKeyhole, RefreshCw, LockOpen, ShieldOff, ShieldCheck, AlertTriangle,
} from 'lucide-react'
import {
  PageHeader, Button, Skeleton, Badge, EmptyState, ConfirmDialog, Pagination,
  Table, THead, TH, TBody, TR, TD,
} from '../../components/ui'
import { useResource } from '../../hooks/useResource'
import { getBloqueos, liberarBloqueo, getSin2fa } from '../../api/sistemas'
import { extractApiError } from '../../utils/apiError'
import { EstadoCarga, fmtDuracion, usePaginacionLocal, useRefrescar, BotonActualizar } from './PanelLayout'

const POR_PAGINA = 25

export default function Cuentas() {
  const bloqueos = useResource('sistemas:bloqueos', getBloqueos, { staleMs: 10_000 })
  const sin2fa = useResource('sistemas:sin2fa', getSin2fa, { staleMs: 30_000 })

  const { refrescando, refrescar } = useRefrescar(bloqueos.refetch, sin2fa.refetch)

  const [porLiberar, setPorLiberar] = useState(null)
  const [enviando, setEnviando] = useState(false)

  const confirmarLiberar = async () => {
    if (!porLiberar) return
    setEnviando(true)
    try {
      await liberarBloqueo(porLiberar.tipo, porLiberar.identificador)
      toast.success(`${porLiberar.username} ya puede volver a intentar`)
      setPorLiberar(null)
      bloqueos.refetch()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo liberar el bloqueo'))
    } finally {
      setEnviando(false)
    }
  }

  const listaBloqueos = bloqueos.data || []
  const datos2fa = sin2fa.data
  const pag2fa = usePaginacionLocal(datos2fa?.usuarios || [], POR_PAGINA)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cuentas"
        description="Bloqueos por intentos fallidos y estado del segundo factor."
        icon={LockKeyhole}
        actions={
          <BotonActualizar onClick={refrescar} refrescando={refrescando} ruta="/sistemas/bloqueos" />
        }
      />

      {/* ── Bloqueos activos ─────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-ink-900 dark:text-ink-100">
            Bloqueos activos
          </h2>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-500 dark:text-ink-400">
            Tras varios intentos fallidos la cuenta se bloquea, y la duración escala
            hasta 24 horas. Liberar deja la cuenta como si nunca se hubiera bloqueado:
            también se borra el nivel de escalación, para que el siguiente error no la
            deje fuera otra vez de inmediato.
          </p>
        </div>

        <EstadoCarga
          error={bloqueos.error}
          loading={bloqueos.loading}
          skeleton={<Skeleton className="h-32" />}
        >
          {listaBloqueos.length === 0 ? (
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
                {listaBloqueos.map((b) => (
                  <TR key={`${b.tipo}-${b.identificador}`}>
                    <TD className="whitespace-nowrap font-medium">{b.username}</TD>
                    <TD>
                      <Badge tone="neutral">{b.rol || 'desconocido'}</Badge>
                    </TD>
                    <TD>
                      <Badge tone={b.tipo === '2fa' ? 'warning' : 'danger'}>
                        {b.tipo === '2fa' ? 'código 2FA' : 'contraseña'}
                      </Badge>
                    </TD>
                    {/* El bloqueo vive en Redis indexado por cuenta, sin IP.
                        Esto viene de cruzarlo con la bitácora, y es lo que
                        distingue un despiste del usuario de un intento ajeno:
                        varias IPs desconocidas es señal de ataque. */}
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
                        <span className="text-xs text-ink-500 dark:text-ink-400">
                          sin registro
                        </span>
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
                        onClick={() => setPorLiberar(b)}
                      >
                        Liberar
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </EstadoCarga>
      </section>

      {/* ── Cuentas sin 2FA ──────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-ink-900 dark:text-ink-100">
            Cuentas sin segundo factor
          </h2>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-500 dark:text-ink-400">
            No bloquea a nadie: es visibilidad. Una cuenta con acceso a nómina o al
            sistema sin 2FA está a una contraseña filtrada del compromiso.
          </p>
        </div>

        <EstadoCarga
          error={sin2fa.error}
          loading={sin2fa.loading}
          skeleton={<Skeleton className="h-32" />}
        >
          {datos2fa && (
            <>
              {datos2fa.sensibles_sin_2fa > 0 && (
                <div className="mb-3 flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5 dark:border-amber-900/50 dark:bg-amber-900/20">
                  <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                  <p className="text-sm leading-snug text-amber-900 dark:text-amber-200">
                    <strong className="font-semibold">{datos2fa.sensibles_sin_2fa}</strong>
                    {' '}cuenta{datos2fa.sensibles_sin_2fa === 1 ? '' : 's'} con rol privilegiado
                    {datos2fa.sensibles_sin_2fa === 1 ? ' no tiene' : ' no tienen'} segundo factor.
                  </p>
                </div>
              )}

              <p className="mb-2 text-xs text-ink-500 dark:text-ink-400">
                {datos2fa.total_sin_2fa} de {datos2fa.total_activos} cuentas activas.
              </p>

              {datos2fa.usuarios.length === 0 ? (
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
                      {pag2fa.visibles.map((u) => (
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
                    page={pag2fa.pagina}
                    totalPages={pag2fa.totalPaginas}
                    totalElements={pag2fa.total}
                    size={pag2fa.porPagina}
                    onChange={pag2fa.setPagina}
                  />
                </>
              )}
            </>
          )}
        </EstadoCarga>
      </section>

      <ConfirmDialog
        open={!!porLiberar}
        onClose={() => setPorLiberar(null)}
        onConfirm={confirmarLiberar}
        loading={enviando}
        title="¿Liberar el bloqueo?"
        description={
          porLiberar
            ? `${porLiberar.username} podrá volver a intentar de inmediato. Confirma que se trata de la persona correcta: el bloqueo existe para frenar intentos de acceso ajenos.`
            : ''
        }
        confirmLabel="Liberar"
        tone="danger"
      />
    </div>
  )
}
