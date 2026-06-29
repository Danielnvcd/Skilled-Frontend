import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  IdCard, Search, CheckCircle2, Circle,
  Download, QrCode, RotateCw, Eye,
} from 'lucide-react'
import {
  PageHeader, Input, Button, Badge, EmptyState, Skeleton, ConfirmDialog, InfoTip,
} from '../../components/ui'
import {
  listarTrabajadoresQR, generarQR,
} from '../../api/horas'
import CredencialAsistencia from '../../components/empleados/CredencialAsistencia'
import CredencialPreviewModal from '../../components/empleados/CredencialPreviewModal'
import { descargarCredenciales } from '../../utils/descargarCredenciales'
import { useResource } from '../../hooks/useResource'
import { extractApiError } from '../../utils/apiError'

// Empresa por default. Si en el futuro la app guarda configuración de marca
// (logo + razón social), reemplazar por valores del backend.
const EMPRESA = 'SKILLED'
const LOGO_URL = '/logo.png'

// ── Vista compacta de credencial para el grid de selección ──────────────────
function MiniCredencialCard({ trabajador, selected, onToggle, onPreview, onGenerar, onRegenerar, busy }) {
  const sinQr = !trabajador.qr_code
  return (
    <div
      className={`relative rounded-lg ring-1 transition-all bg-white dark:bg-ink-900 ${
        selected
          ? 'ring-brand-500 dark:ring-brand-400 shadow-md'
          : 'ring-ink-200 dark:ring-ink-700 hover:ring-ink-300 dark:hover:ring-ink-600'
      }`}
    >
      {/* Checkbox de selección flotante */}
      {!sinQr && (
        <button
          type="button"
          onClick={() => onToggle(trabajador.id)}
          className="absolute top-2 left-2 z-10 h-6 w-6 rounded-md flex items-center justify-center bg-white dark:bg-ink-900 ring-1 ring-ink-200 dark:ring-ink-700 hover:ring-brand-400 transition-colors focus-ring"
          aria-label={selected ? 'Deseleccionar' : 'Seleccionar'}
        >
          {selected ? (
            <CheckCircle2 size={14} className="text-brand-600 dark:text-brand-400" />
          ) : (
            <Circle size={14} className="text-ink-300 dark:text-ink-600" />
          )}
        </button>
      )}

      {/* Estado QR */}
      <div className="absolute top-2 right-2 z-10">
        {sinQr ? (
          <Badge tone="warning" dot>Sin QR</Badge>
        ) : (
          <Badge tone="success" dot>Con QR</Badge>
        )}
      </div>

      {/* Preview escalada — se muestra a ~75% del tamaño real para que entre en
          el card pero conserve proporciones reales. */}
      <div className="p-4 pt-10 flex justify-center">
        <CredencialAsistencia
          trabajador={trabajador}
          empresa={EMPRESA}
          logoUrl={LOGO_URL}
          side="frente"
          scale={0.75}
        />
      </div>

      {/* Footer con acciones */}
      <div className="border-t border-ink-100 dark:border-ink-800 px-3 py-2 flex gap-1.5">
        {sinQr ? (
          <Button
            size="sm"
            variant="primary"
            className="flex-1"
            leftIcon={<QrCode size={13} />}
            loading={busy === trabajador.id}
            onClick={() => onGenerar(trabajador)}
          >
            Generar QR
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              variant="secondary"
              className="flex-1"
              leftIcon={<Eye size={13} />}
              onClick={() => onPreview(trabajador)}
            >
              Ver
            </Button>
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<RotateCw size={13} />}
              onClick={() => onRegenerar(trabajador)}
              disabled={busy === trabajador.id}
              title="Regenerar QR"
            >
              <span className="sr-only">Regenerar</span>
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Página principal ────────────────────────────────────────────────────────
export default function HorasAdminQR() {
  const [q, setQ] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(null)
  const [preview, setPreview] = useState(null)
  const [selected, setSelected] = useState(() => new Set())
  const [downloading, setDownloading] = useState(false)

  // Caché 30s + revalidación al recuperar foco + push automático. Cuando
  // qr_generar emite `empleado:changed` (action='qr_regenerado') o admin edita
  // un empleado (foto, área, puesto), el hook invalida y refetchea — la grid
  // de credenciales se mantiene fresca sin código extra.
  const {
    data: rawData,
    loading,
    error,
    refetch,
  } = useResource(
    'trabajadores-qr',
    () => listarTrabajadoresQR(),
    {
      staleMs: 30_000,
      invalidateOn: ['empleado:changed'],
    },
  )
  const items = rawData?.items ?? []

  useEffect(() => {
    if (error) toast.error(extractApiError(error, 'Error cargando trabajadores'))
  }, [error])

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return items
    return items.filter((t) =>
      (t.nombre_completo || '').toLowerCase().includes(term) ||
      (t.no_empleado || '').toLowerCase().includes(term) ||
      (t.area || '').toLowerCase().includes(term) ||
      (t.puesto || '').toLowerCase().includes(term)
    )
  }, [items, q])

  const stats = useMemo(() => {
    const total = items.length
    const conQr = items.filter((t) => t.qr_code).length
    return { total, conQr, sinQr: total - conQr }
  }, [items])

  const onGenerar = async (trabajador) => {
    setBusy(trabajador.id)
    try {
      await generarQR(trabajador.id)
      await refetch()
      toast.success('QR generado')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al generar QR')
    } finally {
      setBusy(null)
      setConfirm(null)
    }
  }

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllVisible = () => {
    const ids = filtrados.filter((t) => t.qr_code).map((t) => t.id)
    setSelected(new Set(ids))
  }

  const clearSelection = () => setSelected(new Set())

  const handleDownload = async (trabajadores) => {
    if (!trabajadores?.length) return
    setDownloading(true)
    try {
      await descargarCredenciales(trabajadores, { empresa: EMPRESA, logoUrl: LOGO_URL })
      toast.success(
        trabajadores.length === 1
          ? 'Credenciales descargadas (frente y reverso)'
          : `ZIP descargado (${trabajadores.length} credenciales)`
      )
    } catch (e) {
      toast.error(e?.message || 'Error al generar las imágenes')
    } finally {
      setDownloading(false)
    }
  }

  const downloadSelected = () => {
    const list = items.filter((t) => selected.has(t.id) && t.qr_code)
    handleDownload(list)
  }

  return (
    <>
      <PageHeader
        icon={IdCard}
        title={
          <span className="inline-flex items-center gap-1.5">
            Credenciales de asistencia
            <InfoTip text="Tarjetas con QR para que el trabajador cheque entrada/salida. Genera, previsualiza y descarga en formato CR80. Si una tarjeta se pierde o se compromete, regenera su QR para invalidar la anterior." />
          </span>
        }
        description="Genera, previsualiza y descarga credenciales corporativas formato CR80 (85.6 × 54 mm) como imagen PNG."
      />

      {/* Stats compactas */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatCard label="Trabajadores activos" value={stats.total} />
        <StatCard label="Con QR" value={stats.conQr} tone="success" />
        <StatCard label="Sin QR" value={stats.sinQr} tone={stats.sinQr > 0 ? 'warning' : 'neutral'} />
      </div>

      {/* Barra de acciones */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Buscar por nombre, número, puesto o área..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            leftIcon={<Search size={15} />}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {selected.size > 0 ? (
            <>
              <Badge tone="brand">
                {selected.size} seleccionada{selected.size === 1 ? '' : 's'}
              </Badge>
              <Button
                variant="secondary"
                size="sm"
                onClick={clearSelection}
              >
                Limpiar
              </Button>
              <Button
                size="sm"
                variant="primary"
                leftIcon={<Download size={14} />}
                loading={downloading}
                onClick={downloadSelected}
              >
                Descargar lote ({selected.size})
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<CheckCircle2 size={14} />}
              onClick={selectAllVisible}
              disabled={filtrados.filter((t) => t.qr_code).length === 0}
            >
              Seleccionar visibles
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-72 rounded-lg" />)}
        </div>
      ) : filtrados.length === 0 ? (
        <EmptyState
          icon={IdCard}
          title={q ? 'Sin resultados' : 'Sin trabajadores'}
          description={q ? `Ningún trabajador coincide con "${q}".` : 'No hay trabajadores activos.'}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map((t) => (
            <MiniCredencialCard
              key={t.id}
              trabajador={t}
              selected={selected.has(t.id)}
              busy={busy}
              onToggle={toggleSelect}
              onPreview={setPreview}
              onGenerar={onGenerar}
              onRegenerar={(t) => setConfirm(t)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => onGenerar(confirm)}
        title="¿Regenerar QR?"
        description={`El QR actual de ${confirm?.nombre_completo} quedará inválido y no podrá usarse en el kiosko. ¿Continuar?`}
        confirmLabel="Regenerar"
        cancelLabel="Cancelar"
        tone="warning"
      />

      <CredencialPreviewModal
        open={!!preview}
        trabajador={preview}
        onClose={() => setPreview(null)}
        empresa={EMPRESA}
        logoUrl={LOGO_URL}
      />
    </>
  )
}

function StatCard({ label, value, tone = 'neutral' }) {
  const toneClass = {
    neutral: 'text-ink-900 dark:text-ink-100',
    success: 'text-emerald-700 dark:text-emerald-400',
    warning: 'text-amber-700 dark:text-amber-400',
  }[tone]
  return (
    <div className="rounded-lg ring-1 ring-ink-200 dark:ring-ink-700 bg-white dark:bg-ink-900 px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 dark:text-ink-400">
        {label}
      </p>
      <p className={`text-2xl font-bold tabular-nums mt-1 leading-none ${toneClass}`}>
        {value}
      </p>
    </div>
  )
}
