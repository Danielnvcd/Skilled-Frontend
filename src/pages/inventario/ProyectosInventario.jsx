import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  FolderOpen, RefreshCw, Search, ChevronRight, AlertTriangle, PackageCheck,
  Plus, Layers, Wallet, Receipt,
} from 'lucide-react'
import {
  PageHeader, Button, Card, Select, Input, Skeleton, EmptyState, InfoTip,
  Table, THead, TH, TBody, TR, TD, Badge,
} from '../../components/ui'
import { getProyectosMateriales, getProyectosInventario } from '../../api/inventario'
import { extractApiError } from '../../utils/apiError'
import { useResource } from '../../hooks/useResource'

const money = (v) =>
  (Number(v) || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
const num = (v) =>
  (Number(v) || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 })

// Barra de progreso de consumo: verde mientras vas dentro del plan, ámbar cerca
// del 100%, rojo si se pasó del presupuesto.
function ProgresoConsumo({ pct, sobre }) {
  if (pct === null || pct === undefined) {
    return <span className="text-xs text-ink-400 italic">Sin plan</span>
  }
  const clamped = Math.min(pct, 100)
  const tone = sobre || pct > 100 ? 'bg-rose-500' : pct >= 85 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-2 rounded-full bg-ink-100 dark:bg-ink-800 overflow-hidden">
        <div className={`h-full ${tone} transition-all`} style={{ width: `${clamped}%` }} />
      </div>
      <span className={`text-xs font-bold tabular-nums ${sobre || pct > 100 ? 'text-rose-600 dark:text-rose-400' : 'text-ink-600 dark:text-ink-300'}`}>
        {num(pct)}%
      </span>
    </div>
  )
}

const KPI_TONES = {
  ink: 'text-ink-900 dark:text-ink-100',
  brand: 'text-brand-700 dark:text-brand-300',
  emerald: 'text-emerald-700 dark:text-emerald-300',
  rose: 'text-rose-700 dark:text-rose-300',
}
const KPI_ICON_BG = {
  ink: 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300',
  brand: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  rose: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
}

function KpiCard({ icon: Icon, label, value, tone = 'ink', sub }) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className={`shrink-0 rounded-xl p-2.5 ${KPI_ICON_BG[tone]}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500">{label}</div>
        <div className={`text-xl font-extrabold leading-tight truncate ${KPI_TONES[tone]}`}>{value}</div>
        {sub && <div className="text-[11px] text-ink-400 mt-0.5 truncate">{sub}</div>}
      </div>
    </Card>
  )
}

export default function ProyectosInventario() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [nuevoProyectoId, setNuevoProyectoId] = useState('')

  // Todos los proyectos activos: necesario para poder ARRANCAR el plan de uno
  // que aún no tiene plan ni consumo (esos no salen en la lista de abajo).
  const { data: rawTodos } = useResource(
    ['proyectos-inventario'],
    () => getProyectosInventario(),
    { staleMs: 120_000, invalidateOn: ['proyecto:changed'] },
  )
  const todosProyectos = rawTodos ?? []

  const { data: rawItems, loading, error, refetch } = useResource(
    ['proyectos-materiales'],
    () => getProyectosMateriales(),
    {
      staleMs: 60_000,
      // Se refresca al editar el plan, al cambiar una solicitud (entrega) o un
      // movimiento de stock, y al tocar proyectos.
      invalidateOn: [
        'proyecto_material:changed', 'solicitud:changed',
        'movimiento:changed', 'proyecto:changed',
      ],
    },
  )
  const items = rawItems ?? []

  useEffect(() => {
    if (error) toast.error(extractApiError(error, 'Error al cargar proyectos'))
  }, [error])

  const resumen = useMemo(() => ({
    total: items.length,
    costoPlan: items.reduce((a, p) => a + (Number(p.costo_planeado) || 0), 0),
    costoCons: items.reduce((a, p) => a + (Number(p.costo_consumido) || 0), 0),
    sobre: items.filter((p) => p.sobre_presupuesto).length,
  }), [items])

  const filtrados = useMemo(() => {
    if (!search.trim()) return items
    const s = search.toLowerCase()
    return items.filter((p) =>
      p.numero_proyecto?.toLowerCase().includes(s) ||
      p.nombre?.toLowerCase().includes(s)
    )
  }, [items, search])

  return (
    <div>
      <PageHeader
        icon={FolderOpen}
        title="Proyectos — materiales"
        description="Plan de materiales por proyecto, consumo real (vía solicitudes entregadas) y costos."
        actions={
          <Button variant="secondary" leftIcon={<RefreshCw size={14} />} onClick={() => refetch()}>
            Actualizar
          </Button>
        }
      />

      {/* Acción principal: crear / abrir el plan de cualquier proyecto activo
          (aunque aún no aparezca en la tabla por no tener plan ni consumo). */}
      <Card className="mt-4 p-4 ring-1 ring-brand-500/20 bg-gradient-to-br from-brand-50/50 to-transparent dark:from-brand-900/10">
        <div className="flex items-start gap-2.5">
          <div className="shrink-0 rounded-lg bg-brand-100 dark:bg-brand-900/40 p-2 text-brand-700 dark:text-brand-300">
            <Plus size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink-800 dark:text-ink-100 flex items-center gap-1.5">
              Crear o abrir el plan de un proyecto
              <InfoTip text="Aquí salen todos los proyectos activos, aunque todavía no tengan plan. Elige uno y toca “Abrir plan” para capturar sus materiales por primera vez." />
            </h3>
            <p className="text-xs text-ink-500">Elige un proyecto activo para capturar o continuar su plan de materiales.</p>
          </div>
        </div>
        <div className="mt-3 flex flex-col sm:flex-row sm:items-end gap-3">
          <Select
            label="Proyecto"
            wrapperClassName="flex-1 min-w-[220px] max-w-xl"
            value={nuevoProyectoId}
            onChange={(e) => setNuevoProyectoId(e.target.value)}
          >
            <option value="">Selecciona un proyecto…</option>
            {todosProyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {`${p.numero_proyecto} — ${p.nombre || ''}`.trim()}
              </option>
            ))}
          </Select>
          <Button
            variant="primary"
            className="w-full sm:w-auto"
            rightIcon={<ChevronRight size={15} />}
            disabled={!nuevoProyectoId}
            onClick={() => navigate(`/inventario/proyectos/${nuevoProyectoId}`)}
          >
            Abrir plan
          </Button>
        </div>
      </Card>

      {/* Resumen ejecutivo */}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          <KpiCard icon={Layers} label="Proyectos con materiales" value={resumen.total} tone="brand" />
          <KpiCard icon={Wallet} label="Costo planeado" value={money(resumen.costoPlan)} />
          <KpiCard icon={Receipt} label="Costo consumido" value={money(resumen.costoCons)} tone="emerald" />
          <KpiCard
            icon={AlertTriangle}
            label="Sobre presupuesto"
            value={resumen.sobre}
            tone={resumen.sobre > 0 ? 'rose' : 'ink'}
            sub={resumen.sobre > 0 ? 'proyectos excedidos' : 'todo dentro del plan'}
          />
        </div>
      )}

      {/* Toolbar de búsqueda */}
      <div className="flex flex-wrap items-center gap-3 mt-4 mb-3">
        <Input
          type="search"
          leftIcon={<Search size={15} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por número o nombre de proyecto…"
          wrapperClassName="flex-1 min-w-[220px] max-w-md"
        />
        {!loading && items.length > 0 && (
          <span className="text-xs text-ink-500 tabular-nums">
            {filtrados.length === items.length
              ? `${items.length} proyecto${items.length === 1 ? '' : 's'}`
              : `${filtrados.length} de ${items.length}`}
          </span>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={PackageCheck}
          title="Sin proyectos con materiales"
          description="Aún no hay proyectos con plan de materiales ni consumo registrado. Usa el selector de arriba para capturar el plan de un proyecto."
        />
      ) : filtrados.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Sin coincidencias"
          description="Cambia la búsqueda para ver más resultados."
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <THead>
              <TH>Proyecto</TH>
              <TH align="right">Líneas</TH>
              <TH align="right">Planeado</TH>
              <TH align="right">Consumido</TH>
              <TH>
                <span className="inline-flex items-center gap-1">
                  Avance
                  <InfoTip text="% de lo consumido sobre lo planeado. Verde dentro del plan, ámbar cerca del 100% y rojo si se pasó del presupuesto." />
                </span>
              </TH>
              <TH align="right">Costo planeado</TH>
              <TH align="right">Costo consumido</TH>
              <TH align="right"><span className="sr-only">Ver</span></TH>
            </THead>
            <TBody>
              {filtrados.map((p) => (
                <TR
                  key={p.id}
                  className="cursor-pointer hover:bg-ink-50/60 dark:hover:bg-ink-800/40"
                  onClick={() => navigate(`/inventario/proyectos/${p.id}`)}
                >
                  <TD>
                    <div className="font-bold font-mono text-sm text-brand-700 dark:text-brand-300">{p.numero_proyecto}</div>
                    <div className="text-xs text-ink-500 truncate max-w-[240px]">{p.nombre || '—'}</div>
                  </TD>
                  <TD align="right" className="tabular-nums text-ink-500">{p.lineas_plan}</TD>
                  <TD align="right" className="font-mono tabular-nums">{num(p.cantidad_planeada)}</TD>
                  <TD align="right" className="font-mono tabular-nums font-bold">{num(p.cantidad_consumida)}</TD>
                  <TD>
                    <ProgresoConsumo pct={p.porcentaje_consumido} sobre={p.sobre_presupuesto} />
                  </TD>
                  <TD align="right" className="font-mono tabular-nums">{money(p.costo_planeado)}</TD>
                  <TD align="right" className="font-mono tabular-nums font-bold">
                    <div className="flex items-center justify-end gap-2">
                      <span>{money(p.costo_consumido)}</span>
                      {p.sobre_presupuesto && <Badge tone="danger" dot>Excedido</Badge>}
                    </div>
                  </TD>
                  <TD align="right">
                    <Link to={`/inventario/proyectos/${p.id}`} onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon-sm" title="Ver detalle">
                        <ChevronRight size={16} />
                      </Button>
                    </Link>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
