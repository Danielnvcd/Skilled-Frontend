import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus, Search, Clock, FileText, ChevronRight } from 'lucide-react'
import {
  PageHeader, Button, Input, Select, Table, THead, TH, TBody, TR, TD,
  Badge, EmptyState, Pagination, Skeleton,
} from '../../components/ui'
import { listarReportes } from '../../api/horas'
import AbrirReporteModal from './AbrirReporteModal'

const PER_PAGE = 20

function estadoTone(estado) {
  switch (estado) {
    case 'BORRADOR': return 'warning'
    case 'TERMINADO': return 'success'
    case 'PRENOMINA_CERRADA': return 'info'
    default: return 'neutral'
  }
}

function estadoLabel(estado) {
  if (estado === 'PRENOMINA_CERRADA') return 'Prenómina cerrada'
  if (estado === 'TERMINADO') return 'Terminado'
  if (estado === 'BORRADOR') return 'Borrador'
  return estado
}

function fmtFecha(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return iso }
}

export default function ReportesList() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [qInput, setQInput] = useState('')
  const [estado, setEstado] = useState('')
  const [data, setData] = useState({ items: [], total: 0, page: 1, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listarReportes({ page, q, estado, perPage: PER_PAGE })
      .then((res) => { if (!cancelled) setData(res) })
      .catch((err) => {
        if (!cancelled) toast.error(err.response?.data?.error || 'Error cargando reportes')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [page, q, estado, reloadKey])

  const onSearch = (e) => {
    e.preventDefault()
    setPage(1)
    setQ(qInput.trim())
  }

  return (
    <>
      <PageHeader
        icon={Clock}
        title="Captura de Horas"
        description="Reportes semanales por proyecto. Abre, captura y cierra para enviar a prenómina."
        actions={
          <Button variant="primary" leftIcon={<Plus size={14} />} onClick={() => setModalOpen(true)}>
            Nuevo reporte
          </Button>
        }
      />

      <form onSubmit={onSearch} className="mb-4 flex flex-col sm:flex-row gap-2 sm:items-end">
        <Input
          wrapperClassName="flex-1 max-w-md"
          label="Buscar"
          placeholder="Nombre o número de proyecto"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          leftIcon={<Search size={15} />}
        />
        <Select
          wrapperClassName="sm:w-52"
          label="Estado"
          value={estado}
          onChange={(e) => { setEstado(e.target.value); setPage(1) }}
        >
          <option value="">Todos</option>
          <option value="BORRADOR">Borrador</option>
          <option value="TERMINADO">Terminado</option>
          <option value="PRENOMINA_CERRADA">Prenómina cerrada</option>
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

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={q || estado ? 'Sin resultados' : 'No hay reportes'}
          description={q || estado ? 'Ningún reporte coincide con los filtros.' : 'Abre el primer reporte para empezar a capturar horas.'}
          action={!q && !estado ? (
            <Button variant="primary" leftIcon={<Plus size={14} />} onClick={() => setModalOpen(true)}>Nuevo reporte</Button>
          ) : null}
        />
      ) : (
        <>
          <Table>
            <THead>
              <TH>Proyecto</TH>
              <TH>Semana</TH>
              <TH>Estado</TH>
              <TH align="right">Registros</TH>
              <TH align="right">Acciones</TH>
            </THead>
            <TBody>
              {data.items.map((r) => (
                <TR key={r.id}>
                  <TD>
                    <div className="min-w-0">
                      <div className="font-semibold text-ink-900 dark:text-ink-100 truncate">
                        {r.proyecto?.nombre || '—'}
                      </div>
                      <div className="text-xs font-mono text-amber-700 dark:text-amber-300 mt-0.5">
                        {r.proyecto?.numero_proyecto}
                      </div>
                    </div>
                  </TD>
                  <TD>
                    <div className="text-sm">
                      {fmtFecha(r.fecha_inicio)} <span className="text-ink-400">→</span> {fmtFecha(r.fecha_fin)}
                    </div>
                  </TD>
                  <TD>
                    <Badge tone={estadoTone(r.estado)} dot>{estadoLabel(r.estado)}</Badge>
                  </TD>
                  <TD align="right">
                    <span className="font-mono text-sm">{r.registros_count}</span>
                  </TD>
                  <TD align="right">
                    <Button
                      size="sm"
                      variant="secondary"
                      rightIcon={<ChevronRight size={14} />}
                      onClick={() => navigate(`/horas/${r.id}`)}
                    >
                      {r.estado === 'BORRADOR' ? 'Capturar' : 'Ver'}
                    </Button>
                  </TD>
                </TR>
              ))}
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

      <AbrirReporteModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(newId) => {
          setReloadKey((k) => k + 1)
          navigate(`/horas/${newId}`)
        }}
      />
    </>
  )
}
