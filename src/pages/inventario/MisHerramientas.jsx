import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Hammer, AlertTriangle, Ban, ChevronRight, QrCode } from 'lucide-react'
import { Card, PageHeader, Badge, EmptyState, Skeleton, Button } from '../../components/ui'
import { getUnidades, fotoUrl } from '../../api/herramientas'
import { useAuth } from '../../context/AuthContext'
import { extractApiError } from '../../utils/apiError'
import { ESTADO_LABEL, ESTADO_TONE, formatDateTime } from './herramientasShared'

export default function MisHerramientas() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getUnidades()
      .then(setItems)
      .catch((e) => toast.error(extractApiError(e, 'Error')))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="p-6 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
  }

  if (!user?.trabajador_id) {
    return (
      <div className="p-4 sm:p-6 space-y-4">
        <PageHeader title="Mis herramientas" />
        <Card className="p-6">
          <EmptyState
            icon={Hammer}
            title="Tu usuario no está vinculado a un trabajador"
            description="Pide a un administrador que vincule tu usuario a tu registro de trabajador para ver las herramientas asignadas."
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <PageHeader
        title="Mis herramientas"
        description="Equipos asignados a tu nombre"
      />

      {items.length === 0 ? (
        <Card className="p-6">
          <EmptyState icon={Hammer} title="Sin herramientas asignadas"
            description="Actualmente no tienes herramientas a tu cargo." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((u) => (
            <Link key={u.id} to={`/inventario/herramientas/unidades/${u.id}`}
                  className="block">
              <Card className="p-4 h-full hover:bg-ink-50 dark:hover:bg-ink-800/60 transition-colors">
                <div className="flex items-start gap-3">
                  {u.herramienta?.imagen_url ? (
                    <img src={u.herramienta.imagen_url} alt=""
                         className="h-16 w-16 rounded-lg object-cover ring-1 ring-ink-200 dark:ring-ink-700 flex-shrink-0" />
                  ) : (
                    <div className="h-16 w-16 rounded-lg bg-ink-50 dark:bg-ink-800/50 ring-1 ring-ink-200 dark:ring-ink-700 flex items-center justify-center text-ink-400 dark:text-ink-500 flex-shrink-0">
                      <Hammer size={28} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{u.herramienta?.descripcion}</div>
                    <div className="text-xs opacity-60 font-mono">{u.codigo_interno}</div>
                    {u.no_serie && <div className="text-xs opacity-60">Serie: {u.no_serie}</div>}
                    <div className="mt-2">
                      <Badge tone={ESTADO_TONE[u.estado]} dot>{ESTADO_LABEL[u.estado]}</Badge>
                    </div>
                  </div>
                  <ChevronRight size={16} className="opacity-30 flex-shrink-0" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
