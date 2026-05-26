import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AlertTriangle, Ban } from 'lucide-react'
import { Card, PageHeader, Badge, EmptyState, Skeleton } from '../../components/ui'
import { getIncidencias, getSolicitudesBaja } from '../../api/herramientas'
import { extractApiError } from '../../utils/apiError'
import { TIPO_INCIDENCIA_LABEL, formatDateTime } from './herramientasShared'

export default function MisIncidencias() {
  const [incs, setIncs] = useState([])
  const [bajas, setBajas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getIncidencias().catch(() => []),
      getSolicitudesBaja().catch(() => []),
    ]).then(([i, b]) => { setIncs(i); setBajas(b) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-6"><Skeleton className="h-32 w-full" /></div>

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <PageHeader title="Mis incidencias y solicitudes de baja"
                   description="Historial de reportes enviados a inventario" />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold flex items-center gap-2 text-ink-700 dark:text-ink-200">
          <AlertTriangle size={16} /> Incidencias
        </h2>
        {incs.length === 0 ? (
          <Card className="p-6"><EmptyState icon={AlertTriangle} title="Sin incidencias reportadas" /></Card>
        ) : (
          <Card className="p-4 space-y-2">
            {incs.map((i) => (
              <div key={i.id} className="p-3 rounded-lg bg-ink-50 dark:bg-ink-800/50 border border-ink-200 dark:border-ink-800">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link to={`/inventario/herramientas/unidades/${i.unidad_id}`}
                          className="text-xs text-brand-300 hover:text-brand-200 font-mono">
                      Unidad #{i.unidad_id}
                    </Link>
                    <span className="ml-2 text-sm font-medium">{TIPO_INCIDENCIA_LABEL[i.tipo] || i.tipo}</span>
                  </div>
                  <Badge tone={i.estado === 'RESUELTA' ? 'success' : i.estado === 'RECHAZADA' ? 'neutral' : 'warning'} dot>{i.estado}</Badge>
                </div>
                <div className="text-sm mt-1">{i.descripcion}</div>
                <div className="text-[11px] opacity-50 mt-1">{formatDateTime(i.fecha_reporte)}</div>
                {i.resolucion && (
                  <div className="text-xs mt-2 italic opacity-80">→ {i.resolucion}</div>
                )}
              </div>
            ))}
          </Card>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold flex items-center gap-2 text-ink-700 dark:text-ink-200">
          <Ban size={16} /> Solicitudes de baja
        </h2>
        {bajas.length === 0 ? (
          <Card className="p-6"><EmptyState icon={Ban} title="Sin solicitudes de baja" /></Card>
        ) : (
          <Card className="p-4 space-y-2">
            {bajas.map((b) => (
              <div key={b.id} className="p-3 rounded-lg bg-ink-50 dark:bg-ink-800/50 border border-ink-200 dark:border-ink-800">
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/inventario/herramientas/unidades/${b.unidad_id}`}
                        className="text-xs text-brand-300 hover:text-brand-200 font-mono">
                    Unidad #{b.unidad_id}
                  </Link>
                  <Badge tone={b.estado === 'EJECUTADA' ? 'neutral' : b.estado === 'PENDIENTE' ? 'warning' : b.estado === 'APROBADA' ? 'info' : 'danger'} dot>
                    {b.estado}
                  </Badge>
                </div>
                <div className="text-sm mt-1">{b.motivo}</div>
                <div className="text-[11px] opacity-50 mt-1">{formatDateTime(b.fecha_solicitud)}</div>
                {b.observaciones && (
                  <div className="text-xs mt-2 italic opacity-80">→ {b.observaciones}</div>
                )}
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  )
}
