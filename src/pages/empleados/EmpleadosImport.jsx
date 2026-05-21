import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X,
  Download, Pencil, UploadCloud,
} from 'lucide-react'
import { PageHeader, Button, Card, CardHeader } from '../../components/ui'
import { importarExcel, descargarPlantillaImportar } from '../../api/trabajadores'

const ALLOWED = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]

function StepCard({ n, title, icon: Icon, children, footer }) {
  return (
    <div className="relative rounded-xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 overflow-hidden shadow-card dark:shadow-none flex flex-col">
      <div className="h-1 bg-brand-500" />
      <div className="p-5 flex flex-col flex-1">
        <div className="h-11 w-11 rounded-lg bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 flex items-center justify-center mb-4">
          <Icon size={20} />
        </div>
        <h3 className="flex items-center gap-2 text-base font-semibold text-ink-900 dark:text-ink-100">
          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-brand-600 text-white text-xs font-bold">{n}</span>
          {title}
        </h3>
        <div className="mt-3 text-sm text-ink-600 dark:text-ink-400 flex-1">{children}</div>
        {footer && <div className="mt-4">{footer}</div>}
      </div>
    </div>
  )
}

export default function EmpleadosImport() {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [result, setResult] = useState(null) // { exitosos, errores }

  const pickFile = (f) => {
    if (!f) return
    const ok = ALLOWED.includes(f.type) || /\.(xlsx|xls)$/i.test(f.name)
    if (!ok) { toast.error('Debe ser un .xlsx o .xls'); return }
    if (f.size > 5 * 1024 * 1024) { toast.error('Máx. 5 MB'); return }
    setFile(f)
    setResult(null)
  }

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false)
    pickFile(e.dataTransfer.files?.[0])
  }

  const onUpload = async () => {
    if (!file) return
    setUploading(true); setResult(null)
    try {
      const res = await importarExcel(file)
      setResult(res)
      if (res.exitosos > 0 && res.errores.length === 0) {
        toast.success(`${res.exitosos} empleado(s) importado(s)`)
      } else if (res.exitosos > 0) {
        toast(`Importados: ${res.exitosos}. Con errores: ${res.errores.length}`, { icon: '⚠️' })
      } else {
        toast.error('No se importó ningún registro')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al importar')
    } finally { setUploading(false) }
  }

  const onDescargarPlantilla = async () => {
    setDownloading(true)
    try {
      await descargarPlantillaImportar()
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo descargar la plantilla')
    } finally { setDownloading(false) }
  }

  return (
    <>
      <PageHeader
        icon={FileSpreadsheet}
        title="Importar empleados desde Excel"
        description="Sube y gestiona la información de tus empleados masivamente."
        breadcrumb={
          <Link to="/empleados" className="hover:underline inline-flex items-center gap-1">
            <ArrowLeft size={12} /> Volver a empleados
          </Link>
        }
      />

      {/* ── Los 3 pasos ─────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">
        <StepCard
          n={1}
          title="Descarga la plantilla"
          icon={FileSpreadsheet}
          footer={
            <Button
              variant="secondary"
              className="w-full"
              leftIcon={<Download size={14} />}
              loading={downloading}
              onClick={onDescargarPlantilla}
            >
              Descargar plantilla Excel
            </Button>
          }
        >
          Obtén el archivo oficial. Está calibrado con el formato que el sistema necesita,
          incluyendo menús desplegables para guiarte.
        </StepCard>

        <StepCard n={2} title="Llena cuidadosamente" icon={Pencil}>
          <p className="mb-3">Abre el archivo y captura los registros siguiendo estrictamente estas reglas:</p>
          <ul className="space-y-1.5 list-disc pl-5 marker:text-brand-500">
            <li><strong>No alteres, elimines o renombres</strong> la primera fila (encabezados).</li>
            <li><strong>"No. de Empleado"</strong> es obligatorio y no puede duplicarse.</li>
            <li>En montos escribe <strong>solo números</strong> (ej. 1500), sin <code>$</code> ni texto.</li>
            <li>Las fechas deben tener formato <code>YYYY-MM-DD</code>.</li>
          </ul>
        </StepCard>

        <StepCard
          n={3}
          title="Sube el archivo final"
          icon={UploadCloud}
          footer={
            <Button
              variant="primary"
              className="w-full"
              leftIcon={<Upload size={14} />}
              loading={uploading}
              disabled={!file}
              onClick={onUpload}
            >
              Procesar e importar
            </Button>
          }
        >
          <p className="mb-3">
            Sube tu archivo <code>.xlsx</code>. Si hay errores en algunas filas,
            <strong> los registros correctos sí se guardarán</strong> y aquí abajo te diremos cuáles
            quedaron pendientes.
          </p>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
              dragging
                ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                : 'border-ink-300 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800/40'
            }`}
          >
            <input
              ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            {file ? (
              <div className="flex items-center justify-center gap-2 text-sm">
                <FileSpreadsheet className="text-emerald-600 dark:text-emerald-400" size={20} />
                <span className="font-medium truncate max-w-[180px]">{file.name}</span>
                <button
                  type="button" className="text-ink-400 hover:text-red-500"
                  onClick={(e) => { e.stopPropagation(); setFile(null); setResult(null); if (inputRef.current) inputRef.current.value = '' }}
                  title="Quitar"
                ><X size={14} /></button>
              </div>
            ) : (
              <div>
                <Upload className="mx-auto text-ink-400" size={22} />
                <p className="mt-2 text-xs font-medium text-ink-700 dark:text-ink-300">
                  Arrastra o haz click
                </p>
                <p className="text-[11px] text-ink-500">.xlsx o .xls, máx 5 MB</p>
              </div>
            )}
          </div>
        </StepCard>
      </div>

      {/* ── Resultados ──────────────────────────────────────────── */}
      {result && (
        <Card className="mt-6">
          <CardHeader title="Resultado de la importación" />
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30 p-4 flex items-center gap-3">
                <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" size={28} />
                <div>
                  <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{result.exitosos}</div>
                  <div className="text-xs text-emerald-700 dark:text-emerald-400">Empleados importados</div>
                </div>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30 p-4 flex items-center gap-3">
                <AlertCircle className="text-red-600 dark:text-red-400" size={28} />
                <div>
                  <div className="text-2xl font-bold text-red-700 dark:text-red-300">{result.errores.length}</div>
                  <div className="text-xs text-red-700 dark:text-red-400">Filas con errores</div>
                </div>
              </div>
            </div>

            {result.errores.length > 0 && (
              <div>
                <p className="text-sm font-medium text-ink-700 dark:text-ink-300 mb-2">Detalle de errores</p>
                <ul className="max-h-72 overflow-y-auto scrollbar-thin rounded-lg border border-ink-200 dark:border-ink-800 divide-y divide-ink-100 dark:divide-ink-800 text-xs">
                  {result.errores.map((e, i) => (
                    <li key={i} className="px-3 py-2 bg-white dark:bg-ink-900 text-red-700 dark:text-red-400">
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.exitosos > 0 && (
              <div className="flex justify-end">
                <Button variant="primary" onClick={() => navigate('/empleados')}>
                  Ir a la lista de empleados
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}
    </>
  )
}
