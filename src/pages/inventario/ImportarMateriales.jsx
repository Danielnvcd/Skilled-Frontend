import { useEffect, useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { Upload, Download, CheckCircle2, XCircle, FileSpreadsheet, ArrowLeft, Tags, FileDown, ListChecks, Plus, FolderInput, Cloud, RefreshCw, Info, AlertTriangle, History, Undo2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, Card, PageHeader, Modal, Select, InfoTip, Badge } from '../../components/ui'
import { descargarPlantillaMateriales, exportarProductos, importarMateriales, getEstadoImagenes, sincronizarImagenes, getImagenesErrores, updateProducto, upsertCategoriaConfig, getAlmacenes, getProyectosInventario, getImportaciones, deshacerImportacion } from '../../api/inventario'
import { invalidate } from '../../utils/resourceCache'
import { useSocket } from '../../context/SocketContext'

// ── Piezas de los modales de importación ─────────────────────────────────────
// El módulo usa una paleta sobria (brand apagado + escala ink). Los recuadros
// de color saturado que había aquí competían con eso, así que la superficie es
// neutra y el color queda reducido a una barra de 2px: distingue de un vistazo
// sin gritar. Mismo componente en los tres modales para que el flujo
// (plan → aplicar → deshacer) se lea como una sola pantalla.
const ACENTOS = {
  nuevo:     'bg-emerald-500',
  cambio:    'bg-brand-500',
  neutro:    'bg-ink-300 dark:bg-ink-600',
  problema:  'bg-red-500',
  aviso:     'bg-amber-500',
}

function Stat({ valor, etiqueta, tono = 'neutro', tip }) {
  return (
    <div className="rounded-lg border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900/40 overflow-hidden">
      <div className={`h-0.5 ${ACENTOS[tono] || ACENTOS.neutro}`} />
      <div className="px-3 py-2.5 text-center">
        <p className="text-lg font-semibold tabular-nums text-ink-900 dark:text-ink-100 leading-none">
          {valor}
        </p>
        <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
          {etiqueta}{tip && <InfoTip text={tip} placement="bottom" />}
        </p>
      </div>
    </div>
  )
}

function Panel({ titulo, icon: Icon, tono = 'neutro', children, nota }) {
  const texto = tono === 'problema'
    ? 'text-red-700 dark:text-red-400'
    : tono === 'aviso'
      ? 'text-amber-700 dark:text-amber-400'
      : 'text-ink-500 dark:text-ink-400'
  return (
    <div className="rounded-lg border border-ink-200 dark:border-ink-800 overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-ink-50 dark:bg-ink-900/40 border-b border-ink-200 dark:border-ink-800">
        <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${ACENTOS[tono] || ACENTOS.neutro}`} />
        {Icon && <Icon size={13} className={texto} />}
        <span className={`text-[11px] font-semibold uppercase tracking-wide ${texto}`}>{titulo}</span>
      </div>
      <div className="max-h-56 overflow-y-auto divide-y divide-ink-100 dark:divide-ink-800">
        {children}
      </div>
      {nota && (
        <p className="px-3 py-1.5 text-[11px] text-ink-500 dark:text-ink-400 border-t border-ink-100 dark:border-ink-800">
          {nota}
        </p>
      )}
    </div>
  )
}

export default function ImportarMateriales() {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [resultado, setResultado] = useState(null)
  // Confirmación de categorías nuevas parecidas a existentes.
  const [confirmCats, setConfirmCats] = useState(null)   // { categorias_ambiguas, categorias_existentes }
  const [catChoices, setCatChoices] = useState({})       // { nombreEnArchivo: existente | '' (crear nueva) }
  const inputRef = useRef(null)

  // ── Destino del stock inicial de la plantilla vacía ───────────────────────
  // Se elige ANTES de descargar: la plantilla baja con Almacén/Proyecto ya
  // llenos en cada fila (y con lista desplegable), así nadie teclea un nombre
  // que no existe — que era el error más común al importar.
  const [plantillaOpen, setPlantillaOpen] = useState(false)
  const [almacenes, setAlmacenes] = useState([])
  const [proyectos, setProyectos] = useState([])
  const [destAlmacen, setDestAlmacen] = useState('')
  const [destProyecto, setDestProyecto] = useState('')
  const [descargando, setDescargando] = useState(false)

  useEffect(() => {
    getAlmacenes()
      .then((d) => {
        const activos = (Array.isArray(d) ? d : []).filter((a) => a.activo !== false)
        setAlmacenes(activos)
        // Preseleccionar la primera bodega: el caso normal es una sola.
        setDestAlmacen((prev) => prev || (activos[0] ? String(activos[0].id) : ''))
      })
      .catch(() => setAlmacenes([]))
    getProyectosInventario()
      .then((d) => setProyectos(Array.isArray(d) ? d : (d?.items || [])))
      .catch(() => setProyectos([]))
  }, [])

  // ── Historial de importaciones + deshacer ────────────────────────────────
  const [historial, setHistorial] = useState([])
  const [deshaciendo, setDeshaciendo] = useState(null)   // id en curso
  const [confirmarUndo, setConfirmarUndo] = useState(null)  // lote a revertir

  const cargarHistorial = () => {
    getImportaciones(10).then((d) => setHistorial(Array.isArray(d) ? d : [])).catch(() => {})
  }
  useEffect(() => { cargarHistorial() }, [])

  const handleDeshacer = async (lote) => {
    setDeshaciendo(lote.id)
    try {
      const r = await deshacerImportacion(lote.id)
      const partes = []
      if (r.restaurados) partes.push(`${r.restaurados} restaurado(s)`)
      if (r.eliminados) partes.push(`${r.eliminados} eliminado(s)`)
      if (r.desactivados) partes.push(`${r.desactivados} desactivado(s)`)
      toast.success(`Importación deshecha: ${partes.join(', ') || 'sin cambios'}`, { duration: 6000 })
      if (r.notas?.length > 0) {
        toast(r.notas[0], { icon: <Info size={18} />, duration: 9000 })
      }
      invalidate('productos')
      invalidate('movimientos')
      cargarHistorial()
      setConfirmarUndo(null)
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo deshacer la importación')
    } finally {
      setDeshaciendo(null)
    }
  }

  const handleDescargarPlantilla = async () => {
    setDescargando(true)
    try {
      await descargarPlantillaMateriales({
        almacenId: destAlmacen ? Number(destAlmacen) : undefined,
        proyectoId: destProyecto ? Number(destProyecto) : undefined,
      })
      setPlantillaOpen(false)
      toast.success('Plantilla descargada. El almacén y el proyecto ya vienen llenos.')
    } catch (err) {
      toast.error(err?.detail || err?.response?.data?.detail || 'Error al descargar la plantilla')
    } finally {
      setDescargando(false)
    }
  }

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
        if (p.error > 0) {
          toast(`${p.error} imagen(es) no se pudieron subir. Corrige sus URLs en «${p.error} con error».`, { icon: <AlertTriangle size={18} />, duration: 7000 })
        }
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
          toast(`Quedan ${res.restantes} para la próxima corrida (vuelve a sincronizar al terminar).`, { icon: <Info size={18} />, duration: 6000 })
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

  // ── Corregir imágenes que fallaron (URL rota) ────────────────────────────
  const [errOpen, setErrOpen] = useState(false)
  const [errItems, setErrItems] = useState([])
  const [errLoading, setErrLoading] = useState(false)
  const [errUrls, setErrUrls] = useState({})          // key -> nueva url
  const [errSavingKey, setErrSavingKey] = useState(null)
  const keyOf = (it) => `${it.tipo}:${it.id}`

  const abrirErrores = async () => {
    setErrOpen(true)
    setErrLoading(true)
    setErrUrls({})
    try {
      const res = await getImagenesErrores()
      setErrItems(res.items || [])
    } catch {
      toast.error('No se pudo cargar la lista de imágenes con error')
    } finally {
      setErrLoading(false)
    }
  }

  const guardarUrlError = async (it) => {
    const k = keyOf(it)
    const nuevaUrl = (errUrls[k] || '').trim()
    if (!nuevaUrl) { toast.error('Escribe la URL corregida'); return }
    setErrSavingKey(k)
    try {
      if (it.tipo === 'producto') {
        await updateProducto(it.id, { imagen_url: nuevaUrl })
      } else {
        await upsertCategoriaConfig(it.codigo, nuevaUrl)  // codigo = nombre en categorías
      }
      toast.success(`Reintentando la imagen de ${it.codigo}…`)
      // La quitamos de la lista: ya se re-encoló y saldrá de ERROR.
      setErrItems((list) => list.filter((x) => keyOf(x) !== k))
      cargarEstadoImagenes()
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'No se pudo guardar la URL (¿es HTTPS y termina en imagen?)')
    } finally {
      setErrSavingKey(null)
    }
  }

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
      cargarHistorial()   // para poder deshacerla desde el historial
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

  // ── Previsualización: primero el plan, y solo al confirmar se escribe ─────
  // Con miles de productos, un archivo mal editado aplicado de golpe no tiene
  // vuelta atrás fácil. El backend recorre el archivo igual pero sin escribir.
  const [plan, setPlan] = useState(null)      // respuesta con previsualizacion: true
  const [mapeoUsado, setMapeoUsado] = useState(null)  // categorías ya resueltas

  const pedirPlan = async (mapeo) => {
    const res = await importarMateriales(file, mapeo, { previsualizar: true })
    if (res.necesita_confirmacion) {
      // Preseleccionar la sugerencia (agregar a la categoría existente parecida).
      const choices = {}
      res.categorias_ambiguas.forEach((a) => { choices[a.nombre] = a.sugerencia })
      setCatChoices(choices)
      setConfirmCats(res)
      return
    }
    setMapeoUsado(mapeo || null)
    setPlan(res)
  }

  const handleSubmit = async () => {
    if (!file) return
    setUploading(true)
    try {
      await pedirPlan(undefined)
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al leer el archivo')
    } finally {
      setUploading(false)
    }
  }

  // Con la decisión del usuario sobre cada categoría, vuelve a pedir el plan.
  const handleConfirmCategorias = async () => {
    if (!file || !confirmCats) return
    setUploading(true)
    try {
      // Incluir TODAS las ambiguas (valor '' = crear nueva) para que el backend
      // no vuelva a preguntar.
      const mapeo = { ...catChoices }
      setConfirmCats(null)
      await pedirPlan(mapeo)
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al leer el archivo')
    } finally {
      setUploading(false)
    }
  }

  // Aplicar de verdad: mismo archivo y mismo mapeo que produjeron el plan.
  const handleAplicarPlan = async () => {
    if (!file || !plan) return
    setUploading(true)
    try {
      const res = await importarMateriales(file, mapeoUsado || undefined)
      setPlan(null)
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
              <strong className="text-ink-700 dark:text-ink-200">Plantilla vacía</strong>: para dar de alta productos nuevos desde cero. Antes de bajarla eliges a qué bodega y proyecto entra el material.
              <InfoTip text="Un Excel en blanco, solo con los encabezados y sus notas de ayuda. Las columnas Almacén y Proyecto bajan ya llenas con lo que elijas, y traen lista desplegable: no se puede escribir una bodega o un proyecto que no exista." />
            </p>
            <p>
              <strong className="text-ink-700 dark:text-ink-200">Exportar catálogo actual</strong>: baja TODOS tus productos ya llenos (agrupados por categoría) para editarlos y reimportar.
              <InfoTip text="Ideal para actualizar en masa marca, descripción, categoría, unidad, precio, proveedor o imagen de productos que YA existen. Editas las celdas, guardas y subes el mismo archivo en «Procesar e Importar»: el sistema aplica SOLO lo que cambiaste. No trae columnas de stock ni de bodega/proyecto porque en un producto existente no aplican (el stock se mueve en Movimientos y el mínimo en la ficha del producto). No borres la columna del código (SKU) ni las filas grises de categoría." />
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            leftIcon={<Download size={15} />}
            onClick={() => setPlantillaOpen(true)}
          >
            Plantilla vacía…
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
              <strong>Almacén</strong> y <strong>Proyecto</strong> ya vienen llenos (celdas grises)
              <InfoTip text="Es el destino que elegiste al descargar la plantilla: indican a qué bodega llega el stock inicial y a qué proyecto se aparta. Si una fila va a otro lado, cámbialo con la listita de la celda. Vacío = bodega predeterminada y General (libre). Solo aplica a productos NUEVOS." />
            </li>
            <li>
              <strong>Proveedor</strong> y <strong>Contacto</strong> (opcionales)
              <InfoTip text="Proveedor habitual del material. Si lo capturas aquí, Compras Express puede agrupar la orden y mandarla por WhatsApp sin que tengas que editar producto por producto." />
            </li>
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
            Al subirlo verás <strong>primero el plan</strong>: qué productos se crearían, qué cambiaría
            en los que ya existen y qué filas se omitirían. Nada se guarda hasta que lo confirmes.
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
                    {imgEstado.pendientes > 0 && (
                      <> · <span className="font-semibold text-amber-600 dark:text-amber-400">{imgEstado.pendientes} por subir</span></>
                    )}
                    {imgEstado.error > 0 && (
                      <> · <span className="font-semibold text-red-600 dark:text-red-400">{imgEstado.error} con error</span></>
                    )}</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {imgEstado?.error > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<AlertTriangle size={15} className="text-red-500" />}
                  onClick={abrirErrores}
                >
                  Corregir {imgEstado.error} con error
                </Button>
              )}
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
            Revisar archivo
          </Button>
          <p className="text-xs text-center text-ink-500 dark:text-ink-400">
            Primero verás qué va a pasar. Nada se guarda hasta que lo confirmes.
          </p>
        </div>
      </Card>

      {/* Historial: qué se importó y cómo deshacerlo */}
      {historial.length > 0 && (
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <History size={18} className="text-brand-600" />
            <h3 className="font-semibold text-ink-900 dark:text-ink-100">Importaciones recientes</h3>
            <InfoTip text="Cada carga queda registrada con lo que le hizo a cada producto. «Deshacer» revierte solo lo que siga tal como lo dejó la importación: si alguien editó algo después, eso se respeta y te lo dice." />
          </div>
          <div className="divide-y divide-ink-100 dark:divide-ink-800">
            {historial.map((h) => (
              <div key={h.id} className="py-2.5 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink-800 dark:text-ink-100 truncate">
                    {h.archivo || 'Sin nombre'}
                    {h.estado === 'REVERTIDA' && (
                      <Badge tone="warning" className="ml-2">Deshecha</Badge>
                    )}
                  </p>
                  <p className="text-xs text-ink-500 dark:text-ink-400">
                    {h.fecha ? new Date(h.fecha).toLocaleString('es-MX') : '—'}
                    {h.usuario ? ` · ${h.usuario}` : ''}
                    {' · '}{h.creados} nuevo(s), {h.actualizados} actualizado(s)
                  </p>
                  {h.revertida_notas && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                      {h.revertida_notas}
                    </p>
                  )}
                </div>
                {h.puede_deshacerse && (
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<Undo2 size={15} />}
                    loading={deshaciendo === h.id}
                    onClick={() => setConfirmarUndo(h)}
                  >
                    Deshacer
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Confirmación de deshacer */}
      <Modal
        open={!!confirmarUndo}
        onClose={() => setConfirmarUndo(null)}
        title="¿Deshacer esta importación?"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmarUndo(null)} disabled={!!deshaciendo}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={!!deshaciendo}
              onClick={() => handleDeshacer(confirmarUndo)}
            >
              Sí, deshacer
            </Button>
          </>
        }
      >
        {confirmarUndo && (
          <div className="space-y-4">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <p className="text-sm text-ink-700 dark:text-ink-200 font-medium truncate">
                {confirmarUndo.archivo || 'Importación sin nombre'}
              </p>
              <p className="text-xs text-ink-500 dark:text-ink-400">
                {confirmarUndo.fecha ? new Date(confirmarUndo.fecha).toLocaleString('es-MX') : '—'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <Stat valor={confirmarUndo.actualizados} etiqueta="Vuelven atrás" tono="cambio" />
              <Stat valor={confirmarUndo.creados} etiqueta="Se eliminan" tono="problema" />
            </div>

            <Panel titulo="Qué va a pasar" icon={Undo2}>
              <p className="px-3 py-1.5 text-sm text-ink-600 dark:text-ink-300">
                Los productos actualizados recuperan los valores que tenían antes.
              </p>
              <p className="px-3 py-1.5 text-sm text-ink-600 dark:text-ink-300">
                Los productos nuevos se borran, junto con el stock inicial que trajeron.
              </p>
              <p className="px-3 py-1.5 text-sm text-ink-600 dark:text-ink-300">
                Lo editado o movido <strong>después</strong> de importar no se toca: si un producto
                nuevo ya tuvo movimientos, se da de baja en vez de borrarse para conservar su
                histórico. Al terminar te digo qué quedó fuera.
              </p>
            </Panel>
          </div>
        )}
      </Modal>

      {/* Plan de importación — se muestra ANTES de escribir nada */}
      <Modal
        open={!!plan}
        onClose={() => setPlan(null)}
        title="Revisa antes de aplicar"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPlan(null)} disabled={uploading}>Cancelar</Button>
            <Button
              loading={uploading}
              disabled={!plan || (plan.exitosos + plan.actualizados) === 0}
              onClick={handleAplicarPlan}
            >
              {plan && (plan.exitosos + plan.actualizados) > 0
                ? `Aplicar ${plan.exitosos + plan.actualizados} cambio(s)`
                : 'Nada que aplicar'}
            </Button>
          </>
        }
      >
        {plan && (
          <div className="space-y-4">
            <p className="text-sm text-ink-600 dark:text-ink-300">
              Esto es lo que va a pasar con <strong>{file?.name}</strong>. Todavía
              no se ha guardado nada.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <Stat valor={plan.exitosos} etiqueta="Se crean" tono="nuevo" />
              <Stat valor={plan.actualizados} etiqueta="Se actualizan" tono="cambio" />
              <Stat valor={plan.sin_cambios} etiqueta="Iguales" />
              <Stat valor={plan.errores.length} etiqueta="Se omiten"
                    tono={plan.errores.length > 0 ? 'problema' : 'neutro'} />
            </div>

            {plan.duplicados?.length > 0 && (
              <Panel
                titulo="¿Ya existen con otro código?"
                icon={AlertTriangle}
                tono="aviso"
                nota="Si son el mismo material, cancela y corrige el SKU para no duplicarlo."
              >
                {plan.duplicados.map((d, i) => (
                  <div key={i} className="px-3 py-1.5 text-sm text-ink-700 dark:text-ink-200">
                    <span className="font-mono text-xs text-ink-900 dark:text-ink-100">{d.codigo}</span>
                    <span className="text-ink-500 dark:text-ink-400"> “{d.descripcion}” · ya existe como </span>
                    <span className="font-mono text-xs text-ink-900 dark:text-ink-100">{d.parecido_a}</span>
                  </div>
                ))}
              </Panel>
            )}

            {plan.nuevos?.length > 0 && (
              <Panel
                titulo="Productos nuevos"
                icon={Plus}
                tono="nuevo"
                nota={plan.exitosos > plan.nuevos.length
                  ? `…y ${plan.exitosos - plan.nuevos.length} más.` : null}
              >
                {plan.nuevos.map((n, i) => (
                  <div key={i} className="px-3 py-1.5 text-sm text-ink-700 dark:text-ink-200">
                    <span className="font-mono text-xs text-ink-900 dark:text-ink-100">{n.codigo}</span>
                    <span> · {n.descripcion}</span>
                    {n.stock_inicial > 0 && (
                      <span className="text-ink-500 dark:text-ink-400">
                        {' '}· {n.stock_inicial} {n.unidad} → {n.almacen} / {n.proyecto}
                      </span>
                    )}
                  </div>
                ))}
              </Panel>
            )}

            {plan.cambios_detalle?.length > 0 && (
              <Panel
                titulo="Cambios que se aplican"
                icon={ListChecks}
                tono="cambio"
                nota={plan.actualizados > plan.cambios_detalle.length
                  ? `…y ${plan.actualizados - plan.cambios_detalle.length} producto(s) más.` : null}
              >
                {plan.cambios_detalle.map((c, i) => (
                  <div key={i} className="px-3 py-1.5 text-sm text-ink-700 dark:text-ink-200">
                    <span className="font-mono text-xs text-ink-900 dark:text-ink-100">{c.codigo}</span>
                    <span className="text-ink-500 dark:text-ink-400"> · {c.cambios.join(' · ')}</span>
                  </div>
                ))}
              </Panel>
            )}

            {plan.categorias_creadas?.length > 0 && (
              <Panel titulo="Categorías que se crean" icon={Tags} tono="cambio">
                <div className="px-3 py-2 flex flex-wrap gap-1.5">
                  {plan.categorias_creadas.map((c, i) => (
                    <span key={i} className="text-[11px] px-2 py-0.5 rounded-full border border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300">
                      {c}
                    </span>
                  ))}
                </div>
              </Panel>
            )}

            {plan.errores.length > 0 && (
              <Panel
                titulo="Filas que se omiten"
                icon={XCircle}
                tono="problema"
                nota="El resto del archivo sí se aplica."
              >
                {plan.errores.map((e, i) => (
                  <div key={i} className="px-3 py-1.5 text-sm text-ink-600 dark:text-ink-300">{e}</div>
                ))}
              </Panel>
            )}
          </div>
        )}
      </Modal>

      {/* Destino del stock inicial — se elige antes de bajar la plantilla vacía */}
      <Modal
        open={plantillaOpen}
        onClose={() => setPlantillaOpen(false)}
        title="¿A dónde entra este material?"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPlantillaOpen(false)} disabled={descargando}>Cancelar</Button>
            <Button leftIcon={<Download size={15} />} loading={descargando} onClick={handleDescargarPlantilla}>
              Descargar plantilla
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-600 dark:text-ink-300">
            La plantilla bajará con estas dos columnas <strong>ya llenas</strong> en cada fila, así solo
            capturas el material. Si alguna fila va a otro lado, puedes cambiarla con la lista de la celda.
          </p>

          <Select
            label="Bodega donde llega el stock inicial"
            hint={almacenes.length === 0
              ? 'No hay bodegas activas: el stock inicial quedará sin bodega hasta que crees una.'
              : 'Es donde se dará de alta la existencia de los productos nuevos.'}
            value={destAlmacen}
            onChange={(e) => setDestAlmacen(e.target.value)}
          >
            <option value="">Bodega predeterminada</option>
            {almacenes.map((a) => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </Select>

          <Select
            label="Proyecto al que se aparta (opcional)"
            hint="«General (libre)» = disponible para cualquier proyecto. Si eliges uno, el material queda apartado para ese proyecto."
            value={destProyecto}
            onChange={(e) => setDestProyecto(e.target.value)}
          >
            <option value="">General (libre)</option>
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.numero_proyecto}{p.nombre ? ` — ${p.nombre}` : ''}
              </option>
            ))}
          </Select>

          <p className="text-xs text-ink-500 dark:text-ink-400">
            Esto solo aplica a productos <strong>nuevos</strong>. Si un SKU del archivo ya existe, se
            actualizan sus datos y su stock no se mueve.
          </p>
        </div>
      </Modal>

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

      {/* Modal: corregir imágenes que fallaron (URL rota) */}
      <Modal
        open={errOpen}
        onClose={() => setErrOpen(false)}
        title="Corregir imágenes que fallaron"
        size="lg"
        footer={<Button variant="secondary" onClick={() => setErrOpen(false)}>Cerrar</Button>}
      >
        {errLoading ? (
          <p className="text-sm text-ink-500 dark:text-ink-400 py-6 text-center">Cargando…</p>
        ) : errItems.length === 0 ? (
          <div className="py-8 text-center">
            <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2" />
            <p className="text-sm text-ink-600 dark:text-ink-300">No hay imágenes con error. ¡Todo en orden!</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink-500 dark:text-ink-400">
              Estas imágenes no se pudieron descargar (URL rota o no era una imagen). Pega la URL corregida
              (HTTPS, que apunte directo a la imagen) y guarda: se reintentará subir a R2 automáticamente.
            </p>
            {errItems.map((it) => {
              const k = keyOf(it)
              return (
                <div key={k} className="rounded-lg border border-ink-200 dark:border-ink-800 p-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge tone={it.tipo === 'producto' ? 'info' : 'warning'}>
                      {it.tipo === 'producto' ? 'Producto' : 'Categoría'}
                    </Badge>
                    <span className="font-mono text-xs text-brand-700 dark:text-brand-300">{it.codigo}</span>
                    {it.tipo === 'producto' && it.nombre && (
                      <span className="text-sm text-ink-700 dark:text-ink-200 truncate">{it.nombre}</span>
                    )}
                  </div>
                  <p className="text-[11px] text-red-600 dark:text-red-400 break-all">
                    <span className="font-semibold">Falló:</span> {it.url_fallida || '—'}
                    {it.error && <> — {it.error}</>}
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={errUrls[k] || ''}
                      onChange={(e) => setErrUrls((s) => ({ ...s, [k]: e.target.value }))}
                      placeholder="https://…/imagen.jpg"
                      className="flex-1 h-9 px-3 rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
                    />
                    <Button size="sm" loading={errSavingKey === k} onClick={() => guardarUrlError(it)}>
                      Guardar
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Modal>

      {/* Resultado — aparece como modal al terminar la importación */}
      <Modal
        open={!!resultado}
        onClose={() => setResultado(null)}
        title="Resultado de la importación"
        size="lg"
        footer={
          <>
            {resultado?.importacion_id && (
              <Button
                variant="secondary"
                leftIcon={<Undo2 size={15} />}
                onClick={() => {
                  const lote = historial.find((h) => h.id === resultado.importacion_id)
                  setResultado(null)
                  setConfirmarUndo(lote || {
                    id: resultado.importacion_id, archivo: file?.name,
                    creados: resultado.exitosos, actualizados: resultado.actualizados,
                  })
                }}
              >
                Deshacer esta importación
              </Button>
            )}
            <Button onClick={() => setResultado(null)}>Cerrar</Button>
          </>
        }
      >
        {resultado && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <Stat valor={resultado.exitosos} etiqueta="Nuevos" tono="nuevo"
                  tip="Productos que no existían y se crearon por primera vez." />
            <Stat valor={resultado.actualizados ?? 0} etiqueta="Actualizados" tono="cambio"
                  tip="Productos que ya existían (mismo SKU) y cambió al menos un dato." />
            <Stat valor={resultado.sin_cambios ?? 0} etiqueta="Iguales"
                  tip="Productos que ya existían y venían idénticos en el archivo: se ignoraron." />
            <Stat valor={resultado.errores.length} etiqueta="Con error"
                  tono={resultado.errores.length > 0 ? 'problema' : 'neutro'}
                  tip="Filas que no se pudieron guardar (falta un dato, SKU inválido, número mal escrito…)." />
          </div>

          {resultado.imagenes?.pendientes > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-ink-200 dark:border-ink-800 px-3 py-2">
              <Cloud size={14} className="text-brand-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-ink-600 dark:text-ink-300">
                Descargando <strong>{resultado.imagenes.pendientes}</strong> imagen(es) a la nube
                (WebP → R2). El progreso aparece en “Imágenes en la nube” al cerrar este aviso.
              </p>
            </div>
          )}

          {resultado.categorias_creadas?.length > 0 && (
            <Panel titulo="Categorías nuevas" icon={Tags} tono="cambio"
                   nota="Puedes asignarles una imagen desde el catálogo de categorías.">
              <div className="px-3 py-2 flex flex-wrap gap-1.5">
                {resultado.categorias_creadas.map((c, i) => (
                  <span key={i} className="text-[11px] px-2 py-0.5 rounded-full border border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300">
                    {c}
                  </span>
                ))}
              </div>
            </Panel>
          )}

          {resultado.cambios_detalle?.length > 0 && (
            <Panel
              titulo="Cambios aplicados"
              icon={ListChecks}
              tono="cambio"
              nota={resultado.actualizados > resultado.cambios_detalle.length
                ? `…y ${resultado.actualizados - resultado.cambios_detalle.length} producto(s) más.` : null}
            >
              {resultado.cambios_detalle.map((c, i) => (
                <div key={i} className="px-3 py-1.5 text-sm text-ink-700 dark:text-ink-200">
                  <span className="font-mono text-xs text-ink-900 dark:text-ink-100">{c.codigo}</span>
                  <span className="text-ink-500 dark:text-ink-400"> · {c.cambios.join(' · ')}</span>
                </div>
              ))}
            </Panel>
          )}

          {resultado.errores.length > 0 && (
            <Panel titulo="Filas omitidas" icon={XCircle} tono="problema">
              {resultado.errores.map((e, i) => (
                <div key={i} className="px-3 py-1.5 text-sm text-ink-600 dark:text-ink-300">{e}</div>
              ))}
            </Panel>
          )}
        </div>
        )}
      </Modal>
    </div>
  )
}
