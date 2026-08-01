import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft, CornerUpLeft, FileSpreadsheet, PackageOpen, PackagePlus,
  RefreshCw, Search, Send, History,
} from 'lucide-react'
import {
  PageHeader, Button, Card, Input, Skeleton, EmptyState, InfoTip, Badge,
  Table, THead, TH, TBody, TR, TD,
} from '../../components/ui'
import {
  getProyectoExistencias, getResumenAsignacion, getAlmacenes,
} from '../../api/inventario'
import { extractApiError } from '../../utils/apiError'
import { useResource } from '../../hooks/useResource'
import ModalAgregar from './materialProyecto/ModalAgregar'
import ModalImportar from './materialProyecto/ModalImportar'
import ModalMover from './materialProyecto/ModalMover'
import { money, num } from './materialProyecto/shared'

export default function MaterialProyectoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [sel, setSel] = useState(() => new Set())
  const [modal, setModal] = useState(null)   // 'agregar' | 'importar' | 'general' | 'proyecto'
  const [refrescando, setRefrescando] = useState(false)

  const { data, loading, error, refetch } = useResource(
    ['proyecto-existencias', id],
    () => getProyectoExistencias(id),
    {
      staleMs: 15_000,
      invalidateOn: ['producto:changed', 'movimiento:changed', 'solicitud:changed'],
    },
  )

  // Lista de destinos para «mover a otro proyecto». Se reutiliza el resumen de
  // la pantalla principal en vez de pedir otro endpoint: ya trae los proyectos
  // activos y su caché se comparte entre las dos vistas.
  const { data: resumen } = useResource(
    ['resumen-asignacion'],
    () => getResumenAsignacion(),
    { staleMs: 30_000, invalidateOn: ['producto:changed', 'proyecto:changed'] },
  )

  const { data: almacenes } = useResource(
    ['almacenes'],
    () => getAlmacenes(),
    { staleMs: 300_000, invalidateOn: ['almacen:changed'] },
  )

  useEffect(() => {
    if (error) toast.error(extractApiError(error, 'Error al cargar el material del proyecto'))
  }, [error])

  const proyecto = data?.proyecto
  const materiales = useMemo(() => data?.materiales ?? [], [data])
  const bodegas = data?.almacenes ?? []
  const totales = data?.totales

  const filtrados = useMemo(() => {
    const s = search.trim().toLowerCase()
    if (!s) return materiales
    return materiales.filter((m) =>
      m.codigo?.toLowerCase().includes(s) || m.descripcion?.toLowerCase().includes(s),
    )
  }, [materiales, search])

  // Al refrescar, el material devuelto en su totalidad desaparece de la lista.
  // Sin esta limpieza la selección seguiría contando filas que ya no existen y
  // la barra de acciones mentiría sobre cuántas cosas va a mover.
  useEffect(() => {
    setSel((prev) => {
      const vivos = new Set(materiales.map((m) => m.producto_id))
      const siguiente = new Set([...prev].filter((pid) => vivos.has(pid)))
      return siguiente.size === prev.size ? prev : siguiente
    })
  }, [materiales])

  const refrescar = async () => {
    if (refrescando) return
    setRefrescando(true)
    try { await refetch() } finally { setRefrescando(false) }
  }

  const alternar = (pid) =>
    setSel((prev) => {
      const s = new Set(prev)
      if (s.has(pid)) s.delete(pid); else s.add(pid)
      return s
    })

  const todosVisibles = filtrados.length > 0 && filtrados.every((m) => sel.has(m.producto_id))
  const alternarTodos = () =>
    setSel((prev) => {
      const s = new Set(prev)
      if (todosVisibles) filtrados.forEach((m) => s.delete(m.producto_id))
      else filtrados.forEach((m) => s.add(m.producto_id))
      return s
    })

  const seleccionados = materiales.filter((m) => sel.has(m.producto_id))

  const tras = () => { setSel(new Set()); refetch() }

  return (
    <div className="pb-24">
      <PageHeader
        icon={PackageOpen}
        title={proyecto ? `${proyecto.numero_proyecto} — material apartado` : 'Material del proyecto'}
        description={proyecto?.nombre || 'Lo que esta obra tiene guardado a su nombre ahora mismo.'}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              leftIcon={<ArrowLeft size={14} />}
              onClick={() => navigate('/inventario/material-proyecto')}
            >
              Volver
            </Button>
            <Button
              variant="secondary"
              leftIcon={<RefreshCw size={14} className={refrescando ? 'animate-spin' : ''} />}
              onClick={refrescar}
              disabled={refrescando}
            >
              {refrescando ? 'Actualizando…' : 'Actualizar'}
            </Button>
            <Button
              variant="secondary"
              leftIcon={<FileSpreadsheet size={14} />}
              onClick={() => setModal('importar')}
              disabled={!proyecto}
            >
              Importar Excel
            </Button>
            <Button
              variant="primary"
              leftIcon={<PackagePlus size={14} />}
              onClick={() => setModal('agregar')}
              disabled={!proyecto}
            >
              Agregar material
            </Button>
          </div>
        }
      />

      {loading ? (
        <Skeleton className="h-96 rounded-xl mt-4" />
      ) : (
        <>
          <Card className="mt-4 p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex flex-wrap items-center gap-5">
                <div>
                  <div className="text-lg font-extrabold tabular-nums leading-tight">
                    {totales?.materiales ?? 0}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-ink-400 font-semibold">Materiales</div>
                </div>
                <div>
                  <div className="text-lg font-extrabold tabular-nums leading-tight">
                    {num(totales?.unidades)}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-ink-400 font-semibold">Unidades</div>
                </div>
                <div>
                  <div className="text-lg font-extrabold tabular-nums leading-tight text-emerald-700 dark:text-emerald-300">
                    {money(totales?.valor)}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-ink-400 font-semibold">Valor</div>
                </div>
              </div>
              <Input
                type="search"
                leftIcon={<Search size={15} />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar material…"
                wrapperClassName="flex-1 min-w-[200px] max-w-sm ml-auto"
              />
            </div>
          </Card>

          {materiales.length === 0 ? (
            <EmptyState
              icon={PackageOpen}
              title="Este proyecto no tiene material apartado"
              description="Agrega material desde el stock General o importa una lista desde Excel."
              className="mt-4"
            />
          ) : filtrados.length === 0 ? (
            <EmptyState icon={Search} title="Sin coincidencias" description="Cambia la búsqueda." className="mt-4" />
          ) : (
            <Card className="mt-4 overflow-hidden">
              <Table>
                <THead>
                  <TH className="w-10">
                    <input
                      type="checkbox"
                      checked={todosVisibles}
                      onChange={alternarTodos}
                      aria-label="Seleccionar todos"
                      className="h-4 w-4 rounded border-ink-300 dark:border-ink-600 text-brand-600 focus:ring-brand-500/30"
                    />
                  </TH>
                  <TH>Material</TH>
                  {bodegas.map((b) => (
                    <TH key={b.id} align="right">{b.nombre}</TH>
                  ))}
                  <TH align="right">Total</TH>
                  <TH align="right">
                    <span className="inline-flex items-center gap-1">
                      Del plan
                      <InfoTip text="Cuánto de lo planeado ya está apartado. Vacío cuando el proyecto no tiene plan de materiales capturado — que no es lo mismo que 0 %." />
                    </span>
                  </TH>
                  <TH align="right">Valor</TH>
                  <TH align="right"><span className="sr-only">Kardex</span></TH>
                </THead>
                <TBody>
                  {filtrados.map((m) => (
                    <TR
                      key={m.producto_id}
                      className={sel.has(m.producto_id) ? 'bg-brand-50/60 dark:bg-brand-900/15' : ''}
                    >
                      <TD>
                        <input
                          type="checkbox"
                          checked={sel.has(m.producto_id)}
                          onChange={() => alternar(m.producto_id)}
                          aria-label={`Seleccionar ${m.codigo}`}
                          className="h-4 w-4 rounded border-ink-300 dark:border-ink-600 text-brand-600 focus:ring-brand-500/30"
                        />
                      </TD>
                      <TD>
                        <div className="font-mono text-xs font-bold text-brand-700 dark:text-brand-300">
                          {m.codigo}
                        </div>
                        <div className="text-xs text-ink-500 truncate max-w-[280px]">{m.descripcion}</div>
                      </TD>
                      {bodegas.map((b) => (
                        <TD key={b.id} align="right" className="font-mono tabular-nums text-xs">
                          {m.por_almacen?.[b.id]
                            ? num(m.por_almacen[b.id])
                            : <span className="text-ink-300">—</span>}
                        </TD>
                      ))}
                      <TD align="right" className="font-mono tabular-nums text-sm font-bold">
                        {num(m.total)} <span className="text-xs font-normal text-ink-400">{m.unidad}</span>
                      </TD>
                      <TD align="right">
                        {m.cobertura == null ? (
                          <span className="text-xs text-ink-400 italic">Sin plan</span>
                        ) : (
                          <Badge tone={m.cobertura >= 100 ? 'success' : m.cobertura >= 50 ? 'warning' : 'neutral'}>
                            {num(m.cobertura)}%
                          </Badge>
                        )}
                      </TD>
                      <TD align="right" className="font-mono tabular-nums text-xs">{money(m.valor)}</TD>
                      <TD align="right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Ver kardex del material"
                          onClick={() => navigate(`/inventario/productos/${m.producto_id}/kardex`, {
                            state: { volverA: `/inventario/material-proyecto/${id}`,
                                     volverLabel: 'Volver al proyecto' },
                          })}
                        >
                          <History size={15} />
                        </Button>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </Card>
          )}
        </>
      )}

      {/* Barra de acciones: aparece SOLO con selección. Sin nada seleccionado no
          tiene nada que hacer y solo taparía la última fila de la tabla. */}
      {seleccionados.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-ink-200 dark:border-ink-800 bg-white/95 dark:bg-ink-900/95 backdrop-blur px-4 py-3 shadow-lg">
          <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-semibold text-ink-700 dark:text-ink-200">
              {seleccionados.length} material{seleccionados.length === 1 ? '' : 'es'} seleccionado
              {seleccionados.length === 1 ? '' : 's'}
              <button
                type="button"
                onClick={() => setSel(new Set())}
                className="ml-2 text-xs font-normal text-ink-500 underline hover:text-ink-700"
              >
                limpiar
              </button>
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" leftIcon={<Send size={14} />} onClick={() => setModal('proyecto')}>
                Mover a otro proyecto
              </Button>
              <Button variant="primary" leftIcon={<CornerUpLeft size={14} />} onClick={() => setModal('general')}>
                Devolver a General
              </Button>
            </div>
          </div>
        </div>
      )}

      {proyecto && (
        <>
          <ModalAgregar
            open={modal === 'agregar'}
            onClose={() => setModal(null)}
            proyecto={proyecto}
            almacenes={almacenes ?? []}
            onAplicado={tras}
          />
          <ModalImportar
            open={modal === 'importar'}
            onClose={() => setModal(null)}
            proyecto={proyecto}
            onAplicado={tras}
          />
          <ModalMover
            open={modal === 'general' || modal === 'proyecto'}
            onClose={() => setModal(null)}
            proyecto={proyecto}
            seleccion={seleccionados}
            almacenes={bodegas}
            proyectos={resumen?.tarjetas ?? []}
            destino={modal === 'general' ? 'general' : 'proyecto'}
            onAplicado={tras}
          />
        </>
      )}
    </div>
  )
}
