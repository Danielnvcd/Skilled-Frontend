/**
 * Agregar personal de oficina desde la pantalla del lector.
 *
 * Solo el personal marcado «de oficina» puede darse de alta en un lector. Esa
 * marca vive en la ficha del empleado (y en la acción masiva de Empleados);
 * aquí se ofrece el mismo paso sin salir del lector: buscar entre los
 * empleados activos que aún no están marcados, elegir varios y, si se quiere,
 * enviarlos al lector en el mismo movimiento.
 *
 * Usa el MISMO endpoint que la acción masiva de Empleados (`marcar_oficina`),
 * con sus mismos permisos (admin) y su bitácora.
 */
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Search, ImageOff, UserPlus } from 'lucide-react'
import { Modal, Button, Input, Skeleton, AuthImage } from '../../components/ui'
import { extractApiError } from '../../utils/apiError'
import { listarTrabajadores, bulkAccionTrabajadores } from '../../api/trabajadores'
import { rutaFotoPerfil } from '../../api/hikvision'

const POR_PAGINA = 30

export default function AgregarOficinaModal({ open, onClose, onAgregados }) {
  const [busqueda, setBusqueda] = useState('')
  const [lista, setLista] = useState(null)       // null = cargando
  const [error, setError] = useState(null)
  const [seleccion, setSeleccion] = useState(() => new Map())   // id → fila
  const [enviarAlLector, setEnviarAlLector] = useState(true)
  const [guardando, setGuardando] = useState(false)

  // Búsqueda con pausa: una petición cuando se deja de teclear, no una por tecla.
  useEffect(() => {
    if (!open) return undefined
    let vigente = true
    const t = setTimeout(() => {
      listarTrabajadores({ q: busqueda.trim(), esOficina: '0', perPage: POR_PAGINA })
        .then((r) => { if (vigente) { setLista(r.items || []); setError(null) } })
        .catch((err) => { if (vigente) setError(extractApiError(err, 'No se pudo buscar')) })
    }, 300)
    return () => { vigente = false; clearTimeout(t) }
  }, [busqueda, open])

  const alternar = (t) => {
    setSeleccion((prev) => {
      const m = new Map(prev)
      if (m.has(t.id)) m.delete(t.id)
      else m.set(t.id, t)
      return m
    })
  }

  const cerrar = () => {
    if (guardando) return
    setSeleccion(new Map())
    setBusqueda('')
    onClose()
  }

  const guardar = async () => {
    const elegidos = [...seleccion.values()]
    setGuardando(true)
    try {
      const r = await bulkAccionTrabajadores({ ids: elegidos.map((t) => t.id), action: 'marcar_oficina' })
      toast.success(`${r.affected} empleado(s) agregado(s) al personal de oficina`)
      // Al lector solo pueden ir los que tienen foto; los demás quedan
      // marcados y aparecen con su aviso en la lista.
      const conFoto = elegidos.filter((t) => t.foto_perfil).map((t) => t.id)
      setSeleccion(new Map())
      setBusqueda('')
      onAgregados(enviarAlLector ? conFoto : [])
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo marcar como personal de oficina'))
    } finally {
      setGuardando(false)
    }
  }

  const sinFotoElegidos = [...seleccion.values()].filter((t) => !t.foto_perfil).length

  return (
    <Modal
      open={open}
      onClose={cerrar}
      title="Agregar personal de oficina"
      description="Empleados activos que todavía no están marcados como personal de oficina."
      size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-ink-700 dark:text-ink-300">
            <input type="checkbox" checked={enviarAlLector}
                   onChange={(e) => setEnviarAlLector(e.target.checked)}
                   className="rounded border-ink-300 dark:border-ink-600" />
            Enviarlos también a este lector
          </label>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={cerrar} disabled={guardando}>Cancelar</Button>
            <Button leftIcon={<UserPlus size={15} />} onClick={guardar} loading={guardando}
                    disabled={seleccion.size === 0}>
              Agregar{seleccion.size ? ` (${seleccion.size})` : ''}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <Input
          leftIcon={<Search size={14} />} placeholder="Buscar por nombre o número de empleado"
          value={busqueda} onChange={(e) => setBusqueda(e.target.value)} autoFocus
        />

        {enviarAlLector && sinFotoElegidos > 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {sinFotoElegidos} de los elegidos no tiene foto: quedará marcado como personal de
            oficina, pero no se enviará al lector hasta que tenga una.
          </p>
        )}

        <div className="max-h-[22rem] overflow-y-auto rounded-md border border-ink-200 dark:border-ink-700">
          {error ? (
            <p className="p-4 text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : lista === null ? (
            <div className="space-y-2 p-3"><Skeleton className="h-9" /><Skeleton className="h-9" /></div>
          ) : !lista.length ? (
            <p className="p-4 text-sm text-ink-500 dark:text-ink-400">
              {busqueda ? 'Nadie coincide con la búsqueda.' : 'Todos los empleados activos ya son personal de oficina.'}
            </p>
          ) : (
            <ul className="divide-y divide-ink-100 dark:divide-ink-800">
              {lista.map((t) => {
                const elegido = seleccion.has(t.id)
                return (
                  <li key={t.id}>
                    <label className={`flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-ink-50 dark:hover:bg-ink-800/50 ${elegido ? 'bg-brand-50/60 dark:bg-brand-900/20' : ''}`}>
                      <input type="checkbox" checked={elegido} onChange={() => alternar(t)}
                             className="rounded border-ink-300 dark:border-ink-600" />
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-ink-100 dark:bg-ink-800">
                        {t.foto_perfil ? (
                          <AuthImage src={rutaFotoPerfil(t.id)} alt="" className="h-full w-full object-cover"
                                     fallback={<ImageOff size={14} className="text-ink-400" />} />
                        ) : <ImageOff size={14} className="text-ink-400" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink-900 dark:text-ink-100">
                          {[t.nombre, t.nombre_apellidos].filter(Boolean).join(' ')}
                          <span className="ml-2 font-mono text-xs font-normal text-ink-500">{t.no_empleado}</span>
                        </span>
                        <span className="block truncate text-xs text-ink-500 dark:text-ink-400">
                          {[t.area, t.puesto].filter(Boolean).join(' · ') || '—'}
                          {!t.foto_perfil && <span className="text-amber-600 dark:text-amber-400"> · sin foto</span>}
                        </span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        {lista && lista.length === POR_PAGINA && (
          <p className="text-xs text-ink-500 dark:text-ink-400">
            Se muestran los primeros {POR_PAGINA}. Escribe para buscar a alguien en particular.
          </p>
        )}
      </div>
    </Modal>
  )
}
