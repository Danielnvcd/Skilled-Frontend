import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft, History, RefreshCw, Search, Send, Warehouse,
} from 'lucide-react'
import {
  PageHeader, Button, Card, Input, Skeleton, EmptyState, InfoTip, Pagination,
  Table, THead, TH, TBody, TR, TD,
} from '../../components/ui'
import { getExistenciasGeneral, getResumenAsignacion } from '../../api/inventario'
import { extractApiError } from '../../utils/apiError'
import { useResource } from '../../hooks/useResource'
import ModalAsignarAProyecto from './materialProyecto/ModalAsignarAProyecto'
import { money, num } from './materialProyecto/shared'

/**
 * Stock libre: el material que no está apartado a ninguna obra.
 *
 * Existe porque el flujo real va de General hacia las obras —llega material, se
 * guarda libre, después se reparte— y la sección tenía que soportar esa
 * dirección, no solo la contraria.
 */
export default function MaterialGeneral() {
  const navigate = useNavigate()
  const [busqueda, setBusqueda] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [sel, setSel] = useState(() => new Map())
  const [abierto, setAbierto] = useState(false)
  const [refrescando, setRefrescando] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => { setQ(busqueda.trim()); setPage(0) }, 350)
    return () => clearTimeout(t)
  }, [busqueda])

  const { data, loading, error, refetch } = useResource(
    ['existencias-general', q, page],
    () => getExistenciasGeneral({ q, page: page + 1, perPage: 50 }),
    {
      staleMs: 15_000,
      invalidateOn: ['producto:changed', 'movimiento:changed', 'solicitud:changed'],
    },
  )

  const { data: resumen } = useResource(
    ['resumen-asignacion'],
    () => getResumenAsignacion(),
    { staleMs: 30_000, invalidateOn: ['producto:changed', 'proyecto:changed'] },
  )

  useEffect(() => {
    if (error) toast.error(extractApiError(error, 'Error al cargar el stock libre'))
  }, [error])

  const materiales = useMemo(() => data?.materiales ?? [], [data])
  const bodegas = data?.almacenes ?? []

  // La selección se guarda con el material completo, no solo su id: al cambiar
  // de página o de búsqueda el material deja de estar en `materiales`, y si solo
  // tuviéramos el id no habría con qué armar las líneas del modal.
  const alternar = (m) =>
    setSel((prev) => {
      const s = new Map(prev)
      if (s.has(m.producto_id)) s.delete(m.producto_id)
      else s.set(m.producto_id, m)
      return s
    })

  const todosVisibles = materiales.length > 0 && materiales.every((m) => sel.has(m.producto_id))
  const alternarTodos = () =>
    setSel((prev) => {
      const s = new Map(prev)
      if (todosVisibles) materiales.forEach((m) => s.delete(m.producto_id))
      else materiales.forEach((m) => s.set(m.producto_id, m))
      return s
    })

  const seleccionados = [...sel.values()]

  const refrescar = async () => {
    if (refrescando) return
    setRefrescando(true)
    try { await refetch() } finally { setRefrescando(false) }
  }

  const totalValor = materiales.reduce((a, m) => a + (Number(m.valor) || 0), 0)

  return (
    <div className="pb-24">
      <PageHeader
        icon={Warehouse}
        title="Stock libre (General)"
        description="Material que no está apartado a ninguna obra. Desde aquí se reparte."
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
          </div>
        }
      />

      <Card className="mt-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            type="search"
            leftIcon={<Search size={15} />}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por código o descripción…"
            wrapperClassName="flex-1 min-w-[220px] max-w-md"
          />
          <span className="text-xs text-ink-500 tabular-nums inline-flex items-center gap-1.5">
            {data?.total ?? 0} materiales con existencia libre
            <InfoTip text="Se ordenan por cantidad, de mayor a menor: lo que más sobra es lo primero que conviene repartir." />
          </span>
          {materiales.length > 0 && (
            <span className="text-xs text-ink-400 tabular-nums ml-auto">
              {money(totalValor)} en esta página
            </span>
          )}
        </div>
      </Card>

      {loading ? (
        <Skeleton className="h-96 rounded-xl mt-4" />
      ) : materiales.length === 0 ? (
        <EmptyState
          icon={Warehouse}
          title={q ? 'Sin coincidencias' : 'No hay material libre'}
          description={q
            ? 'Ningún material libre coincide con la búsqueda.'
            : 'Todo el material está apartado a alguna obra, o el inventario está en ceros.'}
          className="mt-4"
        />
      ) : (
        <>
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
                <TH align="right">Total libre</TH>
                <TH align="right">Valor</TH>
                <TH align="right"><span className="sr-only">Kardex</span></TH>
              </THead>
              <TBody>
                {materiales.map((m) => (
                  <TR
                    key={m.producto_id}
                    className={sel.has(m.producto_id) ? 'bg-brand-50/60 dark:bg-brand-900/15' : ''}
                  >
                    <TD>
                      <input
                        type="checkbox"
                        checked={sel.has(m.producto_id)}
                        onChange={() => alternar(m)}
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
                    <TD align="right" className="font-mono tabular-nums text-xs">{money(m.valor)}</TD>
                    <TD align="right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Ver kardex del material"
                        onClick={() => navigate(`/inventario/productos/${m.producto_id}/kardex`, {
                          state: { volverA: '/inventario/material-proyecto/general',
                                   volverLabel: 'Volver a material general' },
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

          {(data?.pages ?? 1) > 1 && (
            <div className="mt-3">
              <Pagination
                page={page}
                totalPages={data.pages}
                totalElements={data.total}
                size={data.per_page}
                onChange={setPage}
              />
            </div>
          )}
        </>
      )}

      {seleccionados.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-ink-200 dark:border-ink-800 bg-white/95 dark:bg-ink-900/95 backdrop-blur px-4 py-3 shadow-lg">
          <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-semibold text-ink-700 dark:text-ink-200">
              {seleccionados.length} material{seleccionados.length === 1 ? '' : 'es'} seleccionado
              {seleccionados.length === 1 ? '' : 's'}
              <button
                type="button"
                onClick={() => setSel(new Map())}
                className="ml-2 text-xs font-normal text-ink-500 underline hover:text-ink-700"
              >
                limpiar
              </button>
            </span>
            <Button variant="primary" leftIcon={<Send size={14} />} onClick={() => setAbierto(true)}>
              Asignar a un proyecto
            </Button>
          </div>
        </div>
      )}

      <ModalAsignarAProyecto
        open={abierto}
        onClose={() => setAbierto(false)}
        seleccion={seleccionados}
        almacenes={bodegas}
        proyectos={resumen?.tarjetas ?? []}
        onAplicado={() => { setSel(new Map()); refetch() }}
      />
    </div>
  )
}
