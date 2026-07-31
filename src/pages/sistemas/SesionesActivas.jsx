/**
 * Sesiones activas de todos los usuarios, con opción de revocarlas.
 *
 * Distinción importante que la UI explica al usuario:
 *   - Revocar AQUÍ corta una sola sesión (un dispositivo). El access token en
 *     curso sigue vivo hasta su expiración, ≤20 min.
 *   - Para expulsar a alguien de TODOS sus dispositivos al instante está
 *     "forzar cierre" en la pantalla de Usuarios, que sube `password_version`.
 * Se mantienen separados a propósito: cerrar una sesión sospechosa no debería
 * tirar al usuario de todas partes.
 *
 * La IP que se muestra es la real del cliente: nginx resuelve CF-Connecting-IP
 * dentro de los rangos de Cloudflare, así que no es la IP del túnel.
 */
import { useState } from 'react'
import toast from 'react-hot-toast'
import { MonitorSmartphone, RefreshCw, LogOut, Info } from 'lucide-react'
import {
  PageHeader, Button, Skeleton, Badge, EmptyState, ConfirmDialog, Pagination,
  Table, THead, TH, TBody, TR, TD,
} from '../../components/ui'
import { useResource } from '../../hooks/useResource'
import { getSesiones, revocarSesion } from '../../api/sistemas'
import { extractApiError } from '../../utils/apiError'
import { EstadoCarga, fmtFechaHora, usePaginacionLocal, useRefrescar, BotonActualizar } from './PanelLayout'

// El endpoint devuelve hasta 500 sesiones; sin paginar la tabla es interminable.
const POR_PAGINA = 25

export default function SesionesActivas() {
  const { data, loading, error, refetch } = useResource(
    'sistemas:sesiones',
    getSesiones,
    { staleMs: 15_000 },
  )
  const [porRevocar, setPorRevocar] = useState(null)
  const [enviando, setEnviando] = useState(false)

  const confirmar = async () => {
    if (!porRevocar) return
    setEnviando(true)
    try {
      await revocarSesion(porRevocar.id)
      toast.success(`Sesión de ${porRevocar.username || 'usuario'} cerrada`)
      setPorRevocar(null)
      refetch()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo revocar la sesión'))
    } finally {
      setEnviando(false)
    }
  }

  const { refrescando, refrescar } = useRefrescar(refetch)

  const sesiones = data || []
  const pag = usePaginacionLocal(sesiones, POR_PAGINA)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sesiones activas"
        description="Todas las sesiones abiertas en la plataforma."
        icon={MonitorSmartphone}
        actions={
          <BotonActualizar onClick={refrescar} refrescando={refrescando} ruta="/sistemas/sesiones" />
        }
      />

      <EstadoCarga error={error} loading={loading} skeleton={<Skeleton className="h-64" />}>
        <div className="space-y-4">
          <p className="flex items-start gap-2 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-xs leading-relaxed text-ink-600 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-400">
            <Info size={14} className="mt-0.5 flex-shrink-0" />
            <span>
              Cerrar una sesión aquí afecta a <strong className="font-medium">ese dispositivo</strong>;
              su token actual caduca en 20 minutos como máximo. Para sacar a alguien de
              todos sus dispositivos al instante, usa «forzar cierre» en Usuarios.
            </span>
          </p>

          {sesiones.length === 0 ? (
            <EmptyState
              icon={MonitorSmartphone}
              title="No hay sesiones activas"
              description="Nadie tiene una sesión abierta en este momento."
            />
          ) : (
            <Table>
              <THead>
                <TH>Usuario</TH>
                <TH>Rol</TH>
                <TH>Iniciada</TH>
                <TH>Expira</TH>
                <TH>Origen</TH>
                <TH align="right">Acciones</TH>
              </THead>
              <TBody>
                {pag.visibles.map((s) => (
                  <TR key={s.id}>
                    <TD className="whitespace-nowrap font-medium">
                      {s.username || `#${s.usuario_id}`}
                    </TD>
                    <TD>
                      <Badge tone={s.rol === 'super_admin' ? 'violet' : 'neutral'}>
                        {s.rol || '—'}
                      </Badge>
                    </TD>
                    <TD className="whitespace-nowrap text-xs">{fmtFechaHora(s.creada)}</TD>
                    <TD className="whitespace-nowrap text-xs">{fmtFechaHora(s.expira)}</TD>
                    {/* El user-agent es larguísimo: se acota y se trunca para que
                        no estire la tabla a lo ancho. */}
                    <TD>
                      <div className="max-w-[20rem]">
                        <span className="block font-mono text-xs">{s.ip || 'IP desconocida'}</span>
                        <span className="block truncate text-xs text-ink-500 dark:text-ink-400"
                              title={s.user_agent || ''}>
                          {s.user_agent || 'dispositivo desconocido'}
                        </span>
                      </div>
                    </TD>
                    <TD align="right">
                      <Button
                        variant="danger-ghost"
                        size="sm"
                        leftIcon={<LogOut size={14} />}
                        onClick={() => setPorRevocar(s)}
                      >
                        Cerrar
                      </Button>
                    </TD>
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
        </div>
      </EstadoCarga>

      <ConfirmDialog
        open={!!porRevocar}
        onClose={() => setPorRevocar(null)}
        onConfirm={confirmar}
        loading={enviando}
        title="¿Cerrar esta sesión?"
        description={
          porRevocar
            ? `Se cerrará la sesión de ${porRevocar.username || 'este usuario'} en ${porRevocar.ip || 'ese dispositivo'}. Sus otras sesiones no se ven afectadas.`
            : ''
        }
        confirmLabel="Cerrar sesión"
        tone="danger"
      />
    </div>
  )
}
