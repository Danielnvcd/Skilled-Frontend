import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  AlertTriangle, History, Filter, RefreshCw, TrendingDown,
  Package, Search, ClipboardList, ShoppingCart,
} from 'lucide-react'
import {
  PageHeader, Button, Card, Select, Skeleton, EmptyState,
  Table, THead, TH, TBody, TR, TD, Badge, Pagination, InfoTip,
} from '../../components/ui'
import {
  getProductosBajoMinimo,
  getProductosConCompraActiva,
} from '../../api/inventario'
import { extractApiError } from '../../utils/apiError'
import { useResource } from '../../hooks/useResource'

// Filas por página. Paginar reduce el nº de nodos en el DOM: con la lista
// completa (cientos/miles de productos), repintar al cambiar de tema y animar el
// sidebar se vuelve lento por el tamaño del DOM, no por React.
const PAGE_SIZE = 50

const URGENCIA_META = {
  critico:  { label: 'Crítico',    tone: 'danger',  rowBg: 'bg-rose-50/60 dark:bg-rose-900/10', icon: '🔥', sub: '< 7 días' },
  alto:     { label: 'Alto',       tone: 'warning', rowBg: 'bg-amber-50/60 dark:bg-amber-900/10', icon: '⚠️', sub: '< 14 días' },
  medio:    { label: 'Medio',      tone: 'info',    rowBg: '', icon: '•', sub: '≥ 14 días' },
  estatico: { label: 'Sin consumo', tone: 'neutral', rowBg: '', icon: '·', sub: 'No se mueve' },
}

export default function BajoMinimo() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [urgenciaFiltro, setUrgenciaFiltro] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [page, setPage] = useState(0)

  const {
    data: rawItems,
    loading,
    error,
    refetch,
  } = useResource(
    ['productos', 'bajo-minimo'],
    () => getProductosBajoMinimo(),
    { staleMs: 60_000, invalidateOn: ['producto:changed', 'movimiento:changed'] },
  )
  const items = rawItems ?? []

  // Productos que ya tienen una solicitud de compra activa (PENDIENTE/ORDENADA).
  const { data: comprasActivas } = useResource(
    ['solicitudes-compra', 'productos-activos'],
    () => getProductosConCompraActiva(),
    { staleMs: 60_000, invalidateOn: ['compra:changed'] },
  )
  const compraPorProducto = useMemo(() => {
    const m = new Map()
    for (const c of (comprasActivas ?? [])) {
      if (!m.has(c.producto_id)) m.set(c.producto_id, c)  // la más reciente (orden desc del backend)
    }
    return m
  }, [comprasActivas])

  useEffect(() => {
    if (error) toast.error(extractApiError(error, 'Error al cargar productos bajo mínimo'))
  }, [error])

  const cargar = () => { refetch() }

  const categorias = useMemo(() => {
    const set = new Set(items.map((i) => i.categoria).filter(Boolean))
    return Array.from(set).sort()
  }, [items])

  const filtrados = useMemo(() => {
    let r = items
    if (urgenciaFiltro) r = r.filter((i) => i.urgencia === urgenciaFiltro)
    if (categoriaFiltro) r = r.filter((i) => i.categoria === categoriaFiltro)
    if (search.trim()) {
      const s = search.toLowerCase()
      r = r.filter((i) =>
        i.codigo?.toLowerCase().includes(s) ||
        i.descripcion?.toLowerCase().includes(s)
      )
    }
    return r
  }, [items, urgenciaFiltro, categoriaFiltro, search])

  const stats = useMemo(() => {
    const acc = { critico: 0, alto: 0, medio: 0, estatico: 0 }
    for (const i of items) acc[i.urgencia] = (acc[i.urgencia] || 0) + 1
    return acc
  }, [items])

  // Paginación en cliente: solo montamos las filas de la página actual.
  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE))
  const pageItems = useMemo(
    () => filtrados.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [filtrados, page],
  )
  // Volver a la página 1 al cambiar filtros o si la página queda fuera de rango.
  useEffect(() => { setPage(0) }, [search, categoriaFiltro, urgenciaFiltro])
  useEffect(() => {
    if (page > 0 && page >= totalPages) setPage(0)
  }, [page, totalPages])

  const toggleSelected = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const toggleAllVisibles = () => {
    setSelected((prev) => {
      const visibles = pageItems.map((p) => p.id)
      const todosSeleccionados = visibles.every((id) => prev.has(id))
      const next = new Set(prev)
      if (todosSeleccionados) {
        visibles.forEach((id) => next.delete(id))
      } else {
        visibles.forEach((id) => next.add(id))
      }
      return next
    })
  }

  const limpiarSeleccion = () => setSelected(new Set())

  const crearSolicitudCompra = () => {
    if (selected.size === 0) {
      toast.error('Selecciona al menos un producto')
      return
    }
    const seedProductos = items
      .filter((p) => selected.has(p.id))
      .map((p) => ({
        producto_id: p.id,
        codigo: p.codigo,
        descripcion: p.descripcion,
        unidad: p.unidad,
        cantidad: p.faltante > 0 ? p.faltante : (p.stock_minimo || 1),
      }))
    navigate('/inventario/solicitudes-compra', { state: { seedProductos } })
  }

  return (
    <div>
      <PageHeader
        icon={AlertTriangle}
        title="Productos bajo mínimo"
        description="Listado de productos en o bajo el umbral de reabastecimiento, ordenados por urgencia."
        actions={
          <Button variant="secondary" leftIcon={<RefreshCw size={14} />} onClick={cargar}>
            Actualizar
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 mb-4">
        <KpiCard label="Crítico (<7d)" value={stats.critico} tone="rose" icon={TrendingDown} active={urgenciaFiltro === 'critico'} onClick={() => setUrgenciaFiltro(urgenciaFiltro === 'critico' ? '' : 'critico')} />
        <KpiCard label="Alto (<14d)"   value={stats.alto}    tone="amber" icon={AlertTriangle} active={urgenciaFiltro === 'alto'}    onClick={() => setUrgenciaFiltro(urgenciaFiltro === 'alto' ? '' : 'alto')} />
        <KpiCard label="Medio"          value={stats.medio}   tone="sky"   icon={Package}       active={urgenciaFiltro === 'medio'}   onClick={() => setUrgenciaFiltro(urgenciaFiltro === 'medio' ? '' : 'medio')} />
        <KpiCard label="Sin consumo"   value={stats.estatico} tone="ink"   icon={Package}      active={urgenciaFiltro === 'estatico'} onClick={() => setUrgenciaFiltro(urgenciaFiltro === 'estatico' ? '' : 'estatico')} />
      </div>

      {/* Filtros */}
      <Card className="p-3 mb-4 flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-500">
          <Filter size={12} /> Filtros
        </div>
        <div className="flex-1 min-w-[200px] max-w-md">
          <label className="block text-[10px] font-bold uppercase text-ink-500 mb-1">Búsqueda</label>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Código o descripción"
              className="w-full pl-8 pr-2 py-1 text-sm rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900"
            />
          </div>
        </div>
        <div className="min-w-[160px]">
          <label className="block text-[10px] font-bold uppercase text-ink-500 mb-1">Categoría</label>
          <Select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)}>
            <option value="">Todas</option>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
        {(search || categoriaFiltro || urgenciaFiltro) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSearch(''); setCategoriaFiltro(''); setUrgenciaFiltro('') }}
          >
            Limpiar
          </Button>
        )}
      </Card>

      {/* Barra de selección — visible cuando hay productos seleccionados */}
      {selected.size > 0 && (
        <Card className="p-3 mb-4 flex flex-wrap items-center justify-between gap-3 ring-2 ring-indigo-500/30 bg-indigo-50/30 dark:bg-indigo-900/10">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-bold text-indigo-700 dark:text-indigo-300">
              {selected.size} producto{selected.size === 1 ? '' : 's'} seleccionado{selected.size === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              onClick={limpiarSeleccion}
              className="text-xs text-ink-500 hover:text-ink-800 dark:hover:text-ink-200 underline"
            >
              limpiar
            </button>
          </div>
          <Button
            variant="primary"
            leftIcon={<ClipboardList size={14} />}
            onClick={crearSolicitudCompra}
          >
            Crear solicitud de compra
          </Button>
        </Card>
      )}

      {loading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Sin productos bajo mínimo"
          description="Todo el inventario está por encima de su nivel de reabastecimiento."
        />
      ) : filtrados.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Sin coincidencias"
          description="Cambia los filtros para ver más resultados."
        />
      ) : (
        <Table>
          <THead>
            <TH className="w-10">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-ink-300 accent-indigo-600 align-middle"
                checked={pageItems.length > 0 && pageItems.every((p) => selected.has(p.id))}
                onChange={toggleAllVisibles}
                aria-label="Seleccionar todos los visibles"
              />
            </TH>
            <TH>
              Urgencia <InfoTip placement="bottom" text="Qué tan pronto se agota según el consumo: Crítico < 7 días, Alto < 14, Medio ≥ 14, Sin consumo = no se ha movido." />
            </TH>
            <TH>Producto</TH>
            <TH align="right">
              Stock <InfoTip placement="bottom" text="Existencia actual y, debajo, el stock mínimo configurado." />
            </TH>
            <TH align="right">
              Faltante <InfoTip placement="bottom" text="Cuánto falta para volver al stock mínimo (mínimo − stock actual)." />
            </TH>
            <TH align="right">
              Consumo/día <InfoTip placement="bottom" text="Promedio de salidas por día en los últimos 30 días." />
            </TH>
            <TH align="right">
              Días <InfoTip placement="bottom" text="Días estimados de stock restante al ritmo de consumo actual. “—” = sin consumo, no se puede estimar." />
            </TH>
            <TH align="center">
              Compra <InfoTip placement="bottom" text="Si el producto ya tiene una solicitud de compra activa: “En compra” = pendiente, “Ordenada” = ya enviada al proveedor." />
            </TH>
            <TH align="right">Acciones</TH>
          </THead>
          <TBody>
            {pageItems.map((p) => (
              <FilaBajoMinimo
                key={p.id}
                p={p}
                checked={selected.has(p.id)}
                compra={compraPorProducto.get(p.id)}
                onToggle={toggleSelected}
              />
            ))}
          </TBody>
        </Table>
      )}

      {!loading && filtrados.length > PAGE_SIZE && (
        <Pagination
          page={page}
          totalPages={totalPages}
          totalElements={filtrados.length}
          size={PAGE_SIZE}
          onChange={setPage}
        />
      )}
    </div>
  )
}

// Fila memoizada: con la lista completa de productos bajo mínimo, sin memo cada
// clic en un checkbox re-renderizaba TODAS las filas (lista grande → lag visible,
// incluido el sidebar). Con React.memo + callback estable, solo se re-renderiza
// la fila cuya selección cambió.
const FilaBajoMinimo = memo(function FilaBajoMinimo({ p, checked, compra, onToggle }) {
  const meta = URGENCIA_META[p.urgencia] || URGENCIA_META.medio
  const dias = p.dias_de_stock_restante
  const diasCls = dias === null ? ''
    : dias < 7 ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
    : dias < 14 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
  return (
    <TR className={checked ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : meta.rowBg}>
      <TD>
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-ink-300 accent-indigo-600 align-middle"
          checked={checked}
          onChange={() => onToggle(p.id)}
          aria-label={`Seleccionar ${p.codigo}`}
        />
      </TD>
      <TD>
        <Badge tone={meta.tone} dot>{meta.label}</Badge>
      </TD>
      <TD>
        <div className="font-medium text-ink-900 dark:text-ink-100 leading-tight">{p.descripcion}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="font-mono text-[11px] text-ink-400">{p.codigo}</span>
          {p.categoria && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-ink-100 dark:bg-ink-800 text-ink-500 dark:text-ink-400">{p.categoria}</span>
          )}
        </div>
      </TD>
      <TD align="right">
        <div className="font-mono font-bold tabular-nums text-ink-900 dark:text-ink-100">
          {p.stock_actual} <span className="text-[10px] font-normal text-ink-400">{p.unidad}</span>
        </div>
        <div className="text-[10px] text-ink-400 tabular-nums">mín {p.stock_minimo}</div>
      </TD>
      <TD align="right">
        <span className="inline-flex font-mono font-bold tabular-nums text-rose-600 dark:text-rose-400">−{p.faltante}</span>
      </TD>
      <TD align="right" className="font-mono tabular-nums text-ink-600 dark:text-ink-300">{p.consumo_promedio_30d}</TD>
      <TD align="right">
        {dias === null ? (
          <span className="text-ink-300 dark:text-ink-600">—</span>
        ) : (
          <span className={`inline-flex items-center justify-center min-w-[44px] px-2 py-0.5 rounded-full text-xs font-bold tabular-nums ${diasCls}`}>
            {dias}d
          </span>
        )}
      </TD>
      <TD align="center">
        {compra ? (
          <Badge tone={compra.estatus === 'ORDENADA' ? 'info' : 'warning'} title={`${compra.folio} · ${compra.estatus}`}>
            {compra.estatus === 'ORDENADA' ? 'Ordenada' : 'En compra'}
          </Badge>
        ) : (
          <span className="text-ink-300 dark:text-ink-600">—</span>
        )}
      </TD>
      <TD align="right">
        <div className="inline-flex items-center gap-1">
          <Link to={`/inventario/productos/${p.id}/kardex`}>
            <Button variant="ghost" size="icon-sm" title="Ver kardex">
              <History size={14} />
            </Button>
          </Link>
          <Button
            variant={checked ? 'secondary' : 'ghost'}
            size="icon-sm"
            title={checked ? 'Quitar de la selección' : 'Agregar a solicitud de compra'}
            onClick={() => onToggle(p.id)}
          >
            <ShoppingCart size={14} className={checked ? 'text-indigo-600' : ''} />
          </Button>
        </div>
      </TD>
    </TR>
  )
})

const KPI_TONES = {
  rose:  { ring: 'ring-rose-500/30',  icon: 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300',     val: 'text-rose-700 dark:text-rose-300' },
  amber: { ring: 'ring-amber-500/30', icon: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300', val: 'text-amber-700 dark:text-amber-300' },
  sky:   { ring: 'ring-sky-500/30',   icon: 'bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-300',         val: 'text-sky-700 dark:text-sky-300' },
  ink:   { ring: 'ring-ink-400/30',   icon: 'bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300',             val: 'text-ink-900 dark:text-ink-100' },
}

function KpiCard({ label, value, tone, icon: Icon, active, onClick }) {
  const t = KPI_TONES[tone] || KPI_TONES.ink
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-xl px-3 py-3 flex items-center gap-3 transition-all hover:shadow-md ${active ? `ring-2 ${t.ring}` : ''}`}
    >
      <span className={`h-9 w-9 rounded-lg inline-flex items-center justify-center ${t.icon}`}>
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500">{label}</div>
        <div className={`text-2xl font-extrabold leading-tight ${t.val}`}>{value}</div>
      </div>
    </button>
  )
}
