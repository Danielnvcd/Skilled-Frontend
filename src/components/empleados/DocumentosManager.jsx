import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Upload, Download, Trash2, FileText, X } from 'lucide-react'
import { Button, Input, EmptyState, ConfirmDialog } from '../ui'
import {
  subirDocumento, eliminarDocumento, descargarDocumento,
} from '../../api/trabajadores'

// Tipos de documento más comunes (datalist — el usuario puede escribir cualquier otro).
const TIPOS_DOC_SUGERIDOS = [
  'Permiso DC3', 'CURP', 'Acta Nacimiento', 'INE', 'NSS',
  'Comprobante Domicilio', 'Contrato', 'RFC',
]

function fmtFecha(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return iso }
}

export default function DocumentosManager({ trabajadorId, documentos, onChange }) {
  const fileRef = useRef(null)
  const [file, setFile] = useState(null)
  const [tipo, setTipo] = useState('')
  const [fInicio, setFInicio] = useState('')
  const [fFin, setFFin] = useState('')
  const [uploading, setUploading] = useState(false)
  const [confirmDel, setConfirmDel] = useState(null)
  const [deleting, setDeleting] = useState(false)

  if (!trabajadorId) {
    return (
      <div className="rounded-lg border border-dashed border-ink-300 dark:border-ink-700 p-6 text-sm text-ink-500">
        Guarda primero el empleado para poder subir documentos.
      </div>
    )
  }

  const onUpload = async (e) => {
    e.preventDefault()
    if (!file) return
    setUploading(true)
    try {
      const doc = await subirDocumento(trabajadorId, {
        file,
        tipo_documento: tipo,
        fecha_inicio: fInicio,
        fecha_fin: fFin,
      })
      onChange([...documentos, doc])
      toast.success('Documento subido')
      setFile(null)
      setTipo('')
      setFInicio('')
      setFFin('')
      if (fileRef.current) fileRef.current.value = ''
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al subir documento')
    } finally {
      setUploading(false)
    }
  }

  const onDelete = async () => {
    if (!confirmDel) return
    setDeleting(true)
    try {
      await eliminarDocumento(confirmDel.id)
      onChange(documentos.filter((d) => d.id !== confirmDel.id))
      toast.success('Documento eliminado')
      setConfirmDel(null)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al eliminar')
    } finally {
      setDeleting(false)
    }
  }

  const onDownload = async (doc) => {
    try {
      await descargarDocumento(doc.id, doc.nombre_archivo)
    } catch (err) {
      toast.error('No se pudo descargar')
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={onUpload}
        className="rounded-xl border border-ink-200 dark:border-ink-800 p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]"
      >
        <div className="lg:col-span-1">
          <label className="block text-xs font-medium text-ink-700 dark:text-ink-300 mb-1.5 tracking-wide">
            Archivo
          </label>
          <input
            ref={fileRef}
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-ink-700 dark:text-ink-300 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-brand-700 hover:file:bg-brand-100 dark:file:bg-brand-900/30 dark:file:text-brand-200"
          />
        </div>
        <Input
          label="Tipo (opcional)"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          placeholder="Contrato, INE, CURP..."
          maxLength={100}
          list="tipos-doc-sugeridos"
        />
        <datalist id="tipos-doc-sugeridos">
          {TIPOS_DOC_SUGERIDOS.map((t) => <option key={t} value={t} />)}
        </datalist>
        <Input label="Fecha inicio" type="date" value={fInicio} onChange={(e) => setFInicio(e.target.value)} />
        <Input label="Fecha fin" type="date" value={fFin} onChange={(e) => setFFin(e.target.value)} />
        <div className="self-end">
          <Button type="submit" leftIcon={<Upload size={14} />} loading={uploading} disabled={!file}>
            Subir
          </Button>
        </div>
      </form>

      {documentos.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Sin documentos"
          description="Cuando subas archivos aparecerán listados aquí."
        />
      ) : (
        <ul className="divide-y divide-ink-200 dark:divide-ink-800 rounded-xl border border-ink-200 dark:border-ink-800 overflow-hidden bg-white dark:bg-ink-900">
          {documentos.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 flex-shrink-0 rounded-lg bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 flex items-center justify-center">
                  <FileText size={18} />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-ink-900 dark:text-ink-100 truncate">{d.nombre_archivo}</p>
                  <p className="text-xs text-ink-500 dark:text-ink-400">
                    {d.tipo_documento || 'Sin tipo'}
                    {d.fecha_inicio && ` · ${fmtFecha(d.fecha_inicio)}`}
                    {d.fecha_fin && ` → ${fmtFecha(d.fecha_fin)}`}
                    {d.fecha_subida && ` · subido ${fmtFecha(d.fecha_subida)}`}
                  </p>
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button size="icon-sm" variant="ghost" title="Descargar" onClick={() => onDownload(d)}>
                  <Download size={14} />
                </Button>
                <Button size="icon-sm" variant="danger-ghost" title="Eliminar" onClick={() => setConfirmDel(d)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirmDel !== null}
        onClose={() => setConfirmDel(null)}
        onConfirm={onDelete}
        loading={deleting}
        title="Eliminar documento"
        description={`¿Eliminar "${confirmDel?.nombre_archivo}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        tone="danger"
      />
    </div>
  )
}
