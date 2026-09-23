/**
 * Foto de un empleado en el lector: ver, comparar y cambiar sin salir de aquí.
 *
 * Muestra lado a lado la foto de perfil del ERP y el rostro que el lector
 * tiene registrado (la cara con la que compara de verdad). Si no coinciden, o
 * el lector no reconoce bien a la persona, se sube o se toma una foto nueva.
 *
 * La foto nueva se prueba PRIMERO contra el lector: si su motor facial no la
 * acepta se muestra el motivo aquí mismo y no cambia nada. Así nunca queda en
 * el ERP una foto que el lector no puede usar.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Camera, ImageOff, Upload, RefreshCw, AlertTriangle } from 'lucide-react'
import { Modal, Button, AuthImage } from '../../components/ui'
import { extractApiError } from '../../utils/apiError'
import {
  cambiarFotoEnLector, sincronizarEmpleados, rutaFotoPerfil, rutaRostroLector,
} from '../../api/hikvision'

// Mismo tope que el backend (`allowed_image_file`): así el error llega antes
// de subir 20 MB por la red.
const MAX_BYTES = 5 * 1024 * 1024
const TIPOS = ['image/jpeg', 'image/png']

export default function FotoEmpleadoModal({ dispositivoId, empleado, onClose, onCambio }) {
  const [archivo, setArchivo] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [reenviando, setReenviando] = useState(false)
  const [rechazo, setRechazo] = useState('')
  // Se incrementa tras cada cambio para volver a pedir el rostro al lector:
  // su URL no cambia aunque la cara sí.
  const [versionRostro, setVersionRostro] = useState(0)
  const inputArchivo = useRef(null)
  const inputCamara = useRef(null)

  const abierto = empleado !== null
  const enLector = empleado && empleado.estado !== 'NO_AGREGADO'

  // El estado de un empleado no se arrastra al siguiente porque quien usa el
  // modal lo monta con `key={empleado.id}`.

  const preview = useMemo(() => (archivo ? URL.createObjectURL(archivo) : null), [archivo])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const elegir = (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''   // permite volver a elegir el mismo archivo
    if (!f) return
    if (!TIPOS.includes(f.type)) {
      toast.error('Solo se aceptan fotos JPG o PNG.')
      return
    }
    if (f.size > MAX_BYTES) {
      toast.error('La foto pesa más de 5 MB.')
      return
    }
    setRechazo('')
    setArchivo(f)
  }

  const enviar = async () => {
    setEnviando(true)
    setRechazo('')
    try {
      const r = await cambiarFotoEnLector(dispositivoId, empleado.id, archivo)
      toast.success(`Foto de ${empleado.nombre_completo} actualizada en el lector`)
      setArchivo(null)
      setVersionRostro((v) => v + 1)
      onCambio?.(r.empleado)
    } catch (err) {
      // El rechazo del motor facial se queda visible junto a la foto: es lo
      // que dice cómo tomar la siguiente.
      setRechazo(extractApiError(err, 'El lector no aceptó la fotografía.'))
    } finally {
      setEnviando(false)
    }
  }

  // Reenvía lo que ya está en la ficha (foto + nombre), sin subir nada nuevo.
  const reenviar = async () => {
    setReenviando(true)
    try {
      const r = await sincronizarEmpleados(dispositivoId, [empleado.id])
      const res = r.resultados?.[0]
      if (res?.ok) {
        toast.success('Datos del ERP enviados al lector')
        setVersionRostro((v) => v + 1)
        onCambio?.()
      } else {
        setRechazo(res?.error || 'No se pudo actualizar en el lector.')
      }
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo actualizar en el lector'))
    } finally {
      setReenviando(false)
    }
  }

  const sinFoto = (texto) => (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-ink-400 dark:text-ink-500">
      <ImageOff size={22} />
      <span className="text-xs">{texto}</span>
    </div>
  )

  return (
    <Modal
      open={abierto}
      onClose={enviando ? () => {} : onClose}
      title={empleado ? `Fotografía — ${empleado.nombre_completo}` : 'Fotografía'}
      description={empleado ? `Empleado ${empleado.no_empleado}` : ''}
      size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            {enLector && empleado.tiene_foto && !archivo && (
              <Button
                variant="ghost" leftIcon={<RefreshCw size={16} />}
                loading={reenviando} onClick={reenviar}
              >
                Reenviar datos del ERP
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={enviando}>Cerrar</Button>
            <Button
              leftIcon={<Upload size={16} />}
              disabled={!archivo} loading={enviando} onClick={enviar}
            >
              Guardar y enviar al lector
            </Button>
          </div>
        </div>
      }
    >
      {empleado && (
        <div className="space-y-4">
          {empleado.cambios_pendientes?.length > 0 && (
            <p className="rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:bg-sky-900/30 dark:text-sky-300">
              Cambió en la ficha desde la última sincronización:{' '}
              <strong>{empleado.cambios_pendientes.join(', ')}</strong>. Usa
              «Reenviar datos del ERP» para que el lector tenga lo mismo.
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Marco titulo={archivo ? 'Foto nueva' : 'Foto de perfil (ERP)'}>
              {archivo ? (
                <img src={preview} alt="Foto nueva" className="h-full w-full object-cover" />
              ) : empleado.tiene_foto ? (
                <AuthImage
                  src={rutaFotoPerfil(empleado.id, empleado.foto_version)}
                  alt={empleado.nombre_completo}
                  className="h-full w-full object-cover"
                  fallback={sinFoto('No se pudo cargar')}
                />
              ) : sinFoto('Sin fotografía')}
            </Marco>

            <Marco titulo="Registrada en el lector">
              {enLector ? (
                <AuthImage
                  src={rutaRostroLector(dispositivoId, empleado.id, `${empleado.foto_version || ''}${versionRostro}`)}
                  alt={`Rostro de ${empleado.nombre_completo} en el lector`}
                  className="h-full w-full object-cover"
                  fallback={sinFoto('El lector no tiene rostro')}
                />
              ) : sinFoto('Todavía no está en el lector')}
            </Marco>
          </div>

          {rechazo && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              <div>
                <p>{rechazo}</p>
                <p className="mt-1 text-xs opacity-80">
                  No se cambió nada. Prueba con una foto de frente, con buena luz,
                  sin lentes oscuros ni gorra, y con la cara ocupando buena parte
                  de la imagen.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary" leftIcon={<Upload size={16} />}
              onClick={() => inputArchivo.current?.click()} disabled={enviando}
            >
              Elegir foto
            </Button>
            {/* En el celular `capture` abre directo la cámara frontal; en
                escritorio se comporta como un selector de archivo normal. */}
            <Button
              variant="secondary" leftIcon={<Camera size={16} />}
              onClick={() => inputCamara.current?.click()} disabled={enviando}
            >
              Tomar foto
            </Button>
            {archivo && (
              <Button variant="ghost" onClick={() => { setArchivo(null); setRechazo('') }}
                      disabled={enviando}>
                Descartar
              </Button>
            )}
            <input ref={inputArchivo} type="file" accept="image/jpeg,image/png"
                   className="hidden" onChange={elegir} />
            <input ref={inputCamara} type="file" accept="image/jpeg,image/png"
                   capture="user" className="hidden" onChange={elegir} />
          </div>

          <p className="text-xs text-ink-500 dark:text-ink-400">
            La foto se prueba primero en el lector. Solo si la acepta se guarda
            también como foto de perfil del empleado.
          </p>
        </div>
      )}
    </Modal>
  )
}

function Marco({ titulo, children }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-ink-500 dark:text-ink-400">{titulo}</p>
      <div className="aspect-square w-full overflow-hidden rounded-lg bg-ink-100 ring-1 ring-ink-200 dark:bg-ink-800 dark:ring-ink-700">
        {children}
      </div>
    </div>
  )
}
