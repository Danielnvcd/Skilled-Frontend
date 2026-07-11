import { useEffect, useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { Upload, Download, CheckCircle2, XCircle, FileSpreadsheet, ArrowLeft, Tags, FileDown, MinusCircle, ListChecks, Plus, FolderInput, Cloud, RefreshCw, Info } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, Card, PageHeader, Modal, Select, InfoTip } from '../../components/ui'
import { descargarPlantillaMateriales, exportarProductos, importarMateriales, getEstadoImagenes, sincronizarImagenes } from '../../api/inventario'
import { invalidate } from '../../utils/resourceCache'
import { useSocket } from '../../context/SocketContext'

export default function ImportarMateriales() {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [resultado, setResultado] = useState(null)
  // Confirmación de categorías nuevas parecidas a existentes.
  const [confirmCats, setConfirmCats] = useState(null)   // { categorias_ambiguas, categorias_existentes }
  const [catChoices, setCatChoices] = useState({})       // { nombreEnArchivo: existente | '' (crear nueva) }
  const inputRef = useRef(null)

  // ── Pipeline de imágenes → Cloudflare R2 (WebP) ──────────────────────────
  // Solo se muestra si el backend reporta R2 activo (enabled). En local sin R2
  // configurado, `enabled` es false y toda esta UI queda oculta.
  const { on } = useSocket()
  const [imgEstado, setImgEstado] = useState(null)      // { enabled, ok, pendientes, error, ... }
  const [imgProgress, setImgProgress] = useState(null)  // { total, hechas, ok, error, estado, actual }
  const [syncing, setSyncing] = useState(false)
  // Job que lanzó ESTA página. La barra solo sigue este job_id, así no parpadea
  // si corren varios trabajos a la vez para el mismo usuario. En ref (no estado)
  // para que el listener lea siempre el valor actual sin re-suscribirse.
  const jobIdRef = useRef(null)

  const cargarEstadoImagenes = () => {
    getEstadoImagenes().then(setImgEstado).catch(() => setImgEstado(null))
  }
  useEffect(() => { cargarEstadoImagenes() }, [])

  // Progreso en vivo del pipeline (lo emite el backend al usuario que lo lanzó).
  // Solo mostramos el job que lanzamos desde aquí (jobIdRef); ignoramos eventos
  // de otros trabajos del mismo usuario para que la barra no salte entre ellos.
  useEffect(() => {
    const off = on('producto:imagen_progreso', (p) => {
      if (!jobIdRef.current || p?.job_id !== jobIdRef.current) return
      setImgProgress(p)
      if (p?.estado === 'done') {
        jobIdRef.current = null        // el job terminó: dejamos de seguirlo
        invalidate('productos')        // el catálogo mostrará las imágenes de R2
        cargarEstadoImagenes()         // refresca los conteos
      }
    })
    return off
  }, [on])

  const handleSyncImagenes = async () => {
    setSyncing(true)
    try {
      const res = await sincronizarImagenes()
      if (res.encolados > 0) {
        jobIdRef.current = res.job_id || null
        setImgProgress({ total: res.encolados, hechas: 0, ok: 0, error: 0, estado: 'running', actual: null })
        toast.success(`Sincronizando ${res.encolados} imagen(es) a R2…`)
        if (res.restantes > 0) {
          toast(`Quedan ${res.restantes} para la próxima corrida (vuelve a sincronizar al terminar).`, { icon: 'ℹ️', duration: 6000 })
        }
      } else {
        toast.success('Todas las imágenes ya están en R2')
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo iniciar la sincronización')
    } finally {
      setSyncing(false)
    }
  }

  const imgPct = imgProgress?.total ? Math.round((imgProgress.hechas / imgProgress.total) * 100) : 0

  const handleExport = async () => {
    setExporting(true)
    try {
      await exportarProductos()
      toast.success('Catálogo exportado. Edítalo en Excel y súbelo aquí para aplicar los cambios.', { duration: 6000 })
    } catch {
      toast.error('No se pudo exportar el catálogo')
    } finally {
      setExporting(false)
    }
  }

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

  // Procesa el resultado final de la importación (toasts + invalidación de caché).
  const aplicarResultado = (res) => {
    setResultado(res)
    // El backend ya creó los productos, pero el caché de productos solo se
    // invalida vía socket cuando el Catálogo está montado — y aquí no lo está.
    // Invalidamos a mano para forzar el refetch al volver.
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
    // Si la importación dejó imágenes externas por subir a R2, arranca la barra.
    if (res.imagenes?.pendientes > 0) {
      jobIdRef.current = res.imagenes.job_id || null
      setImgProgress({ total: res.imagenes.pendientes, hechas: 0, ok: 0, error: 0, estado: 'running', actual: null })
    }
  }

  const handleSubmit = async () => {
    if (!file) return
    setUploading(true)
    try {
      const res = await importarMateriales(file)
      if (res.necesita_confirmacion) {
        // Preseleccionar la sugerencia (agregar a la categoría existente parecida).
        const choices = {}
        res.categorias_ambiguas.forEach((a) => { choices[a.nombre] = a.sugerencia })
        setCatChoices(choices)
        setConfirmCats(res)
        return
      }
      aplicarResultado(res)
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al importar el archivo')
    } finally {
      setUploading(false)
    }
  }

  // Reintenta la importación con la decisión del usuario sobre cada categoría.
  const handleConfirmCategorias = async () => {
    if (!file || !confirmCats) return
    setUploading(true)
    try {
      // Incluir TODAS las ambiguas (valor '' = crear nueva) para que el backend
      // no vuelva a preguntar.
      const mapeo = { ...catChoices }
      const res = await importarMateriales(file, mapeo)
      setConfirmCats(null)
      aplicarResultado(res)
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al importar el archivo')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
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

      {/* Explicación rápida del flujo completo */}
      <Card className="p-4 bg-brand-50/60 dark:bg-brand-900/10 border-brand-200 dark:border-brand-800">
        <div className="flex items-start gap-3">
          <Info size={18} className="text-brand-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-ink-700 dark:text-ink-200 space-y-1">
            <p className="font-semibold text-ink-900 dark:text-ink-100">¿Cómo funciona la importación?</p>
            <p>
              <strong>1)</strong> Descarga el archivo Excel · <strong>2)</strong> llénalo con tus materiales ·
              <strong> 3)</strong> súbelo aquí. Los productos <strong>nuevos</strong> se crean y los que
              <strong> ya existen</strong> (mismo código/SKU) se <strong>actualizan solo en lo que cambiaste</strong>.
            </p>
            <p className="text-xs text-ink-500 dark:text-ink-400">
              El <strong>stock actual no se modifica</strong> al importar productos existentes — para mover
              existencias usa <strong>Movimientos</strong>. Las filas con error se omiten una por una; las demás sí se guardan.
            </p>
          </div>
        </div>
      </Card>

      {/* Pasos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Paso 1 */}
        <Card className="p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
            <h3 className="font-semibold text-ink-900 dark:text-ink-100">Descarga el archivo</h3>
            <InfoTip text="«Plantilla vacía» = para dar de alta productos nuevos. «Exportar catálogo actual» = baja todo lo que ya existe, lo editas en Excel y lo vuelves a subir." />
          </div>
          <div className="text-sm text-ink-500 dark:text-ink-400 flex-1 space-y-2">
            <p>
              <strong className="text-ink-700 dark:text-ink-200">Plantilla vacía</strong>: para dar de alta productos nuevos desde cero.
              <InfoTip text="Un Excel en blanco, solo con los encabezados y sus notas de ayuda en cada columna." />
            </p>
            <p>
              <strong className="text-ink-700 dark:text-ink-200">Exportar catálogo actual</strong>: baja TODOS tus productos ya llenos (agrupados por categoría) para editarlos y reimportar.
              <InfoTip text="Ideal para actualizar en masa precios, descripciones, mínimos o imágenes de productos que YA existen. Editas las celdas, guardas y subes el mismo archivo en «Procesar e Importar»: el sistema aplica SOLO lo que cambiaste (las filas iguales se ignoran) y el stock actual no se toca. No borres la columna del código (SKU) ni las filas grises de categoría." />
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            leftIcon={<Download size={15} />}
            onClick={() => descargarPlantillaMateriales().catch(() => toast.error('Error al descargar plantilla'))}
          >
            Plantilla vacía
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            loading={exporting}
            leftIcon={<FileDown size={15} />}
            onClick={handleExport}
          >
            Exportar catálogo actual
          </Button>
        </Card>

        {/* Paso 2 */}
        <Card className="p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
            <h3 className="font-semibold text-ink-900 dark:text-ink-100">Llena con cuidado</h3>
            <InfoTip text="La plantilla ya trae una nota de ayuda en cada columna: en Excel, pasa el mouse por el encabezado (esquina roja) para verla." />
          </div>
          <ul className="text-sm text-ink-500 dark:text-ink-400 space-y-1.5 list-disc list-inside flex-1">
            <li>No alteres los encabezados de las columnas</li>
            <li>
              SKU único (A-Z 0-9 - _ . /)
              <InfoTip text="El SKU/código identifica al producto. Si subes uno que ya existe, se ACTUALIZA en vez de duplicarse." />
            </li>
            <li>Stock y Precio: solo números &ge; 0</li>
            <li>Precio y URL Imagen son opcionales (puedes dejarlos vacíos)</li>
            <li>
              Cable: llena <strong>Tipo</strong> y <strong>Tamaño mm²/AWG</strong>
              <InfoTip text="Solo si la categoría contiene la palabra «cable». La unidad se pone en metros (M) sola. En otras categorías, deja esas columnas vacías." />
            </li>
            <li>
              Si el SKU ya existe, se <strong>actualiza solo lo que cambiaste</strong>
              <InfoTip text="El stock actual NO se toca al reimportar (para eso usa Movimientos). Solo cambian descripción, categoría, precio, mínimo, imagen, etc." />
            </li>
          </ul>
        </Card>

        {/* Paso 3 */}
        <Card className="p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
            <h3 className="font-semibold text-ink-900 dark:text-ink-100">Sube el archivo</h3>
            <InfoTip text="Puedes arrastrar el Excel a la zona de abajo o hacer clic para elegirlo. Máximo 5 MB, formato .xlsx o .xls." />
          </div>
          <p className="text-sm text-ink-500 dark:text-ink-400 flex-1">
            Los productos válidos se guardarán aunque haya filas con errores. Al terminar verás un resumen
            con cuántos se crearon, actualizaron y cuáles tuvieron problemas.
          </p>
        </Card>
      </div>

      {/* Imágenes en la nube (Cloudflare R2) — solo si el backend lo reporta activo */}
      {imgEstado?.enabled && (
        <Card className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-2.5">
              <Cloud size={20} className="text-brand-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-ink-900 dark:text-ink-100 flex items-center gap-1.5">
                  Imágenes en la nube (Cloudflare R2)
                  <InfoTip text="Cuando pones el enlace (URL) de una foto en el Excel o al editar un producto, el sistema la descarga, la optimiza y la guarda en la nube. Así carga rápido y no depende de la página original." />
                </h3>
                <p className="text-xs text-ink-500 dark:text-ink-400">
                  Las imágenes con URL externa se convierten a WebP y se suben a R2 automáticamente al importar o editar.
                  {imgEstado && (
                    <> {' '}<span className="font-semibold text-emerald-600 dark:text-emerald-400">{imgEstado.ok} en R2</span>
                    {(imgEstado.pendientes + imgEstado.error) > 0 && (
                      <> · <span className="font-semibold text-amber-600 dark:text-amber-400">{imgEstado.pendientes + imgEstado.error} por subir</span></>
                    )}</>
                  )}
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />}
              loading={syncing}
              onClick={handleSyncImagenes}
              disabled={imgProgress?.estado === 'running'}
            >
              Sincronizar imágenes
            </Button>
          </div>

          {imgProgress && (
            <div className="space-y-1.5">
              <div className="h-2 w-full rounded-full bg-ink-100 dark:bg-ink-800 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${imgProgress.estado === 'done' ? 'bg-emerald-500' : 'bg-brand-600'}`}
                  style={{ width: `${imgPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-ink-500 dark:text-ink-400">
                <span className="truncate">
                  {imgProgress.estado === 'done'
                    ? `Listo · ${imgProgress.ok} subida(s)${imgProgress.error ? `, ${imgProgress.error} con error` : ''}`
                    : `Procesando ${imgProgress.hechas}/${imgProgress.total}${imgProgress.actual ? ` · ${imgProgress.actual}` : ''}`}
                </span>
                <span className="tabular-nums flex-shrink-0 ml-2">{imgPct}%</span>
              </div>
            </div>
          )}
        </Card>
      )}

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

      {/* Confirmación de categorías nuevas parecidas a existentes */}
      <Modal
        open={!!confirmCats}
        onClose={() => setConfirmCats(null)}
        title="Categorías nuevas detectadas"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmCats(null)} disabled={uploading}>Cancelar</Button>
            <Button onClick={handleConfirmCategorias} loading={uploading}>Continuar importación</Button>
          </>
        }
      >
        {confirmCats && (
          <div className="space-y-4">
            <p className="text-sm text-ink-600 dark:text-ink-300">
              Estas categorías del archivo se parecen a categorías que <strong>ya existen</strong>.
              Elige si crear una categoría nueva o agregar esos productos a una existente
              (así evitas duplicados como “Cable” y “Cable azul”).
            </p>
            <div className="space-y-3">
              {confirmCats.categorias_ambiguas.map((a) => {
                const esNueva = !catChoices[a.nombre]  // '' o undefined → crear nueva
                return (
                <div key={a.nombre} className="rounded-lg border border-ink-200 dark:border-ink-800 p-3">
                  <p className="text-sm font-semibold text-ink-900 dark:text-ink-100 break-words">“{a.nombre}”</p>
                  <p className="text-[11px] text-ink-500 dark:text-ink-400 mb-2">
                    {a.productos} producto{a.productos === 1 ? '' : 's'} · se parece a <strong>“{a.sugerencia}”</strong>
                  </p>
                  <div className="inline-flex rounded-md border border-ink-200 dark:border-ink-700 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setCatChoices((s) => ({ ...s, [a.nombre]: '' }))}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${
                        esNueva ? 'bg-brand-700 text-white' : 'bg-white dark:bg-ink-900 text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800'
                      }`}
                    >
                      <Plus size={13} strokeWidth={2} /> Crear nueva
                    </button>
                    <button
                      type="button"
                      onClick={() => setCatChoices((s) => ({ ...s, [a.nombre]: s[a.nombre] || a.sugerencia }))}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border-l border-ink-200 dark:border-ink-700 transition-colors ${
                        !esNueva ? 'bg-brand-700 text-white' : 'bg-white dark:bg-ink-900 text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800'
                      }`}
                    >
                      <FolderInput size={13} strokeWidth={2} /> Agregar a existente
                    </button>
                  </div>
                  {esNueva ? (
                    <p className="text-[11px] text-ink-500 dark:text-ink-400 mt-2">
                      Se creará la categoría <strong>«{a.nombre}»</strong>.
                    </p>
                  ) : (
                    <Select
                      wrapperClassName="mt-2"
                      value={catChoices[a.nombre] || a.sugerencia}
                      onChange={(e) => setCatChoices((s) => ({ ...s, [a.nombre]: e.target.value }))}
                    >
                      {confirmCats.categorias_existentes.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </Select>
                  )}
                </div>
                )
              })}
            </div>
          </div>
        )}
      </Modal>

      {/* Resultado — aparece como modal al terminar la importación */}
      <Modal
        open={!!resultado}
        onClose={() => setResultado(null)}
        title="Resultado de la importación"
        size="lg"
        footer={<Button onClick={() => setResultado(null)}>Cerrar</Button>}
      >
        {resultado && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 text-center">
              <CheckCircle2 size={28} className="mx-auto text-emerald-600 mb-1" />
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{resultado.exitosos}</p>
              <p className="text-sm text-emerald-600 dark:text-emerald-400">Nuevos <InfoTip text="Productos que no existían y se crearon por primera vez." placement="bottom" /></p>
            </div>
            <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-xl p-4 text-center">
              <CheckCircle2 size={28} className="mx-auto text-sky-600 mb-1" />
              <p className="text-2xl font-bold text-sky-700 dark:text-sky-400">{resultado.actualizados ?? 0}</p>
              <p className="text-sm text-sky-600 dark:text-sky-400">Actualizados <InfoTip text="Productos que ya existían (mismo SKU) y cambió al menos un dato." placement="bottom" /></p>
            </div>
            <div className="bg-ink-50 dark:bg-ink-800 border border-ink-200 dark:border-ink-700 rounded-xl p-4 text-center">
              <MinusCircle size={28} className="mx-auto text-ink-400 mb-1" />
              <p className="text-2xl font-bold text-ink-500 dark:text-ink-400">{resultado.sin_cambios ?? 0}</p>
              <p className="text-sm text-ink-500 dark:text-ink-400">Sin cambios <InfoTip text="Productos que ya existían y venían idénticos en el archivo: se ignoraron (no se tocaron)." placement="bottom" /></p>
            </div>
            <div className={`border rounded-xl p-4 text-center ${resultado.errores.length > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-ink-50 dark:bg-ink-800 border-ink-200 dark:border-ink-700'}`}>
              <XCircle size={28} className={`mx-auto mb-1 ${resultado.errores.length > 0 ? 'text-red-600' : 'text-ink-400'}`} />
              <p className={`text-2xl font-bold ${resultado.errores.length > 0 ? 'text-red-700 dark:text-red-400' : 'text-ink-500'}`}>{resultado.errores.length}</p>
              <p className={`text-sm ${resultado.errores.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-ink-500'}`}>Filas con error <InfoTip text="Filas que no se pudieron guardar (falta un dato, SKU inválido, número mal escrito…). El detalle aparece abajo para corregirlas." placement="bottom" /></p>
            </div>
          </div>

          {resultado.imagenes?.pendientes > 0 && (
            <div className="bg-brand-50 dark:bg-brand-900/10 border border-brand-200 dark:border-brand-800 rounded-xl p-4 flex items-start gap-3">
              <Cloud size={18} className="text-brand-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-brand-700 dark:text-brand-300">
                Descargando <strong>{resultado.imagenes.pendientes}</strong> imagen(es) a la nube (WebP → R2).
                El progreso aparece en la tarjeta “Imágenes en la nube” al cerrar este aviso.
              </p>
            </div>
          )}

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

          {resultado.cambios_detalle?.length > 0 && (
            <div className="bg-sky-50 dark:bg-sky-900/10 border border-sky-200 dark:border-sky-800 rounded-xl p-4 max-h-56 overflow-y-auto">
              <p className="text-xs font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                <ListChecks size={14} /> Cambios detectados:
              </p>
              <ul className="space-y-1.5">
                {resultado.cambios_detalle.map((c, i) => (
                  <li key={i} className="text-sm text-ink-700 dark:text-ink-200">
                    <span className="font-mono font-semibold text-sky-700 dark:text-sky-300">{c.codigo}</span>
                    <span className="text-ink-500 dark:text-ink-400"> — {c.cambios.join(' · ')}</span>
                  </li>
                ))}
              </ul>
              {resultado.actualizados > resultado.cambios_detalle.length && (
                <p className="text-xs text-ink-500 dark:text-ink-400 mt-2 italic">
                  …y {resultado.actualizados - resultado.cambios_detalle.length} producto(s) más actualizados.
                </p>
              )}
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
        </div>
        )}
      </Modal>
    </div>
  )
}
