/**
 * Cuentas — TABLERO de bloqueos y estado del 2FA.
 *
 * Dos tarjetas que dicen si hay algo que atender; el detalle y la acción de
 * liberar viven en su modal, en `./cuentas/`.
 *
 * Los bloqueos son la operación de soporte más frecuente que el sistema no
 * sabía atender: el lockout escalado llega a 24 horas y hasta que existió esta
 * pantalla no había forma de liberar a alguien salvo esperar.
 *
 * La señal de «varias IPs» se sube al frente a propósito: un bloqueo con una
 * sola IP suele ser un despiste del propio usuario, pero varias IPs distintas
 * es alguien intentando entrar a esa cuenta. Esa diferencia decide si liberar
 * sin más o investigar antes, así que no puede quedar escondida en una tabla.
 */
import { useState } from 'react'
import toast from 'react-hot-toast'
import { LockKeyhole, LockOpen, ShieldOff } from 'lucide-react'
import { PageHeader, Skeleton, ConfirmDialog } from '../../components/ui'
import { useResource } from '../../hooks/useResource'
import { getBloqueos, liberarBloqueo, getSin2fa } from '../../api/sistemas'
import { extractApiError } from '../../utils/apiError'
import {
  EstadoCarga, useRefrescar, BotonActualizar, TarjetaTema, fmtNumero,
} from './PanelLayout'
import ModalBloqueos from './cuentas/ModalBloqueos'
import ModalSin2fa from './cuentas/ModalSin2fa'

export default function Cuentas() {
  const bloqueos = useResource('sistemas:bloqueos', getBloqueos, { staleMs: 10_000 })
  const sin2fa = useResource('sistemas:sin2fa', getSin2fa, { staleMs: 30_000 })

  const { refrescando, refrescar } = useRefrescar(bloqueos.refetch, sin2fa.refetch)

  // 'bloqueos' | 'sin2fa' | null
  const [abierto, setAbierto] = useState(null)
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

  // Un bloqueo con intentos desde varias IPs no es un usuario despistado.
  const sospechosos = listaBloqueos.filter((b) => (b.origenes?.length || 0) > 1).length
  const totalSin2fa = datos2fa?.total_sin_2fa || 0
  const sensibles = datos2fa?.sensibles_sin_2fa || 0

  const cargando = bloqueos.loading || sin2fa.loading
  const errorGlobal = bloqueos.error || sin2fa.error

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cuentas"
        description="Bloqueos por intentos fallidos y estado del segundo factor."
        icon={LockKeyhole}
        actions={
          <BotonActualizar onClick={refrescar} refrescando={refrescando} ruta="/sistemas/bloqueos" />
        }
      />

      <EstadoCarga
        error={errorGlobal}
        loading={cargando}
        skeleton={
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-44" /><Skeleton className="h-44" />
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TarjetaTema
            icono={LockOpen}
            titulo="Bloqueos activos"
            valor={fmtNumero(listaBloqueos.length)}
            unidad={listaBloqueos.length === 1 ? 'cuenta bloqueada' : 'cuentas bloqueadas'}
            detalle={
              sospechosos > 0
                ? `${sospechosos} con intentos desde varias IPs distintas — revisa antes de liberar.`
                : listaBloqueos.length > 0
                  ? 'Intentos desde un solo origen: suele ser la propia persona.'
                  : 'Nadie está fuera por intentos fallidos.'
            }
            tono={sospechosos > 0 ? 'alerta' : listaBloqueos.length > 0 ? 'aviso' : 'ok'}
            etiqueta={
              sospechosos > 0 ? 'Posible ataque'
                : listaBloqueos.length > 0 ? 'Con bloqueos' : 'Sin bloqueos'
            }
            accion={listaBloqueos.length > 0 ? `Ver y liberar (${listaBloqueos.length})` : 'Ver detalle'}
            onClick={() => setAbierto('bloqueos')}
          />

          <TarjetaTema
            icono={ShieldOff}
            titulo="Cuentas sin 2FA"
            valor={fmtNumero(totalSin2fa)}
            unidad={`de ${fmtNumero(datos2fa?.total_activos)} cuentas activas`}
            detalle={
              sensibles > 0
                ? `${sensibles} con rol privilegiado sin segundo factor: son las que urge cubrir.`
                : totalSin2fa > 0
                  ? 'Ninguna de rol privilegiado. Conviene cubrirlas igual.'
                  : 'Todas las cuentas activas tienen segundo factor.'
            }
            tono={sensibles > 0 ? 'alerta' : totalSin2fa > 0 ? 'aviso' : 'ok'}
            etiqueta={
              sensibles > 0 ? 'Requiere atención'
                : totalSin2fa > 0 ? 'Por cubrir' : 'Al día'
            }
            accion="Ver listado"
            onClick={() => setAbierto('sin2fa')}
          />
        </div>
      </EstadoCarga>

      <ModalBloqueos
        open={abierto === 'bloqueos'}
        onClose={() => setAbierto(null)}
        bloqueos={listaBloqueos}
        onLiberar={setPorLiberar}
      />

      <ModalSin2fa
        open={abierto === 'sin2fa'}
        onClose={() => setAbierto(null)}
        datos={datos2fa}
      />

      {/* La confirmación repite la señal de varias IPs: es la última
          oportunidad de notar que no se trata de un despiste del usuario. */}
      <ConfirmDialog
        open={!!porLiberar}
        onClose={() => setPorLiberar(null)}
        onConfirm={confirmarLiberar}
        loading={enviando}
        title="¿Liberar el bloqueo?"
        description={
          porLiberar
            ? `${porLiberar.username} podrá volver a intentar de inmediato. `
              + ((porLiberar.origenes?.length || 0) > 1
                ? `ATENCIÓN: hubo intentos desde ${porLiberar.origenes.length} IPs distintas, `
                  + 'lo que apunta a alguien tratando de entrar a esa cuenta. '
                : '')
              + 'Confirma que se trata de la persona correcta: el bloqueo existe para '
              + 'frenar intentos de acceso ajenos.'
            : ''
        }
        confirmLabel="Liberar"
        tone="danger"
      />
    </div>
  )
}
