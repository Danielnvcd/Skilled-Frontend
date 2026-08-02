/**
 * Mantenimiento del sistema — TABLERO.
 *
 * Tres tarjetas que dicen de un vistazo si algo necesita atención (base de
 * datos, imágenes del catálogo, archivos en la nube). El detalle y las acciones
 * viven en un modal por tema, en `./mantenimiento/`. Antes todo estaba apilado
 * en una sola página larga y no se distinguía lo urgente de lo rutinario.
 *
 * Esta pantalla solo ORQUESTA: carga los tres recursos, decide el tono de cada
 * tarjeta y abre el modal correspondiente. La lógica de cada tema vive en su
 * propio archivo.
 *
 * Las acciones destructivas (purgar bitácora) o costosas (reintentar imágenes)
 * piden confirmación con un texto que explica qué va a pasar, no un "¿estás
 * seguro?" genérico. Sincronizar archivos NO la pide: solo copia a la nube, no
 * borra nada y es idempotente.
 */
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import {
  DatabaseZap, Database, ImageOff, CloudUpload, FileWarning,
} from 'lucide-react'
import { PageHeader, Skeleton, ConfirmDialog } from '../../components/ui'
import { useResource } from '../../hooks/useResource'
import {
  getAlmacenamiento, purgarBitacora, getImagenes, reintentarImagenes,
  getArchivos, sincronizarArchivos,
} from '../../api/sistemas'
import { extractApiError } from '../../utils/apiError'
import { useSocket } from '../../context/SocketContext'
import {
  EstadoCarga, useRefrescar, BotonActualizar, TarjetaTema, fmtNumero,
} from './PanelLayout'
import ModalBaseDatos from './mantenimiento/ModalBaseDatos'
import ModalImagenes from './mantenimiento/ModalImagenes'
import ModalArchivos from './mantenimiento/ModalArchivos'

export default function Mantenimiento() {
  const almacen = useResource('sistemas:almacenamiento', getAlmacenamiento, { staleMs: 60_000 })
  const imagenes = useResource('sistemas:imagenes', getImagenes, { staleMs: 30_000 })
  const archivos = useResource('sistemas:archivos', getArchivos, { staleMs: 30_000 })

  const { refrescando, refrescar } = useRefrescar(
    almacen.refetch, imagenes.refetch, archivos.refetch,
  )

  // Qué modal está abierto: 'bd' | 'imagenes' | 'archivos' | null
  const [abierto, setAbierto] = useState(null)

  const [mesesPurga, setMesesPurga] = useState(12)
  const [confirmPurga, setConfirmPurga] = useState(false)
  const [confirmReintento, setConfirmReintento] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const ejecutarPurga = async () => {
    setEnviando(true)
    try {
      const res = await purgarBitacora(mesesPurga)
      toast.success(
        res.borrados
          ? `${fmtNumero(res.borrados)} entradas eliminadas`
          : 'No había entradas anteriores a esa fecha',
      )
      setConfirmPurga(false)
      almacen.refetch()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo purgar la bitácora'))
    } finally {
      setEnviando(false)
    }
  }

  const ejecutarReintento = async () => {
    setEnviando(true)
    try {
      const res = await reintentarImagenes()
      toast.success(
        res.reencoladas
          ? `${res.reencoladas} imágenes reencoladas`
          : 'No hay imágenes en error',
      )
      setConfirmReintento(false)
      imagenes.refetch()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudieron reencolar las imágenes'))
    } finally {
      setEnviando(false)
    }
  }

  // ── Sincronización de archivos privados a R2 ──────────────────────────────
  // Mismo patrón que el pipeline de imágenes: la petición solo encola, y el
  // progreso real llega por socket al usuario que lo lanzó.
  const { on } = useSocket()
  const [progreso, setProgreso] = useState(null)
  const [sincronizando, setSincronizando] = useState(false)
  // Job lanzado por ESTA pantalla; en ref para que el listener lea el valor
  // actual sin volver a suscribirse.
  const jobIdRef = useRef(null)

  useEffect(() => {
    const off = on('archivo:sync_progreso', (p) => {
      if (!jobIdRef.current || p?.job_id !== jobIdRef.current) return
      setProgreso(p)
      if (p?.estado === 'done') {
        jobIdRef.current = null
        archivos.refetch()
        if (p.error > 0) {
          toast(`${p.error} archivo(s) no se pudieron subir. Vuelve a sincronizar para reintentar.`, {
            icon: <FileWarning size={18} />, duration: 7000,
          })
        }
      }
    })
    return off
  }, [on])   // eslint-disable-line react-hooks/exhaustive-deps

  const ejecutarSyncArchivos = async () => {
    setSincronizando(true)
    try {
      const res = await sincronizarArchivos()
      if (res.encolados > 0) {
        jobIdRef.current = res.job_id || null
        setProgreso({ total: res.encolados, hechas: 0, ok: 0, error: 0, estado: 'running', actual: null })
        toast.success(`Subiendo ${res.encolados} archivo(s) a R2…`)
        if (res.restantes > 0) {
          toast(`Quedan ${res.restantes} para la próxima corrida.`, { duration: 6000 })
        }
      } else {
        toast.success('Todos los archivos ya están en R2')
      }
    } catch (err) {
      // 409: otro administrador ya la lanzó. No es un fallo.
      if (err?.response?.status === 409) {
        toast(extractApiError(err, 'Ya hay una sincronización en curso'))
        archivos.refetch()
      } else {
        toast.error(extractApiError(err, 'No se pudo iniciar la sincronización'))
      }
    } finally {
      setSincronizando(false)
    }
  }

  const datosBd = almacen.data
  const datosImg = imagenes.data
  const datosArch = archivos.data

  const cargando = almacen.loading || imagenes.loading || archivos.loading
  const errorGlobal = almacen.error || imagenes.error || archivos.error

  const filasBd = datosBd?.tablas?.length || 0
  const totalFilasBd = (datosBd?.tablas || []).reduce((acc, t) => acc + (t.filas || 0), 0)
  const imgError = datosImg?.total_error || 0
  const imgPendiente = datosImg?.total_pendiente || 0

  return (
    <div className="space-y-5">
      <PageHeader
        title="Mantenimiento"
        description="Estado de la base de datos, del procesado de imágenes y de los archivos en la nube."
        icon={DatabaseZap}
        actions={
          <BotonActualizar onClick={refrescar} refrescando={refrescando} ruta="/sistemas/almacenamiento" />
        }
      />

      <EstadoCarga
        error={errorGlobal}
        loading={cargando}
        skeleton={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-44" /><Skeleton className="h-44" /><Skeleton className="h-44" />
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TarjetaTema
            icono={Database}
            titulo="Base de datos"
            valor={fmtNumero(totalFilasBd)}
            unidad="filas vigiladas"
            detalle={`${filasBd} tabla(s) que crecen sin límite`}
            tono="neutral"
            etiqueta="Rutina"
            accion="Administrar"
            onClick={() => setAbierto('bd')}
          />

          <TarjetaTema
            icono={ImageOff}
            titulo="Imágenes del catálogo"
            valor={fmtNumero(imgError)}
            unidad={imgError === 1 ? 'imagen en error' : 'imágenes en error'}
            detalle={
              imgPendiente > 0
                ? `${fmtNumero(imgPendiente)} pendiente(s) de procesar`
                : 'Sin pendientes de procesar'
            }
            tono={imgError > 0 ? 'alerta' : 'ok'}
            etiqueta={imgError > 0 ? 'Requiere atención' : 'Al día'}
            accion={imgError > 0 ? `Revisar ${imgError}` : 'Ver detalle'}
            onClick={() => setAbierto('imagenes')}
          />

          <TarjetaTema
            icono={CloudUpload}
            titulo="Archivos en la nube"
            valor={datosArch?.enabled ? fmtNumero(datosArch?.en_r2) : '—'}
            unidad="en el bucket privado"
            detalle={
              !datosArch?.enabled
                ? 'Sin configurar: se guardan en el servidor'
                : datosArch?.error
                  ? 'No se puede contactar el bucket'
                  : datosArch?.pendientes > 0
                    ? `${fmtNumero(datosArch.pendientes)} por subir`
                    : 'Todo sincronizado'
            }
            tono={
              !datosArch?.enabled ? 'neutral'
                : datosArch?.error ? 'alerta'
                  : datosArch?.pendientes > 0 ? 'aviso' : 'ok'
            }
            etiqueta={
              !datosArch?.enabled ? 'Inactivo'
                : datosArch?.error ? 'Requiere atención'
                  : datosArch?.pendientes > 0 ? 'Pendiente' : 'Al día'
            }
            accion="Administrar"
            onClick={() => setAbierto('archivos')}
          />
        </div>
      </EstadoCarga>

      <ModalBaseDatos
        open={abierto === 'bd'}
        onClose={() => setAbierto(null)}
        datos={datosBd}
        mesesPurga={mesesPurga}
        setMesesPurga={setMesesPurga}
        onPurgar={() => setConfirmPurga(true)}
      />

      <ModalImagenes
        open={abierto === 'imagenes'}
        onClose={() => setAbierto(null)}
        datos={datosImg}
        onReintentar={() => setConfirmReintento(true)}
      />

      <ModalArchivos
        open={abierto === 'archivos'}
        onClose={() => setAbierto(null)}
        datos={datosArch}
        progreso={progreso}
        sincronizando={sincronizando}
        onSincronizar={ejecutarSyncArchivos}
      />

      <ConfirmDialog
        open={confirmPurga}
        onClose={() => setConfirmPurga(false)}
        onConfirm={ejecutarPurga}
        loading={enviando}
        title="¿Purgar la bitácora?"
        description={`Se eliminarán de forma irreversible las entradas con más de ${mesesPurga} meses. La purga queda registrada en la propia bitácora con tu nombre.`}
        confirmLabel="Purgar"
        tone="danger"
      />

      <ConfirmDialog
        open={confirmReintento}
        onClose={() => setConfirmReintento(false)}
        onConfirm={ejecutarReintento}
        loading={enviando}
        title="¿Reintentar las imágenes en error?"
        description="Se vuelven a encolar para procesarse en segundo plano. No bloquea la aplicación; el resultado tarda unos minutos en reflejarse."
        confirmLabel="Reintentar"
        tone="default"
      />
    </div>
  )
}
