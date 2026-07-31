import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Check, ClipboardCopy, Download, FileSpreadsheet, Truck, Upload, Warehouse,
} from 'lucide-react'
import {
  Modal, Button, InfoTip, Badge,
  Table, THead, TH, TBody, TR, TD,
} from '../../../components/ui'
import {
  descargarPlantillaAsignacion, importarAsignacion, aplicarAsignacion,
} from '../../../api/inventario'
import { extractApiError } from '../../../utils/apiError'
import { EstadoLinea, ResumenLote, AntesDespues, num, lineasAplicables } from './shared'

const PASOS = ['Descargar', 'Revisar', 'Listo']

function Pasos({ actual }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      {PASOS.map((p, i) => {
        const hecho = i < actual
        const activo = i === actual
        return (
          <div key={p} className="flex items-center gap-2">
            <div className={[
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors',
              activo ? 'bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200'
                : hecho ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'bg-ink-100 text-ink-400 dark:bg-ink-800 dark:text-ink-500',
            ].join(' ')}>
              <span className="grid place-items-center h-4 w-4 rounded-full bg-white/70 dark:bg-black/20 text-[10px]">
                {hecho ? <Check size={10} /> : i + 1}
              </span>
              {p}
            </div>
            {i < PASOS.length - 1 && <span className="h-px w-4 bg-ink-200 dark:bg-ink-700" />}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Importar material desde Excel — tres pasos en un solo modal.
 *
 * No se cambia de pantalla en ningún momento: quien importa está resolviendo
 * una sola tarea y mandarlo a otra ruta a medio camino le hace perder el hilo
 * (y el archivo que ya había elegido).
 *
 * La plantilla tiene TRES columnas, no trece: el proyecto sale del contexto y
 * el resto de los datos del material ya están en el catálogo.
 */
export default function ModalImportar({ open, onClose, proyecto, onAplicado }) {
  const [paso, setPaso] = useState(0)
  const [origen, setOrigen] = useState('general')
  const [archivo, setArchivo] = useState(null)
  const [preview, setPreview] = useState(null)
  const [subiendo, setSubiendo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [arrastrando, setArrastrando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setPaso(0); setOrigen('general'); setArchivo(null)
    setPreview(null); setResultado(null); setArrastrando(false)
  }, [open])

  const omitidas = useMemo(
    () => (preview?.lineas ?? []).filter((f) => f.estado === 'error'),
    [preview],
  )
  const aplicables = lineasAplicables(preview?.lineas)

  const bajarPlantilla = async () => {
    try {
      await descargarPlantillaAsignacion(proyecto.id, proyecto.numero_proyecto)
      toast.success('Plantilla descargada')
      setPaso(1)
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo descargar la plantilla'))
    }
  }

  const subir = async (f) => {
    if (!f) return
    if (!/\.(xlsx|xls)$/i.test(f.name)) {
      toast.error('Solo se aceptan archivos .xlsx o .xls')
      return
    }
    setArchivo(f)
    setSubiendo(true)
    setPreview(null)
    try {
      const res = await importarAsignacion(proyecto.id, f, { origen })
      setPreview(res)
    } catch (err) {
      setArchivo(null)
      toast.error(extractApiError(err, 'No se pudo leer el archivo'))
    } finally {
      setSubiendo(false)
    }
  }

  const aplicar = async () => {
    setGuardando(true)
    try {
      const res = await aplicarAsignacion(proyecto.id, { lineas: aplicables, origen })
      setResultado(res)
      setPaso(2)
      onAplicado?.()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo aplicar la importación'))
    } finally {
      setGuardando(false)
    }
  }

  // Las filas omitidas se copian como texto separado por tabuladores: eso se
  // pega DIRECTO en la plantilla de Excel. Bajarlas como archivo aparte sonaría
  // más completo, pero dejaría al usuario con un archivo que no puede volver a
  // subir sin rearmarlo.
  const copiarOmitidas = async () => {
    const tsv = omitidas
      .map((f) => [f.sku ?? '', f.cantidad_pedida ?? '', f.almacen_nombre ?? ''].join('\t'))
      .join('\n')
    try {
      await navigator.clipboard.writeText(tsv)
      toast.success('Filas copiadas — pégalas en la plantilla para corregirlas')
    } catch {
      toast.error('El navegador no permitió copiar')
    }
  }

  const OpcionOrigen = ({ valor, icon: Icon, titulo }) => (
    <button
      type="button"
      onClick={() => setOrigen(valor)}
      className={[
        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors focus-ring',
        origen === valor
          ? 'border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-900/25 dark:text-brand-200'
          : 'border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300 hover:border-ink-300',
      ].join(' ')}
    >
      <Icon size={13} />
      {titulo}
    </button>
  )

  const pie = () => {
    if (paso === 0) {
      return (
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="ghost" onClick={() => setPaso(1)}>Ya tengo el archivo</Button>
          <Button variant="primary" leftIcon={<Download size={15} />} onClick={bajarPlantilla}>
            Descargar plantilla
          </Button>
        </>
      )
    }
    if (paso === 1) {
      return (
        <div className="flex flex-1 flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            {subiendo
              ? <span className="text-xs text-ink-400">Leyendo el archivo…</span>
              : <ResumenLote resumen={preview?.resumen} />}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setPaso(0)} disabled={guardando}>Atrás</Button>
            <Button
              variant="primary"
              leftIcon={<Check size={15} />}
              onClick={aplicar}
              disabled={guardando || subiendo || aplicables.length === 0}
            >
              {guardando
                ? 'Aplicando…'
                : aplicables.length === 0
                  ? 'Aplicar'
                  : `Aplicar ${aplicables.length} fila${aplicables.length === 1 ? '' : 's'}`}
            </Button>
          </div>
        </div>
      )
    }
    return (
      <>
        {omitidas.length > 0 && (
          <Button variant="secondary" leftIcon={<ClipboardCopy size={15} />} onClick={copiarOmitidas}>
            Copiar filas omitidas
          </Button>
        )}
        <Button variant="primary" onClick={onClose}>Cerrar</Button>
      </>
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="full"
      title={`Importar material a ${proyecto?.numero_proyecto ?? ''}`}
      description={proyecto?.nombre || ''}
      footer={pie()}
    >
      <Pasos actual={paso} />

      {/* ── Paso 1: la plantilla ───────────────────────────────────────── */}
      {paso === 0 && (
        <div className="space-y-4">
          <p className="text-sm text-ink-600 dark:text-ink-300">
            La plantilla ya viene con este proyecto puesto y con los materiales que
            <strong> ya tiene apartados</strong>, para que solo escribas cantidades.
          </p>

          <div className="rounded-lg border border-ink-200 dark:border-ink-800 overflow-hidden">
            <div className="bg-ink-50 dark:bg-ink-950/40 px-3 py-2 text-xs font-semibold text-ink-600 dark:text-ink-300 flex items-center gap-1.5">
              Son solo tres columnas
              <InfoTip text="La plantilla del catálogo pide trece porque sirve para dar de alta materiales. Aquí el material ya existe: lo único que cambia es cuánto y dónde." />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-brand-700 text-white">
                    <th className="px-3 py-1.5 text-left font-semibold">SKU</th>
                    <th className="px-3 py-1.5 text-left font-semibold">Cantidad</th>
                    <th className="px-3 py-1.5 text-left font-semibold">Bodega</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-ink-600 dark:text-ink-300">
                  <tr className="border-t border-ink-200 dark:border-ink-800">
                    <td className="px-3 py-1.5">CBL-001</td>
                    <td className="px-3 py-1.5">50</td>
                    <td className="px-3 py-1.5">Almacén Principal</td>
                  </tr>
                  <tr className="border-t border-ink-200 dark:border-ink-800">
                    <td className="px-3 py-1.5">TUB-004</td>
                    <td className="px-3 py-1.5">40</td>
                    <td className="px-3 py-1.5">Almacén Principal</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <ul className="text-xs text-ink-500 space-y-1 list-disc pl-4">
            <li>El proyecto no es una columna: lo estás importando desde adentro.</li>
            <li>Si dejas la bodega vacía se usa la predeterminada.</li>
            <li>Las filas sin cantidad se ignoran — sirven para dejar el SKU a la vista.</li>
          </ul>
        </div>
      )}

      {/* ── Paso 2: subir y revisar ────────────────────────────────────── */}
      {paso === 1 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-ink-600 dark:text-ink-300">
              El material del archivo:
            </span>
            <OpcionOrigen valor="general" icon={Warehouse} titulo="Sale del stock General" />
            <OpcionOrigen valor="entrada" icon={Truck} titulo="Acaba de llegar" />
            <InfoTip text="Mover material que ya está en bodega y registrar material que acaba de llegar son cosas distintas. Si cambias esto después de subir el archivo, vuelve a subirlo para recalcular." />
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setArrastrando(true) }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={(e) => {
              e.preventDefault()
              setArrastrando(false)
              subir(e.dataTransfer.files?.[0])
            }}
            onClick={() => inputRef.current?.click()}
            className={[
              'rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors',
              arrastrando
                ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-900/20'
                : 'border-ink-300 dark:border-ink-700 hover:border-brand-400',
            ].join(' ')}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => { subir(e.target.files?.[0]); e.target.value = '' }}
            />
            <Upload size={22} className="mx-auto text-ink-400" />
            <p className="mt-2 text-sm font-medium text-ink-700 dark:text-ink-200">
              Arrastra el archivo aquí o haz clic para buscarlo
            </p>
            <p className="text-xs text-ink-400 mt-0.5">.xlsx / .xls — máx. 5 MB</p>
          </div>

          {archivo && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge tone="brand" leftIcon={<FileSpreadsheet size={11} />}>{archivo.name}</Badge>
              {preview && (
                <span className="text-ink-500">
                  {preview.lineas.length} fila{preview.lineas.length === 1 ? '' : 's'} con cantidad
                  {preview.filas_ignoradas > 0 &&
                    ` · ${preview.filas_ignoradas} sin cantidad (ignoradas)`}
                </span>
              )}
            </div>
          )}

          {preview && (
            <>
              <ResumenLote resumen={preview.resumen} />
              <p className="text-xs text-ink-500">
                Nada se ha aplicado todavía. Esto es lo que <em>pasaría</em>.
              </p>
              <div className="max-h-80 overflow-y-auto scrollbar-thin">
                <Table>
                  <THead>
                    <TH>Material</TH>
                    <TH>Bodega</TH>
                    <TH align="right">Ahora → queda</TH>
                    <TH>Estado</TH>
                  </THead>
                  <TBody>
                    {preview.lineas.map((f, i) => (
                      <TR key={`${f.sku}-${i}`}>
                        <TD>
                          <div className="font-mono text-xs font-bold text-brand-700 dark:text-brand-300">
                            {f.sku || '—'}
                          </div>
                          <div className="text-xs text-ink-500 truncate max-w-[240px]">
                            {f.descripcion || <span className="italic text-ink-400">Sin catálogo</span>}
                          </div>
                        </TD>
                        <TD className="text-xs text-ink-500">{f.almacen_nombre || '—'}</TD>
                        <TD align="right">
                          {f.estado === 'error'
                            ? <span className="text-ink-300 text-xs">—</span>
                            : <AntesDespues actual={f.actual} resultado={f.resultado} unidad={f.unidad} />}
                        </TD>
                        <TD>
                          <div className="space-y-1">
                            <EstadoLinea estado={f.estado} />
                            {f.motivo && (
                              <p className={[
                                'text-[11px] max-w-[300px]',
                                f.estado === 'error'
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-amber-700 dark:text-amber-400',
                              ].join(' ')}>
                                {f.motivo}
                              </p>
                            )}
                          </div>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Paso 3: qué pasó ───────────────────────────────────────────── */}
      {paso === 2 && (
        <div className="space-y-4">
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/60 p-4">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
              <Check size={18} />
              <span className="font-bold">
                Se asignaron {resultado?.aplicadas ?? 0} material
                {resultado?.aplicadas === 1 ? '' : 'es'} a {proyecto?.numero_proyecto}.
              </span>
            </div>
            {resultado?.resumen?.unidades > 0 && (
              <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1 tabular-nums">
                {num(resultado.resumen.unidades)} unidades en total.
              </p>
            )}
          </div>

          {omitidas.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-ink-800 dark:text-ink-100 mb-2">
                {omitidas.length} fila{omitidas.length === 1 ? '' : 's'} se omitió
                {omitidas.length === 1 ? '' : 'eron'}:
              </p>
              <Table>
                <THead>
                  <TH>SKU</TH>
                  <TH align="right">Cantidad</TH>
                  <TH>Motivo</TH>
                </THead>
                <TBody>
                  {omitidas.map((f, i) => (
                    <TR key={`${f.sku}-${i}`}>
                      <TD className="font-mono text-xs">{f.sku || '—'}</TD>
                      <TD align="right" className="font-mono tabular-nums text-xs">
                        {num(f.cantidad_pedida)}
                      </TD>
                      <TD className="text-xs text-rose-600 dark:text-rose-400">{f.motivo}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              <p className="text-xs text-ink-500 mt-2">
                Cópialas, pégalas en la plantilla, corrige el problema y vuelve a importar.
                Lo que ya entró no se repite.
              </p>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
