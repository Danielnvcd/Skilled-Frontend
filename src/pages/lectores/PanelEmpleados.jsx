/**
 * Pestaña «Empleados» del lector: elegir qué personal de oficina se sincroniza.
 *
 * Tres reglas que la pantalla hace visibles, y que el backend vuelve a aplicar
 * por su cuenta (la interfaz no es la defensa):
 *
 *   · Solo aparece personal marcado como de oficina, activo y sin baja.
 *   · Sin fotografía no se puede sincronizar; la casilla queda deshabilitada
 *     y se dice POR QUÉ, en vez de dejar al usuario adivinando.
 *   · «Seleccionar todos» marca únicamente a quienes sí tienen fotografía.
 *
 * Si un empleado falla, los demás siguen: el resultado se muestra persona por
 * persona al terminar, porque un resumen del tipo «3 de 5» obliga a adivinar
 * cuáles fallaron y por qué.
 *
 * La foto se ve y se cambia aquí mismo (`FotoEmpleadoModal`). Quien cambió de
 * foto, nombre o número en su ficha después de sincronizar aparece como
 * «Desactualizado».
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Users, UploadCloud, ImageOff, CheckCircle2, XCircle, Trash2, AlertTriangle, Camera, Search,
} from 'lucide-react'
import {
  Button, Card, Badge, EmptyState, Skeleton, Input, Modal, ConfirmDialog, AuthImage,
} from '../../components/ui'
import { extractApiError } from '../../utils/apiError'
import {
  sincronizarEmpleados, quitarEmpleadoDeLector, etiquetaEstado, rutaFotoPerfil,
} from '../../api/hikvision'
import { formatoFecha } from './formato'
import FotoEmpleadoModal from './FotoEmpleadoModal'

// Igual que el tope del backend (`MAX_POR_TANDA`). Cada empleado son varias
// peticiones al equipo, así que una tanda enorme agotaría el timeout.
const MAX_POR_TANDA = 50

// Filtros rápidos por estado. `en_lector` junta a quien está en el equipo
// (al día o no); los demás son un estado cada uno.
const FILTROS = [
  { id: 'todos', texto: 'Todos', aplica: () => true },
  { id: 'en_lector', texto: 'En el lector',
    aplica: (e) => e.estado === 'SINCRONIZADO' || e.estado === 'DESACTUALIZADO' },
  { id: 'DESACTUALIZADO', texto: 'Desactualizados', aplica: (e) => e.estado === 'DESACTUALIZADO' },
  { id: 'NO_AGREGADO', texto: 'No agregados', aplica: (e) => e.estado === 'NO_AGREGADO' && e.tiene_foto },
  { id: 'ERROR', texto: 'Con error', aplica: (e) => e.estado === 'ERROR' },
  { id: 'sin_foto', texto: 'Sin foto', aplica: (e) => !e.tiene_foto },
]

export default function PanelEmpleados({ dispositivoId, datos, activo }) {
  const [seleccion, setSeleccion] = useState(() => new Set())
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [sincronizando, setSincronizando] = useState(false)
  const [resultados, setResultados] = useState(null)
  const [porQuitar, setPorQuitar] = useState(null)
  const [quitando, setQuitando] = useState(false)
  // Se guarda solo el id: así el modal siempre lee la fila más reciente del
  // listado (tras un refetch) en vez de una copia vieja.
  const [fotoDe, setFotoDe] = useState(null)

  // Memoizado: `datos.data?.items || []` crearía un array nuevo en cada render
  // y los useMemo de abajo se recalcularían siempre.
  const items = useMemo(() => datos.data?.items || [], [datos.data])

  const conteos = useMemo(
    () => Object.fromEntries(FILTROS.map((f) => [f.id, items.filter(f.aplica).length])),
    [items],
  )

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const f = FILTROS.find((x) => x.id === filtro) || FILTROS[0]
    return items.filter(
      (i) =>
        f.aplica(i) &&
        (!q ||
          i.nombre_completo.toLowerCase().includes(q) ||
          i.no_empleado.toLowerCase().includes(q) ||
          (i.area || '').toLowerCase().includes(q)),
    )
  }, [items, busqueda, filtro])

  const sincronizables = visibles.filter((i) => i.sincronizable)
  const desactualizados = items.filter((i) => i.sincronizable && i.estado === 'DESACTUALIZADO')
  const todosMarcados =
    sincronizables.length > 0 && sincronizables.every((i) => seleccion.has(i.id))
  const empleadoFoto = fotoDe === null ? null : items.find((i) => i.id === fotoDe) || null

  const alternar = (trabajadorId) => {
    setSeleccion((prev) => {
      const s = new Set(prev)
      if (s.has(trabajadorId)) s.delete(trabajadorId)
      else s.add(trabajadorId)
      return s
    })
  }

  // Nunca marca a quien no tiene foto: mandarlo solo produciría un error.
  const alternarTodos = () => {
    setSeleccion((prev) => {
      const s = new Set(prev)
      if (todosMarcados) sincronizables.forEach((i) => s.delete(i.id))
      else sincronizables.forEach((i) => s.add(i.id))
      return s
    })
  }

  const sincronizar = async (ids = [...seleccion]) => {
    if (!ids.length) return
    setSincronizando(true)
    try {
      const r = await sincronizarEmpleados(dispositivoId, ids)
      setResultados(r)
      if (r.resumen.fallidos === 0) {
        toast.success(`${r.resumen.sincronizados} empleado(s) sincronizado(s)`)
      } else {
        toast(`${r.resumen.sincronizados} sincronizado(s), ${r.resumen.fallidos} con problema`,
              { icon: '⚠️' })
      }
      setSeleccion(new Set())
      datos.refetch()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo sincronizar'))
    } finally {
      setSincronizando(false)
    }
  }

  const confirmarQuitar = async () => {
    setQuitando(true)
    try {
      await quitarEmpleadoDeLector(dispositivoId, porQuitar.id)
      toast.success(`${porQuitar.nombre_completo} fue quitado del lector`)
      setPorQuitar(null)
      datos.refetch()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo quitar al empleado'))
      datos.refetch()
    } finally {
      setQuitando(false)
    }
  }

  return (
    <div className="space-y-4">
      {desactualizados.length > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-sky-200 bg-sky-50/60 p-3 dark:border-sky-800 dark:bg-sky-900/20">
          <p className="text-sm text-sky-800 dark:text-sky-300">
            <strong>{desactualizados.length}</strong> empleado(s) cambiaron en su ficha desde
            la última sincronización. El lector todavía tiene los datos anteriores.
          </p>
          <Button
            size="sm" leftIcon={<UploadCloud size={14} />} loading={sincronizando}
            disabled={!activo}
            onClick={() => sincronizar(desactualizados.map((i) => i.id))}
          >
            Actualizar todos
          </Button>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="space-y-3 border-b border-ink-100 p-3 dark:border-ink-800">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-full sm:w-72">
              <Input
                leftIcon={<Search size={14} />}
                placeholder="Buscar por nombre, número o área"
                value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              {seleccion.size > MAX_POR_TANDA && (
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  Máximo {MAX_POR_TANDA} por tanda
                </span>
              )}
              <Button
                leftIcon={<UploadCloud size={16} />}
                loading={sincronizando}
                disabled={!activo || seleccion.size === 0 || seleccion.size > MAX_POR_TANDA}
                onClick={() => sincronizar()}
                title={activo ? undefined : 'El lector está desactivado'}
              >
                Sincronizar{seleccion.size > 0 && ` (${seleccion.size})`}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filtrar por estado">
            {FILTROS.map((f) => (
              <button
                key={f.id} type="button" role="tab" aria-selected={filtro === f.id}
                onClick={() => setFiltro(f.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors focus-ring ${
                  filtro === f.id
                    ? 'bg-brand-800 text-white ring-brand-800 dark:bg-brand-600 dark:ring-brand-600'
                    : 'bg-white text-ink-600 ring-ink-200 hover:bg-ink-50 dark:bg-ink-900 dark:text-ink-300 dark:ring-ink-700 dark:hover:bg-ink-800'
                }`}
              >
                {f.texto}
                <span className={filtro === f.id ? 'opacity-80' : 'text-ink-400 dark:text-ink-500'}>
                  {conteos[f.id] ?? 0}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 border-b border-ink-100 bg-ink-50/60 px-3 py-2 text-xs font-medium uppercase tracking-wide text-ink-500 dark:border-ink-800 dark:bg-ink-900/40 dark:text-ink-400">
          <input
            type="checkbox" checked={todosMarcados} onChange={alternarTodos}
            disabled={sincronizables.length === 0}
            aria-label="Seleccionar todos los que tienen fotografía"
            className="rounded border-ink-300 dark:border-ink-600"
          />
          <span className="flex-1">Empleado</span>
          <span className="hidden w-32 sm:block">Última sincronización</span>
          <span className="w-28 text-right">Estado</span>
          <span className="w-16" />
        </div>

        {datos.loading && !items.length ? (
          <div className="space-y-2 p-4"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
        ) : datos.error ? (
          <EmptyState
            icon={AlertTriangle}
            title="No se pudo cargar la lista"
            description={extractApiError(datos.error, 'Intenta de nuevo en unos momentos.')}
            action={<Button variant="secondary" onClick={datos.refetch}>Reintentar</Button>}
          />
        ) : !visibles.length ? (
          <EmptyState
            icon={Users}
            title={items.length ? 'Sin coincidencias' : 'No hay personal de oficina'}
            description={
              items.length
                ? 'Ningún empleado coincide con la búsqueda o el filtro.'
                : 'Marca a los empleados como personal de oficina desde el módulo de Empleados para que aparezcan aquí.'
            }
          />
        ) : (
          <ul className="divide-y divide-ink-100 dark:divide-ink-800">
            {visibles.map((emp) => {
              const est = etiquetaEstado(emp.estado)
              return (
                <li key={emp.id}
                    className={`flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-ink-50/70 dark:hover:bg-ink-800/40 ${seleccion.has(emp.id) ? 'bg-brand-50/60 dark:bg-brand-900/20' : ''}`}>
                  <input
                    type="checkbox"
                    checked={seleccion.has(emp.id)}
                    disabled={!emp.sincronizable}
                    onChange={() => alternar(emp.id)}
                    aria-label={`Seleccionar a ${emp.nombre_completo}`}
                    className="rounded border-ink-300 dark:border-ink-600 disabled:opacity-40"
                  />
                  <button
                    type="button" onClick={() => setFotoDe(emp.id)}
                    title="Ver o cambiar la fotografía"
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink-100 ring-1 ring-ink-200 hover:ring-2 hover:ring-brand-500 focus-ring dark:bg-ink-800 dark:ring-ink-700"
                  >
                    {emp.tiene_foto ? (
                      <AuthImage
                        src={rutaFotoPerfil(emp.id, emp.foto_version)}
                        alt={emp.nombre_completo}
                        className="h-full w-full object-cover"
                        fallback={<ImageOff size={16} className="text-ink-400" />}
                      />
                    ) : (
                      <ImageOff size={16} className="text-ink-400" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-900 dark:text-ink-100">
                      <Link to={`/empleados/${emp.id}`} className="hover:underline">
                        {emp.nombre_completo}
                      </Link>
                      <span className="ml-2 font-mono text-xs text-ink-500 dark:text-ink-400">
                        {emp.no_empleado}
                      </span>
                    </p>
                    <p className="truncate text-xs text-ink-500 dark:text-ink-400">
                      {[emp.area, emp.puesto].filter(Boolean).join(' · ') || '—'}
                    </p>
                    {!emp.sincronizable && (
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                        <ImageOff size={12} /> {emp.motivo_no_sincronizable}
                      </p>
                    )}
                    {emp.estado === 'ERROR' && emp.ultimo_error && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{emp.ultimo_error}</p>
                    )}
                    {emp.estado === 'DESACTUALIZADO' && (
                      <p className="mt-1 text-xs text-sky-600 dark:text-sky-400">
                        Cambió en la ficha: {emp.cambios_pendientes.join(', ')}
                      </p>
                    )}
                  </div>
                  <span className="hidden w-32 text-xs text-ink-500 dark:text-ink-400 sm:block">
                    {emp.sincronizado_en ? formatoFecha(emp.sincronizado_en) : '—'}
                  </span>
                  <span className="w-28 text-right"><Badge tone={est.tono} dot>{est.texto}</Badge></span>
                  <span className="flex w-16 justify-end gap-0.5">
                    <Button
                      size="icon-sm" variant="ghost" title="Ver o cambiar la fotografía"
                      aria-label="Ver o cambiar la fotografía"
                      onClick={() => setFotoDe(emp.id)}
                    >
                      <Camera size={14} />
                    </Button>
                    {emp.estado !== 'NO_AGREGADO' && (
                      <Button
                        size="icon-sm" variant="danger-ghost" title="Quitar del lector"
                        aria-label="Quitar del lector"
                        onClick={() => setPorQuitar(emp)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <FotoEmpleadoModal
        key={fotoDe ?? 'cerrado'}
        dispositivoId={dispositivoId}
        empleado={empleadoFoto}
        onClose={() => setFotoDe(null)}
        onCambio={() => datos.refetch()}
      />

      <Modal
        open={resultados !== null}
        onClose={() => setResultados(null)}
        title="Resultado de la sincronización"
        description={
          resultados &&
          `${resultados.resumen.sincronizados} de ${resultados.resumen.total} se sincronizaron.`
        }
        size="lg"
        footer={
          <div className="flex justify-end">
            <Button onClick={() => setResultados(null)}>Cerrar</Button>
          </div>
        }
      >
        <ul className="divide-y divide-ink-100 dark:divide-ink-800">
          {(resultados?.resultados || []).map((r) => (
            <li key={r.trabajador_id} className="flex items-start gap-3 py-2.5">
              {r.ok
                ? <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                : <XCircle size={16} className="mt-0.5 flex-shrink-0 text-red-600 dark:text-red-400" />}
              <div className="min-w-0">
                <p className="text-sm text-ink-900 dark:text-ink-100">
                  {r.nombre_completo || `Empleado #${r.trabajador_id}`}
                </p>
                {r.error && (
                  <p className="text-xs text-red-600 dark:text-red-400">{r.error}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Modal>

      <ConfirmDialog
        open={porQuitar !== null}
        onClose={() => setPorQuitar(null)}
        onConfirm={confirmarQuitar}
        loading={quitando}
        title="Quitar del lector"
        description={
          `${porQuitar?.nombre_completo} se eliminará del lector, junto con su ` +
          'fotografía registrada. Dejará de poder identificarse en ese equipo.'
        }
        confirmLabel="Quitar"
      />
    </div>
  )
}
