import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  FolderOpen, Search, ChevronDown, ChevronUp, Users, Clock, Hash, X,
} from 'lucide-react'
import {
  PageHeader, Input, EmptyState, Skeleton, Badge, Button,
} from '../../components/ui'
import { listarMisProyectos } from '../../api/proyectos'
import { useResource } from '../../hooks/useResource'

function ProyectoCard({ proyecto, onOpenHoras }) {
  const [open, setOpen] = useState(false)
  const tieneTrabajadores = proyecto.participantes_count > 0

  return (
    <div className="rounded-xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-card overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-1.5 mb-1 text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/30 px-2 py-0.5 rounded">
              <Hash size={10} />
              {proyecto.numero_proyecto}
            </div>
            <h3 className="text-base font-semibold text-ink-900 dark:text-ink-100 leading-tight truncate">
              {proyecto.nombre || 'Sin nombre'}
            </h3>
          </div>
          <Badge tone={proyecto.activo ? 'success' : 'neutral'} dot>
            {proyecto.activo ? 'Activo' : 'Inactivo'}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500 dark:text-ink-400 mb-3">
          <span className="inline-flex items-center gap-1.5">
            <Users size={12} />
            <span className="font-semibold text-ink-700 dark:text-ink-300 tabular-nums">{proyecto.participantes_count}</span>
            {proyecto.participantes_count === 1 ? 'trabajador' : 'trabajadores'}
          </span>
        </div>

        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Clock size={13} />}
            className="flex-1"
            onClick={() => onOpenHoras(proyecto)}
          >
            Capturar horas
          </Button>
          {tieneTrabajadores && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen((v) => !v)}
              rightIcon={open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            >
              {open ? 'Ocultar' : 'Ver equipo'}
            </Button>
          )}
        </div>
      </div>

      {open && tieneTrabajadores && (
        <div className="border-t border-ink-100 dark:border-ink-800 bg-ink-50/40 dark:bg-ink-900/40 p-3 space-y-1.5">
          {proyecto.participantes.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-white dark:hover:bg-ink-800/60 transition-colors">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white text-xs font-bold inline-flex items-center justify-center flex-shrink-0">
                {(t.nombre || '?').slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ink-900 dark:text-ink-100 truncate">
                  {t.nombre_completo}
                </div>
                <div className="text-[10px] font-mono text-ink-500 dark:text-ink-400">
                  #{t.no_empleado}
                  {t.puesto && <span> · {t.puesto}</span>}
                  {t.tipo_nomina && <span> · {t.tipo_nomina}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function MisProyectos() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')

  const onOpenHoras = () => navigate('/horas')

  // Reusa el namespace 'proyectos' compartido con admin/ProyectosList.jsx.
  // Cuando admin edita un proyecto y emite `proyecto:changed`, esta lista
  // también se invalida (aunque el contenido difiera por filtros de rol).
  const {
    data: rawProyectos,
    loading,
    error,
  } = useResource(
    ['proyectos', 'mios'],
    () => listarMisProyectos(),
    { staleMs: 30_000, invalidateOn: ['proyecto:changed'] },
  )
  const proyectos = rawProyectos ?? []

  useEffect(() => {
    if (error) toast.error(error.response?.data?.error || 'Error al cargar proyectos')
  }, [error])

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return proyectos
    return proyectos.filter((p) =>
      (p.nombre || '').toLowerCase().includes(term) ||
      (p.numero_proyecto || '').toLowerCase().includes(term)
    )
  }, [proyectos, q])

  return (
    <>
      <PageHeader
        icon={FolderOpen}
        title="Mis Proyectos"
        description="Proyectos activos a tu cargo y el equipo asignado a cada uno."
      />

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : proyectos.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Sin proyectos asignados"
          description="No hay proyectos activos donde estés asignado como coordinador. Si esperabas ver alguno, contacta al administrador."
        />
      ) : (
        <>
          <div className="mb-4 max-w-md">
            <Input
              placeholder="Buscar por nombre o número..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              leftIcon={<Search size={15} />}
              rightIcon={q ? (
                <button
                  type="button"
                  onClick={() => setQ('')}
                  className="hover:text-ink-700 pointer-events-auto"
                  aria-label="Limpiar búsqueda"
                >
                  <X size={14} />
                </button>
              ) : null}
            />
            <p className="text-xs text-ink-500 dark:text-ink-400 mt-1">
              {filtrados.length} de {proyectos.length} {proyectos.length === 1 ? 'proyecto' : 'proyectos'}
            </p>
          </div>

          {filtrados.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Sin resultados"
              description={`Ningún proyecto coincide con "${q}".`}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtrados.map((p) => (
                <ProyectoCard key={p.id} proyecto={p} onOpenHoras={onOpenHoras} />
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}
