import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Plus, Search, Pencil, FolderKanban, Folder, Users as UsersIcon,
} from 'lucide-react'
import {
  PageHeader, Button, Input, Select, Table, THead, TH, THSort, TBody, TR, TD,
  Badge, EmptyState, Pagination, Skeleton,
} from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { listarProyectos } from '../../api/proyectos'
import { useResource } from '../../hooks/useResource'
import UserAvatar from '../../components/UserAvatar'
import ProyectoFormModal from './ProyectoFormModal'

const PER_PAGE = 20

function fmtFechaCorta(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return iso }
}

function tiempoRelativo(iso) {
  if (!iso) return null
  const created = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now - created) / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return 'hoy'
  if (diffDays < 30) return `hace ${diffDays} día${diffDays === 1 ? '' : 's'}`
  if (diffDays < 365) return `hace ${Math.floor(diffDays / 30)} mes${Math.floor(diffDays / 30) === 1 ? '' : 'es'}`
  return `hace ${(diffDays / 365).toFixed(1)} año${diffDays >= 730 ? 's' : ''}`
}

export default function ProyectosList() {
  const { isAdmin } = useAuth()
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [qInput, setQInput] = useState('')
  const [estado, setEstado] = useState('todos')
  const [sort, setSort] = useState('')
  const [dir, setDir] = useState('asc')
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState(null)

  const {
    data: rawData,
    loading,
    error,
    refetch,
  } = useResource(
    ['proyectos', { page, q, estado, sort, dir }],
    () => listarProyectos({ page, q, estado, perPage: PER_PAGE, sort, dir }),
    {
      staleMs: 30_000,
      invalidateOn: ['proyecto:changed'],
    },
  )
  const data = rawData ?? { items: [], total: 0, page: 1, pages: 1 }

  useEffect(() => {
    if (error) toast.error(error.response?.data?.error || 'Error al cargar proyectos')
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

  const openNew = () => { setEditId(null); setModalOpen(true) }
  const openEdit = (id) => { setEditId(id); setModalOpen(true) }
  const closeModal = () => setModalOpen(false)
  const onSaved = () => { refetch() }

  return (
    <>
      <PageHeader
        icon={FolderKanban}
        title="Gestión de Proyectos"
        description="Administra los proyectos de la empresa, coordinadores y personal asignado."
        actions={
          isAdmin ? (
            <Button variant="primary" leftIcon={<Plus size={14} />} onClick={openNew}>
              Nuevo Proyecto
            </Button>
          ) : null
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
          wrapperClassName="sm:w-44"
          label="Estado"
          value={estado}
          onChange={(e) => { setEstado(e.target.value); setPage(1) }}
        >
          <option value="todos">Todos</option>
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
        </Select>
        <div className="flex gap-2">
          <Button type="submit" variant="primary">Buscar</Button>
          {(q || estado !== 'todos') && (
            <Button type="button" variant="ghost" onClick={() => { setQInput(''); setQ(''); setEstado('todos'); setPage(1) }}>
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
          icon={FolderKanban}
          title={q || estado !== 'todos' ? 'Sin resultados' : 'Sin proyectos registrados'}
          description={q || estado !== 'todos' ? 'Ningún proyecto coincide con los filtros.' : 'Comienza dando de alta un proyecto.'}
          action={isAdmin && !q && estado === 'todos' ? (
            <Button variant="primary" leftIcon={<Plus size={14} />} onClick={openNew}>Nuevo Proyecto</Button>
          ) : null}
        />
      ) : (
        <>
          <Table>
            <THead>
              <THSort field="numero" sort={sort} dir={dir} onSort={onSort}>No. Proy.</THSort>
              <THSort field="nombre" sort={sort} dir={dir} onSort={onSort}>Proyecto</THSort>
              <THSort field="estado" sort={sort} dir={dir} onSort={onSort}>Estado</THSort>
              <THSort field="coordinador" sort={sort} dir={dir} onSort={onSort}>Coordinador</THSort>
              <THSort field="participantes" sort={sort} dir={dir} onSort={onSort} align="right">Participantes</THSort>
              <THSort field="creado" sort={sort} dir={dir} onSort={onSort}>Creado</THSort>
              {isAdmin && <TH align="right">Acciones</TH>}
            </THead>
            <TBody>
              {data.items.map((p) => {
                const IconCmp = p.activo ? FolderKanban : Folder
                return (
                  <TR key={p.id}>
                    <TD>
                      <span className="inline-block px-2 py-0.5 rounded-md text-xs font-mono font-semibold bg-ink-100 text-ink-700 border border-ink-200 dark:bg-ink-800 dark:text-ink-200 dark:border-ink-700">
                        {p.numero_proyecto}
                      </span>
                    </TD>
                    <TD>
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`flex-shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-lg ${
                          p.activo
                            ? 'bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200'
                            : 'bg-ink-50 text-ink-400 dark:bg-ink-800/50 dark:text-ink-500'
                        }`}>
                          <IconCmp size={15} strokeWidth={1.8} />
                        </span>
                        <div className="font-semibold text-ink-900 dark:text-ink-100 truncate">{p.nombre || '—'}</div>
                      </div>
                    </TD>
                    <TD>
                      {p.activo
                        ? <Badge tone="success" dot>Activo</Badge>
                        : <Badge tone="danger" dot>Inactivo</Badge>}
                    </TD>
                    <TD>
                      {p.coordinador ? (
                        <div className="inline-flex items-center gap-2 min-w-0">
                          <UserAvatar
                            id={p.coordinador.id}
                            profilePic={p.coordinador.profile_pic}
                            name={p.coordinador.full_name || p.coordinador.username}
                            size="sm"
                            lazy
                          />
                          <span className="text-sm text-ink-700 dark:text-ink-200 truncate">
                            {p.coordinador.full_name || p.coordinador.username}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-block text-xs italic text-ink-400 px-2 py-0.5 rounded-full border border-dashed border-ink-300 dark:border-ink-700">
                          Sin asignar
                        </span>
                      )}
                    </TD>
                    <TD align="right">
                      <Badge tone={p.participantes_count > 0 ? 'info' : 'neutral'} leftIcon={<UsersIcon size={11} />}>
                        {p.participantes_count}
                      </Badge>
                    </TD>
                    <TD>
                      {p.created_at ? (
                        <div className="flex flex-col">
                          <span className="text-sm text-ink-700 dark:text-ink-200">{fmtFechaCorta(p.created_at)}</span>
                          <span className="text-xs text-ink-400">{tiempoRelativo(p.created_at)}</span>
                        </div>
                      ) : <span className="text-ink-400">—</span>}
                    </TD>
                    {isAdmin && (
                      <TD align="right">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title="Editar"
                          onClick={() => openEdit(p.id)}
                        >
                          <Pencil size={14} />
                        </Button>
                      </TD>
                    )}
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

      <ProyectoFormModal
        open={modalOpen}
        onClose={closeModal}
        proyectoId={editId}
        onSaved={onSaved}
      />
    </>
  )
}
