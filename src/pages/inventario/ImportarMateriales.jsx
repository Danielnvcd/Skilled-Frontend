import { useEffect, useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { Upload, Download, CheckCircle2, XCircle, FileSpreadsheet, ArrowLeft, Tags } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, Card, PageHeader } from '../../components/ui'
import { descargarPlantillaMateriales, importarMateriales } from '../../api/inventario'
import { invalidate } from '../../utils/resourceCache'

export default function ImportarMateriales() {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [resultado, setResultado] = useState(null)
  const inputRef = useRef(null)

  const handleFile = (f) => {
    if (!f) return
    if (!f.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Solo se aceptan archivos .xlsx o .xls')
      return
    }
    setFile(f)
    setResultado(null)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    handleFile(f)
  }

  const handleSubmit = async () => {
    if (!file) return
    setUploading(true)
    try {
      const res = await importarMateriales(file)
      setResultado(res)
      // El backend ya creó los productos, pero el caché de productos solo se
      // invalida vía socket cuando el Catálogo está montado — y aquí no lo está.
      // Sin esto, al volver al catálogo dentro de la ventana de staleMs (30s) se
      // muestran los productos viejos (la categoría sí aparece porque se refetcha
      // en cada montaje). Invalidamos a mano para forzar el refetch al volver.
      if (res.exitosos > 0 || res.actualizados > 0) {
        invalidate('productos')
        invalidate('movimientos')
      }
      if (res.exitosos > 0) toast.success(`${res.exitosos} productos importados`)
      if (res.actualizados > 0) toast.success(`${res.actualizados} productos actualizados`)
      if (res.categorias_creadas?.length > 0) {
        toast.success(`${res.categorias_creadas.length} categoría(s) nueva(s) creada(s) automáticamente`)
      }
      if (res.errores.length > 0) toast.error(`${res.errores.length} filas con error`)
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al importar el archivo')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        icon={Upload}
        title="Importar Materiales"
        description="Carga masiva de productos al catálogo mediante archivo Excel."
        actions={
          <Link to="/inventario/catalogo">
            <Button variant="secondary" leftIcon={<ArrowLeft size={15} />}>Volver al Catálogo</Button>
          </Link>
        }
      />

      {/* Pasos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Paso 1 */}
        <Card className="p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
            <h3 className="font-semibold text-ink-900 dark:text-ink-100">Descarga la plantilla</h3>
          </div>
          <p className="text-sm text-ink-500 dark:text-ink-400 flex-1">
            Usa el archivo oficial con los campos y formato correctos.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            leftIcon={<Download size={15} />}
            onClick={() => descargarPlantillaMateriales().catch(() => toast.error('Error al descargar plantilla'))}
          >
            Descargar Plantilla
          </Button>
        </Card>

        {/* Paso 2 */}
        <Card className="p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
            <h3 className="font-semibold text-ink-900 dark:text-ink-100">Llena con cuidado</h3>
          </div>
          <ul className="text-sm text-ink-500 dark:text-ink-400 space-y-1 list-disc list-inside flex-1">
            <li>No alteres los encabezados</li>
            <li>SKU único (A-Z 0-9 - _ . /)</li>
            <li>Stock y Precio: solo números &ge; 0</li>
            <li>Precio y URL Imagen son opcionales</li>
            <li>Si el SKU ya existe, se <strong>actualiza</strong> (el stock no se toca)</li>
          </ul>
        </Card>

        {/* Paso 3 */}
        <Card className="p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
            <h3 className="font-semibold text-ink-900 dark:text-ink-100">Sube el archivo</h3>
          </div>
          <p className="text-sm text-ink-500 dark:text-ink-400 flex-1">
            Los productos válidos se guardarán aunque haya filas con errores.
          </p>
        </Card>
      </div>

      {/* Zona de carga */}
      <Card>
        <div className="p-6 space-y-4">
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
              ${file
                ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/20'
                : 'border-ink-200 dark:border-ink-700 hover:border-brand-400 hover:bg-ink-50 dark:hover:bg-ink-800/40'
              }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => handleFile(e.target.files[0])}
            />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileSpreadsheet size={40} className="text-brand-500" />
                <p className="font-semibold text-ink-900 dark:text-ink-100">{file.name}</p>
                <p className="text-sm text-ink-500">{(file.size / 1024).toFixed(1)} KB · Haz clic para cambiar</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-ink-400">
                <Upload size={36} />
                <p className="font-medium text-ink-700 dark:text-ink-300">Arrastra tu archivo Excel aquí</p>
                <p className="text-sm">o haz clic para seleccionarlo</p>
                <p className="text-xs">.xlsx / .xls — Máx. 5 MB</p>
              </div>
            )}
          </div>

          <Button
            className="w-full h-11"
            disabled={!file}
            loading={uploading}
            onClick={handleSubmit}
          >
            Procesar e Importar
          </Button>
        </div>
      </Card>

      {/* Resultado */}
      {resultado && (
        <Card className="p-6 space-y-4">
          <h3 className="font-bold text-ink-900 dark:text-ink-100">Resultado de la importación</h3>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 text-center">
              <CheckCircle2 size={28} className="mx-auto text-emerald-600 mb-1" />
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{resultado.exitosos}</p>
              <p className="text-sm text-emerald-600 dark:text-emerald-400">Nuevos</p>
            </div>
            <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-xl p-4 text-center">
              <CheckCircle2 size={28} className="mx-auto text-sky-600 mb-1" />
              <p className="text-2xl font-bold text-sky-700 dark:text-sky-400">{resultado.actualizados ?? 0}</p>
              <p className="text-sm text-sky-600 dark:text-sky-400">Actualizados</p>
            </div>
            <div className={`border rounded-xl p-4 text-center ${resultado.errores.length > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-ink-50 dark:bg-ink-800 border-ink-200 dark:border-ink-700'}`}>
              <XCircle size={28} className={`mx-auto mb-1 ${resultado.errores.length > 0 ? 'text-red-600' : 'text-ink-400'}`} />
              <p className={`text-2xl font-bold ${resultado.errores.length > 0 ? 'text-red-700 dark:text-red-400' : 'text-ink-500'}`}>{resultado.errores.length}</p>
              <p className={`text-sm ${resultado.errores.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-ink-500'}`}>Filas con error</p>
            </div>
          </div>

          {resultado.categorias_creadas?.length > 0 && (
            <div className="bg-sky-50 dark:bg-sky-900/10 border border-sky-200 dark:border-sky-800 rounded-xl p-4">
              <p className="text-xs font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                <Tags size={14} />
                Categorías nuevas creadas automáticamente:
              </p>
              <div className="flex flex-wrap gap-2">
                {resultado.categorias_creadas.map((c, i) => (
                  <span key={i} className="text-xs px-2 py-1 rounded-full bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                    {c}
                  </span>
                ))}
              </div>
              <p className="text-xs text-sky-600 dark:text-sky-400 mt-2 italic">
                Puedes asignarles una imagen desde el catálogo de categorías.
              </p>
            </div>
          )}

          {resultado.errores.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-4 max-h-48 overflow-y-auto">
              <p className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wide mb-2">Detalle de errores:</p>
              <ul className="space-y-1">
                {resultado.errores.map((e, i) => (
                  <li key={i} className="text-sm text-red-700 dark:text-red-300 flex gap-2">
                    <span className="flex-shrink-0">•</span>
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
