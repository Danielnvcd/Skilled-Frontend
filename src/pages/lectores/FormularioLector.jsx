/**
 * Alta y edición de un lector: identificación (nombre, ubicación, notas, foto)
 * y conexión (IP, puerto, credenciales).
 *
 * La foto se sube DESPUÉS de guardar los datos, con su propio endpoint: en un
 * alta el lector aún no tiene id. Si la foto falla, el lector ya quedó
 * guardado y se avisa aparte, en vez de perder todo lo capturado.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { ScanFace, Server, Tag } from 'lucide-react'
import { Modal, Button, Input, Textarea, AuthImage } from '../../components/ui'
import { extractApiError } from '../../utils/apiError'
import {
  crearDispositivo, actualizarDispositivo, subirFotoLector, quitarFotoLector, rutaFotoLector,
} from '../../api/hikvision'

const MAX_BYTES = 5 * 1024 * 1024
const TIPOS = ['image/jpeg', 'image/png']

export default function FormularioLector({ lector, onClose, onGuardado }) {
  const edicion = Boolean(lector)
  const [form, setForm] = useState(() => ({
    nombre: lector?.nombre || '',
    ubicacion: lector?.ubicacion || '',
    notas: lector?.notas || '',
    host: lector?.host || '',
    puerto: lector?.puerto || 80,
    usuario: lector?.usuario || '',
    password: '',            // nunca vuelve del servidor: vacío = no cambiarla
    activo: lector?.activo ?? true,
  }))
  const [fotoNueva, setFotoNueva] = useState(null)
  const [quitarFoto, setQuitarFoto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const inputArchivo = useRef(null)
  const inputCamara = useRef(null)

  const preview = useMemo(() => (fotoNueva ? URL.createObjectURL(fotoNueva) : null), [fotoNueva])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const cambiar = (campo) => (e) => setForm({ ...form, [campo]: e.target.value })

  const elegir = (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!TIPOS.includes(f.type)) { toast.error('Solo se aceptan fotos JPG o PNG.'); return }
    if (f.size > MAX_BYTES) { toast.error('La foto pesa más de 5 MB.'); return }
    setFotoNueva(f)
    setQuitarFoto(false)
  }

  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    let guardado
    try {
      guardado = edicion
        ? await actualizarDispositivo(lector.id, form)
        : await crearDispositivo(form)
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo guardar el lector'))
      setGuardando(false)
      return
    }

    try {
      if (fotoNueva) await subirFotoLector(guardado.id, fotoNueva)
      else if (quitarFoto && lector?.tiene_foto) await quitarFotoLector(guardado.id)
      toast.success(edicion ? 'Lector actualizado' : 'Lector agregado')
    } catch (err) {
      toast.error(`Datos guardados, pero la foto no: ${extractApiError(err, 'error al subirla')}`)
    }
    setGuardando(false)
    onGuardado()
  }

  const fotoActual = edicion && lector.tiene_foto && !quitarFoto
  const hayFoto = Boolean(fotoNueva) || fotoActual

  return (
    <Modal
      open
      onClose={guardando ? () => {} : onClose}
      title={edicion ? `Editar ${lector.nombre}` : 'Agregar lector'}
      description="El lector debe estar en la red local de la empresa."
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={guardando}>Cancelar</Button>
          <Button type="submit" form="form-lector" loading={guardando}>
            {edicion ? 'Guardar cambios' : 'Agregar lector'}
          </Button>
        </div>
      }
    >
      <form id="form-lector" onSubmit={guardar} className="space-y-5">
        {/* ── Foto: una fila discreta, no la protagonista ──────────── */}
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-md bg-ink-100 ring-1 ring-ink-200 dark:bg-ink-800 dark:ring-ink-700">
            {fotoNueva ? (
              <img src={preview} alt="Foto nueva" className="h-full w-full object-cover" />
            ) : fotoActual ? (
              <AuthImage src={rutaFotoLector(lector.id, lector.foto_version)} alt=""
                         className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-ink-400">
                <ScanFace size={20} />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink-700 dark:text-ink-300">Foto del equipo</p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
              <button type="button" className="font-medium text-brand-700 hover:underline disabled:opacity-50 dark:text-brand-300"
                      onClick={() => inputArchivo.current?.click()} disabled={guardando}>
                {hayFoto ? 'Cambiar' : 'Subir'}
              </button>
              <button type="button" className="font-medium text-brand-700 hover:underline disabled:opacity-50 dark:text-brand-300"
                      onClick={() => inputCamara.current?.click()} disabled={guardando}>
                Tomar con la cámara
              </button>
              {hayFoto && (
                <button type="button" className="font-medium text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                        onClick={() => { setFotoNueva(null); setQuitarFoto(true) }} disabled={guardando}>
                  Quitar
                </button>
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-ink-500 dark:text-ink-400">Opcional · JPG o PNG, hasta 5 MB</p>
          </div>
          <input ref={inputArchivo} type="file" accept="image/jpeg,image/png" className="hidden" onChange={elegir} />
          <input ref={inputCamara} type="file" accept="image/jpeg,image/png" capture="environment"
                 className="hidden" onChange={elegir} />
        </div>

        {/* ── Datos ────────────────────────────────────────────── */}
        <div className="space-y-5">
          <fieldset className="space-y-3">
            <legend className="mb-1 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">
              <Tag size={12} /> Identificación
            </legend>
            <Input label="Nombre" value={form.nombre} required maxLength={120}
                   placeholder="Lector Oficina Puebla" onChange={cambiar('nombre')} />
            <Input label="Ubicación" value={form.ubicacion} maxLength={120}
                   placeholder="Planta baja, puerta principal" onChange={cambiar('ubicacion')} />
            <Textarea label="Notas" value={form.notas} maxLength={500} rows={2}
                      placeholder="Qué puerta abre, quién lo instaló, número de inventario…"
                      onChange={cambiar('notas')} />
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="mb-1 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">
              <Server size={12} /> Conexión
            </legend>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Input label="Dirección IP" value={form.host} required maxLength={120}
                       placeholder="192.168.1.159" onChange={cambiar('host')} />
              </div>
              <Input label="Puerto" type="number" value={form.puerto} required min={1} max={65535}
                     onChange={(e) => setForm({ ...form, puerto: Number(e.target.value) })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Usuario" value={form.usuario} required maxLength={64} autoComplete="off"
                     onChange={cambiar('usuario')} />
              <Input
                label="Contraseña" type="password" value={form.password}
                required={!edicion} maxLength={200} autoComplete="new-password"
                hint={edicion ? 'Déjala vacía para no cambiarla.' : undefined}
                onChange={cambiar('password')}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-700 dark:text-ink-300">
              <input type="checkbox" checked={form.activo}
                     onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                     className="rounded border-ink-300 dark:border-ink-600" />
              Lector activo
              <span className="text-xs text-ink-500 dark:text-ink-400">
                (desactivado no se escucha ni se sincroniza)
              </span>
            </label>
          </fieldset>
        </div>
      </form>
    </Modal>
  )
}
