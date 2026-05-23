import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  HardHat, Search, Droplet, Bug, HeartPulse, Phone, Users,
  FolderOpen, FileText, Eye, ChevronDown, ChevronUp, UsersRound,
} from 'lucide-react'
import {
  PageHeader, Input, EmptyState, Skeleton, Button, ImageViewer,
} from '../../components/ui'
import { obtenerFichaTecnica } from '../../api/trabajadores'
import useIsMobile from '../../hooks/useIsMobile'
import AvatarFoto from '../../components/empleados/AvatarFoto'

function FieldRow({ icon: Icon, color, label, value }) {
  return (
    <p className="flex items-center justify-between text-sm py-1.5">
      <span className="flex items-center gap-2 text-ink-600 dark:text-ink-400 font-medium">
        <Icon size={14} className={`flex-shrink-0 ${color}`} />
        {label}:
      </span>
      <span className="text-ink-900 dark:text-ink-100 text-right">{value || '—'}</span>
    </p>
  )
}

function DocumentosList({ documentos, onPreview }) {
  if (!documentos?.length) {
    return (
      <p className="text-xs italic text-ink-400">Ningún documento subido en el expediente.</p>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      {documentos.map((doc) => (
        <button
          key={doc.id}
          type="button"
          onClick={() => onPreview(doc)}
          title="Ver documento"
          className="flex items-center gap-2 p-2 rounded-md bg-ink-50 dark:bg-ink-900/50 border border-ink-200 dark:border-ink-800 hover:bg-ink-100 dark:hover:bg-ink-800/60 transition-colors text-left text-xs focus-ring"
        >
          <FileText size={13} className="text-red-500 flex-shrink-0" />
          <span className="flex-1 truncate text-ink-700 dark:text-ink-200">
            {doc.nombre_archivo}
          </span>
          <Eye size={12} className="text-ink-400 flex-shrink-0" />
        </button>
      ))}
    </div>
  )
}

function FichaGridCard({ trabajador, onPreview }) {
  return (
    <div className="bg-white dark:bg-ink-900 rounded-xl shadow-card border-t-4 border-brand-500 p-5 transition-transform hover:-translate-y-1 hover:shadow-lg border border-ink-200 dark:border-ink-800">
      <div className="flex items-center gap-3 pb-3 mb-3 border-b border-ink-200 dark:border-ink-800">
        <AvatarFoto
          id={trabajador.id}
          hasFoto={Boolean(trabajador.foto_perfil)}
          name={trabajador.nombre}
          size="lg"
          lazy
        />
        <div className="min-w-0">
          <h3 className="font-semibold text-ink-900 dark:text-ink-100 truncate text-base">
            {trabajador.nombre_completo}
          </h3>
          <p className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">
            Nº Emp: {trabajador.no_empleado || '—'}
          </p>
        </div>
      </div>

      <FieldRow icon={Droplet} color="text-red-500" label="Tipo de Sangre" value={trabajador.tipo_sangre} />
      <FieldRow icon={Bug} color="text-yellow-500" label="Alergias" value={trabajador.alergias} />
      <FieldRow icon={HeartPulse} color="text-pink-500" label="Enf. Crónicas" value={trabajador.enfermedades_cronicas} />

      <hr className="my-3 border-dashed border-ink-200 dark:border-ink-700" />

      <FieldRow icon={Users} color="text-blue-500" label="Contacto Emerg." value={trabajador.contacto_emergencia} />
      <FieldRow icon={UsersRound} color="text-violet-500" label="Parentesco" value={trabajador.parentesco_contacto} />
      <FieldRow
        icon={Phone}
        color="text-emerald-500"
        label="Teléfono"
        value={
          trabajador.numero_contacto_emerg ? (
            <a
              href={`tel:${trabajador.numero_contacto_emerg}`}
              className="text-brand-600 dark:text-brand-300 hover:underline"
            >
              {trabajador.numero_contacto_emerg}
            </a>
          ) : null
        }
      />

      <hr className="my-3 border-dashed border-ink-200 dark:border-ink-700" />

      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400 mb-2">
        <FolderOpen size={13} className="text-amber-500" />
        Documentos ({trabajador.documentos?.length || 0})
      </p>
      <DocumentosList documentos={trabajador.documentos} onPreview={onPreview} />
    </div>
  )
}

function FichaAccordion({ trabajador, onPreview }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mb-3 bg-white dark:bg-ink-900 rounded-xl shadow-card border border-ink-200 dark:border-ink-800 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-ink-50/60 dark:hover:bg-ink-900/40 transition-colors focus-ring"
      >
        <AvatarFoto
          id={trabajador.id}
          hasFoto={Boolean(trabajador.foto_perfil)}
          name={trabajador.nombre}
          size="md"
          lazy
        />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-ink-900 dark:text-ink-100 truncate">
            {trabajador.nombre_completo}
          </div>
          <div className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">
            No. {trabajador.no_empleado || '—'}
          </div>
        </div>
        {open
          ? <ChevronUp size={16} className="text-ink-400 flex-shrink-0" />
          : <ChevronDown size={16} className="text-ink-400 flex-shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-ink-200 dark:border-ink-800 px-4 pb-4 pt-3">
          <FieldRow icon={Droplet} color="text-red-500" label="Tipo de Sangre" value={trabajador.tipo_sangre} />
          <FieldRow icon={Bug} color="text-yellow-500" label="Alergias" value={trabajador.alergias} />
          <FieldRow icon={HeartPulse} color="text-pink-500" label="Enf. Crónicas" value={trabajador.enfermedades_cronicas} />

          <hr className="my-3 border-dashed border-ink-200 dark:border-ink-700" />

          <FieldRow icon={Users} color="text-blue-500" label="Contacto" value={trabajador.contacto_emergencia} />
          <FieldRow icon={UsersRound} color="text-violet-500" label="Parentesco" value={trabajador.parentesco_contacto} />
          <FieldRow
            icon={Phone}
            color="text-emerald-500"
            label="Teléfono"
            value={
              trabajador.numero_contacto_emerg ? (
                <a
                  href={`tel:${trabajador.numero_contacto_emerg}`}
                  className="text-brand-600 dark:text-brand-300 hover:underline"
                >
                  {trabajador.numero_contacto_emerg}
                </a>
              ) : null
            }
          />

          {trabajador.documentos?.length > 0 && (
            <>
              <hr className="my-3 border-dashed border-ink-200 dark:border-ink-700" />
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink-500 dark:text-ink-400 mb-2">
                <FolderOpen size={13} className="text-amber-500" />
                Documentos ({trabajador.documentos.length})
              </p>
              <DocumentosList documentos={trabajador.documentos} onPreview={onPreview} />
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function FichaTecnica() {
  const isMobile = useIsMobile()
  const [loading, setLoading] = useState(true)
  const [trabajadores, setTrabajadores] = useState([])
  const [q, setQ] = useState('')
  const [viewerDoc, setViewerDoc] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    obtenerFichaTecnica()
      .then((res) => { if (!cancelled) setTrabajadores(res.items || []) })
      .catch((err) => {
        if (!cancelled) toast.error(err.response?.data?.error || 'Error cargando fichas')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return trabajadores
    return trabajadores.filter((t) =>
      (t.nombre_completo || '').toLowerCase().includes(term) ||
      (t.no_empleado || '').toLowerCase().includes(term)
    )
  }, [trabajadores, q])

  return (
    <>
      <PageHeader
        icon={HardHat}
        title="Ficha Técnica de Empleados"
        description="Aquí encontrarás la información médica y de contacto de emergencia de los colaboradores asignados a tus proyectos."
      />

      {loading ? (
        <div className={isMobile ? 'space-y-2' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5'}>
          {[...Array(isMobile ? 5 : 6)].map((_, i) => (
            <Skeleton key={i} className={isMobile ? 'h-16 rounded-xl' : 'h-80 rounded-xl'} />
          ))}
        </div>
      ) : trabajadores.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No tienes empleados asignados"
          description="Actualmente no hay empleados activos en los proyectos a tu cargo."
        />
      ) : (
        <>
          <div className="mb-5 max-w-sm">
            <Input
              placeholder="Buscar por nombre o número..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              leftIcon={<Search size={15} />}
            />
            <p className="text-xs text-ink-400 mt-1">
              {filtrados.length} de {trabajadores.length} {trabajadores.length === 1 ? 'trabajador' : 'trabajadores'}
            </p>
          </div>

          {filtrados.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Sin resultados"
              description={`Ningún trabajador coincide con "${q}".`}
            />
          ) : isMobile ? (
            <div>
              {filtrados.map((t) => (
                <FichaAccordion key={t.id} trabajador={t} onPreview={setViewerDoc} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtrados.map((t) => (
                <FichaGridCard key={t.id} trabajador={t} onPreview={setViewerDoc} />
              ))}
            </div>
          )}
        </>
      )}

      <ImageViewer
        open={Boolean(viewerDoc)}
        onClose={() => setViewerDoc(null)}
        authPath={viewerDoc ? `/trabajadores/documentos/${viewerDoc.id}` : null}
        filename={viewerDoc?.nombre_archivo || ''}
        alt={viewerDoc?.nombre_archivo || 'Documento'}
      />
    </>
  )
}
