import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, Search, HandCoins, Eye, Pencil, FileSpreadsheet } from 'lucide-react'
import {
  PageHeader, Button, Input, Select, Table, THead, TH, THSort, TBody, TR, TD,
  Badge, EmptyState, Pagination, Skeleton, SavedViews, InfoTip,
} from '../../components/ui'
import { listarPrestamos, exportarExcelPrestamos } from '../../api/prestamos'
import { useResource } from '../../hooks/useResource'
import PrestamoFormModal from './PrestamoFormModal'
import PrestamoDetalleModal from './PrestamoDetalleModal'

const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })
const PER_PAGE = 20

function fmt(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return iso }
}

function progresoPorcentaje(total, restante) {
  if (!total || total <= 0) return 0
  return Math.min(100, Math.max(0, Math.round(((total - restante) / total) * 100)))
}

export default function PrestamosList() {
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [qInput, setQInput] = useState('')
  const [estado, setEstado] = useState('')
  const [sort, setSort] = useState('')
  const [dir, setDir] = useState('asc')
  const [formOpen, setFormOpen] = useState(false)
  const [editPrestamo, setEditPrestamo] = useState(null)
  const [detalleId, setDetalleId] = useState(null)

  const {
    data: rawData,
    loading,
    error,
    refetch,
  } = useResource(
    ['prestamos', { page, q, estado, sort, dir }],
    () => listarPrestamos({ page, q, estado, perPage: PER_PAGE, sort, dir }),
    { staleMs: 30_000, invalidateOn: ['prestamo:changed'] },
  )
  const data = rawData ?? { items: [], total: 0, page: 1, pages: 1 }

  useEffect(() => {
    if (error) toast.error(error.response?.data?.error || 'Error al cargar préstamos')
  }, [error])

  const onSearch = (e) => {
    e.preventDefault()
    setPage(1)
    setQ(qInput.trim())
  }

  const onSort = (field, nextDir) => {
    setPage(1)
    if (!nextDir) {
      setSort('')
      setDir('asc')
    } else {
      setSort(field)
      setDir(nextDir)
    }
  }

  const aplicarVista = (params) => {
    setPage(1)
    setQ(params.q || '')
    setQInput(params.q || '')
    setEstado(params.estado || '')
    setSort(params.sort || '')
    setDir(params.dir || 'asc')
  }

  const openNuevo = () => { setEditPrestamo(null); setFormOpen(true) }
  const openEditar = (p) => { setEditPrestamo(p); setFormOpen(true) }
  const reload = () => { refetch() }

  const onExportExcel = async (p) => {
    try {
      const nombre = `Prestamos_${p.trabajador?.no_empleado || p.trabajador_id}.xlsx`
      await exportarExcelPrestamos(p.trabajador_id, nombre)
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo exportar el Excel')
    }
  }

  return (
    <>
      <PageHeader
        icon={HandCoins}
        title={
          <span className="inline-flex items-center gap-1.5">
            Préstamos
            <InfoTip text="Otorga préstamos a trabajadores y registra abonos. El descuento semanal se aplica automáticamente al cerrar la prenómina, hasta liquidar el saldo. El detalle muestra el avance de cada préstamo." />
          </span>
        }
        description="Préstamos otorgados a trabajadores y su descuento programado en nómina."
        actions={
          <Button variant="primary" leftIcon={<Plus size={14} />} onClick={openNuevo}>
            Nuevo préstamo
          </Button>
        }
      />

      <form onSubmit={onSearch} className="mb-4 flex flex-col sm:flex-row gap-2 sm:items-end">
        <Input
          wrapperClassName="flex-1 max-w-md"
          label="Buscar"
          placeholder="Nombre, No. empleado o ID préstamo"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          leftIcon={<Search size={15} />}
        />
        <Select
          wrapperClassName="sm:w-44"
          label="Estado"
          value={estado}
          onChange={(e) => { setEstado(e.target.value); setPage(1) }}
        >
          <option value="">Todos</option>
          <option value="ACTIVO">Activo</option>
          <option value="LIQUIDADO">Liquidado</option>
        </Select>
        <div className="flex gap-2">
          <Button type="submit" variant="primary">Buscar</Button>
          {(q || estado) && (
            <Button type="button" variant="ghost" onClick={() => { setQInput(''); setQ(''); setEstado(''); setPage(1) }}>
              Limpiar
            </Button>
          )}
        </div>
        <div className="sm:ml-auto text-xs text-ink-500 dark:text-ink-400 self-end pb-2">
          Total: <span className="font-semibold text-ink-700 dark:text-ink-200">{data.total}</span>
        </div>
      </form>

      <SavedViews
        listKey="prestamos"
        current={{ q, estado, sort, dir: sort ? dir : '' }}
        defaults={{ q: '', estado: '', sort: '', dir: '' }}
        onApply={aplicarVista}
      />

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title={q || estado ? 'Sin resultados' : 'Sin préstamos'}
          description={q || estado ? 'Ningún préstamo coincide con los filtros.' : 'Comienza dando de alta un préstamo.'}
          action={!q && !estado ? (
            <Button variant="primary" leftIcon={<Plus size={14} />} onClick={openNuevo}>Nuevo préstamo</Button>
          ) : null}
        />
      ) : (
        <>
          <Table>
            <THead>
              <THSort field="trabajador" sort={sort} dir={dir} onSort={onSort}>Trabajador</THSort>
              <THSort field="monto" sort={sort} dir={dir} onSort={onSort} align="right">Monto total</THSort>
              <THSort field="restante" sort={sort} dir={dir} onSort={onSort} align="right">Restante</THSort>
              <TH>Progreso</TH>
              <THSort field="descuento" sort={sort} dir={dir} onSort={onSort} align="right">Desc/sem</THSort>
              <THSort field="inicio" sort={sort} dir={dir} onSort={onSort}>Inicio</THSort>
              <THSort field="estado" sort={sort} dir={dir} onSort={onSort}>Estado</THSort>
              <TH align="right">Acciones</TH>
            </THead>
            <TBody>
              {data.items.map((p) => {
                const pct = progresoPorcentaje(p.monto_total, p.monto_restante)
                return (
                  <TR key={p.id}>
                    <TD>
                      <div className="font-medium text-ink-900 dark:text-ink-100 truncate">{p.trabajador?.nombre_completo}</div>
                      <div className="text-[11px] text-ink-500 font-mono">#{p.trabajador?.no_empleado} · prest. #{p.id}</div>
                    </TD>
                    <TD align="right"><span className="font-mono">{mxn.format(p.monto_total)}</span></TD>
                    <TD align="right">
                      <span className={`font-mono ${p.monto_restante > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                        {mxn.format(p.monto_restante)}
                      </span>
                    </TD>
                    <TD>
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <div className="flex-1 h-1.5 bg-ink-200 dark:bg-ink-700 rounded-full overflow-hidden">
                          <div className={`h-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[11px] text-ink-500 font-mono w-8 text-right">{pct}%</span>
                      </div>
                    </TD>
                    <TD align="right"><span className="font-mono">{mxn.format(p.descuento_semanal)}</span></TD>
                    <TD><span className="text-sm">{fmt(p.fecha_inicio)}</span></TD>
                    <TD>
                      {p.estado === 'ACTIVO'
                        ? <Badge tone="warning" dot>Activo</Badge>
                        : <Badge tone="success" dot>Liquidado</Badge>}
                    </TD>
                    <TD align="right">
                      <div className="inline-flex gap-1">
                        <Button size="icon-sm" variant="ghost" title="Detalle" onClick={() => setDetalleId(p.id)}>
                          <Eye size={14} />
                        </Button>
                        <Button size="icon-sm" variant="ghost" title="Exportar préstamos del trabajador a Excel" onClick={() => onExportExcel(p)}>
                          <FileSpreadsheet size={14} className="text-emerald-600 dark:text-emerald-400" />
                        </Button>
                        {p.estado === 'ACTIVO' && (
                          <Button size="icon-sm" variant="ghost" title="Editar" onClick={() => openEditar(p)}>
                            <Pencil size={14} />
                          </Button>
                        )}
                      </div>
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>

          <Pagination
            page={(data.page || 1) - 1}
            totalPages={data.pages || 1}
            totalElements={data.total}
            size={data.per_page || PER_PAGE}
            onChange={(newZeroPage) => setPage(newZeroPage + 1)}
          />
        </>
      )}

      <PrestamoFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        prestamo={editPrestamo}
        onSaved={reload}
      />

      <PrestamoDetalleModal
        open={detalleId !== null}
        onClose={() => setDetalleId(null)}
        prestamoId={detalleId}
        onChanged={reload}
      />
    </>
  )
}
