import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus, Search, Settings2, ChevronRight, CalendarRange } from 'lucide-react'
import {
  PageHeader, Button, Input, Table, THead, TH, TBody, TR, TD,
  Badge, EmptyState, Pagination, Skeleton,
} from '../../components/ui'
import { listarPeriodos } from '../../api/ajustes'
import { useResource } from '../../hooks/useResource'
import PeriodoCrearModal from './PeriodoCrearModal'

const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })
const PER_PAGE = 20

function fmt(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return iso }
}

export default function AjustesList() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [qInput, setQInput] = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  const {
    data: rawData,
    loading,
    error,
  } = useResource(
    ['ajustes', { page, q }],
    () => listarPeriodos({ page, q, perPage: PER_PAGE }),
    { staleMs: 30_000, invalidateOn: ['ajuste:changed'] },
  )
  const data = rawData ?? { items: [], total: 0, page: 1, pages: 1 }

  useEffect(() => {
    if (error) toast.error(error.response?.data?.error || 'Error al cargar periodos')
  }, [error])

  const onSearch = (e) => {
    e.preventDefault()
    setPage(1)
    setQ(qInput.trim())
  }

  return (
    <>
      <PageHeader
        icon={Settings2}
        title="Ajustes (Inbursa)"
        description="Periodos mensuales que agrupan descuentos de depósitos adelantados por trabajador."
        actions={
          <Button variant="primary" leftIcon={<Plus size={14} />} onClick={() => setModalOpen(true)}>
            Nuevo periodo
          </Button>
        }
      />

      <form onSubmit={onSearch} className="mb-4 flex flex-col sm:flex-row gap-2 sm:items-end">
        <Input
          wrapperClassName="flex-1 max-w-md"
          label="Buscar por nombre"
          placeholder="Ej. Febrero 2026"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          leftIcon={<Search size={15} />}
        />
        <div className="flex gap-2">
          <Button type="submit" variant="primary">Buscar</Button>
          {q && (
            <Button type="button" variant="ghost" onClick={() => { setQInput(''); setQ(''); setPage(1) }}>
              Limpiar
            </Button>
          )}
        </div>
        <div className="sm:ml-auto text-xs text-ink-500 dark:text-ink-400 self-end pb-2">
          Total: <span className="font-semibold text-ink-700 dark:text-ink-200">{data.total}</span>
        </div>
      </form>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title={q ? 'Sin resultados' : 'Sin periodos'}
          description={q ? 'Ningún periodo coincide con la búsqueda.' : 'Crea el primer periodo para empezar a registrar descuentos.'}
          action={!q ? (
            <Button variant="primary" leftIcon={<Plus size={14} />} onClick={() => setModalOpen(true)}>Nuevo periodo</Button>
          ) : null}
        />
      ) : (
        <>
          <Table>
            <THead>
              <TH>Periodo</TH>
              <TH>Rango</TH>
              <TH align="right">Trab.</TH>
              <TH align="right">Meta total</TH>
              <TH align="right">Descontado</TH>
              <TH>Estado</TH>
              <TH align="right">Acciones</TH>
            </THead>
            <TBody>
              {data.items.map((p) => {
                const pct = p.total_meta > 0 ? Math.min(100, Math.round((p.total_descontado / p.total_meta) * 100)) : 0
                return (
                  <TR key={p.id}>
                    <TD>
                      <div className="font-medium text-ink-900 dark:text-ink-100">{p.nombre}</div>
                      <div className="text-[11px] text-ink-500">creado {fmt((p.created_at || '').slice(0, 10))}</div>
                    </TD>
                    <TD>
                      <div className="text-sm">{fmt(p.fecha_inicio)} → {fmt(p.fecha_fin)}</div>
                    </TD>
                    <TD align="right"><span className="font-mono">{p.num_trabajadores}</span></TD>
                    <TD align="right"><span className="font-mono">{mxn.format(p.total_meta)}</span></TD>
                    <TD align="right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-mono text-emerald-700 dark:text-emerald-300">{mxn.format(p.total_descontado)}</span>
                        <span className="text-[10px] text-ink-500">({pct}%)</span>
                      </div>
                    </TD>
                    <TD>
                      {p.estado === 'ABIERTO'
                        ? <Badge tone="warning" dot>Abierto</Badge>
                        : <Badge tone="success" dot>Cerrado</Badge>}
                    </TD>
                    <TD align="right">
                      <Button size="sm" variant="secondary" rightIcon={<ChevronRight size={14} />} onClick={() => navigate(`/ajustes/${p.id}`)}>
                        Detalle
                      </Button>
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

      <PeriodoCrearModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(newId) => { navigate(`/ajustes/${newId}`) }}
      />
    </>
  )
}
