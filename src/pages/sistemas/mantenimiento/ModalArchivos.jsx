/**
 * Detalle de los archivos privados en el bucket de R2.
 *
 * Tres estados posibles, y cada uno se explica en vez de mostrar ceros:
 *   - sin configurar → la app guarda en disco y funciona; no es una falla
 *   - configurado pero incontactable → aviso accionable con el motivo
 *   - operativo → inventario, barra de progreso y botón para subir lo que falta
 */
import { RefreshCw, CheckCircle2, CloudUpload, FileWarning } from 'lucide-react'
import {
  Modal, Button, Badge, EmptyState, Table, THead, TH, TBody, TR, TD,
} from '../../../components/ui'
import { TarjetaDato as Tarjeta, fmtNumero } from '../PanelLayout'

export default function ModalArchivos({
  open, onClose, datos, progreso, sincronizando, onSincronizar,
}) {
  const pct = progreso?.total ? Math.round((progreso.hechas / progreso.total) * 100) : 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Archivos privados en la nube"
      description="Fotos de perfil, documentos de trabajadores y fotos de herramientas. Van a un bucket privado, distinto al del catálogo: se siguen sirviendo con sesión iniciada."
      size="xl"
    >
      {datos && !datos.enabled && (
        <EmptyState
          icon={CloudUpload}
          title="Almacenamiento en la nube sin configurar"
          description="Los archivos se están guardando en el disco del servidor y la aplicación funciona con normalidad. Para activarlo, define R2_PRIVADO_BUCKET en el .env de este entorno."
        />
      )}

      {datos?.enabled && datos.error && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/20">
          <h3 className="flex items-center gap-2 text-sm font-medium text-ink-900 dark:text-ink-100">
            <FileWarning size={15} className="text-red-600 dark:text-red-400" />
            No se puede contactar el bucket privado
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-ink-500 dark:text-ink-400">
            {datos.error}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-500 dark:text-ink-400">
            Mientras tanto los archivos se guardan y se sirven desde el disco del
            servidor: la aplicación funciona con normalidad y no se pierde nada.
          </p>
        </div>
      )}

      {datos?.enabled && !datos.error && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tarjeta etiqueta="En la nube" valor={datos.en_r2} />
            <Tarjeta etiqueta="Por subir" valor={datos.pendientes} />
            <Tarjeta etiqueta="Sin archivo" valor={datos.faltantes} tono={datos.faltantes > 0 ? 'alerta' : undefined} />
            <Tarjeta etiqueta="Total" valor={datos.total} />
          </div>

          {progreso && (
            <div className="space-y-1.5">
              <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                <div
                  className={`h-full transition-all duration-300 ${progreso.estado === 'done' ? 'bg-emerald-500' : 'bg-brand-600'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-ink-500 dark:text-ink-400">
                <span className="truncate">
                  {progreso.estado === 'done'
                    ? `Listo · ${progreso.ok} subido(s)${progreso.error ? `, ${progreso.error} con error` : ''}`
                    : `Subiendo ${progreso.hechas}/${progreso.total}${progreso.actual ? ` · ${progreso.actual}` : ''}`}
                </span>
                <span className="ml-2 flex-shrink-0 tabular-nums">{pct}%</span>
              </div>
            </div>
          )}

          {datos.pendientes > 0 ? (
            <div className="rounded-xl border border-ink-200 bg-ink-50/60 p-4 dark:border-ink-800 dark:bg-ink-800/30">
              <h3 className="text-sm font-medium text-ink-900 dark:text-ink-100">
                Subir los que faltan
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-ink-500 dark:text-ink-400">
                {fmtNumero(datos.pendientes)} archivo(s) siguen solo en el disco del
                servidor. Subirlos no borra la copia local ni interrumpe la aplicación:
                mientras tanto se siguen sirviendo desde el disco. Repetir la operación
                es seguro.
              </p>
              <div className="mt-3 flex justify-end">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<RefreshCw size={14} className={sincronizando ? 'animate-spin' : ''} />}
                  loading={sincronizando}
                  disabled={progreso?.estado === 'running'}
                  onClick={onSincronizar}
                >
                  Sincronizar {fmtNumero(datos.pendientes)}
                </Button>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={CheckCircle2}
              title="Todo sincronizado"
              description="Cada archivo referenciado por la base de datos ya está en la nube."
            />
          )}

          <Table>
            <THead>
              <TH>Tipo de archivo</TH>
              <TH align="right">En la nube</TH>
              <TH align="right">Por subir</TH>
              <TH align="right">Sin archivo</TH>
            </THead>
            <TBody>
              {datos.familias.map((f) => (
                <TR key={f.clave}>
                  <TD><span className="font-medium">{f.etiqueta}</span></TD>
                  <TD align="right" className="tabular-nums">{fmtNumero(f.en_r2)}</TD>
                  <TD align="right" className="tabular-nums">{fmtNumero(f.pendientes)}</TD>
                  <TD align="right" className="tabular-nums">{fmtNumero(f.faltantes)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>

          {datos.faltantes > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20">
              <h3 className="flex items-center gap-2 text-sm font-medium text-ink-900 dark:text-ink-100">
                <FileWarning size={15} className="text-amber-600 dark:text-amber-400" />
                {fmtNumero(datos.faltantes)} referencia(s) sin archivo
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-ink-500 dark:text-ink-400">
                La base de datos apunta a estos archivos pero no están ni en la nube ni
                en el disco. Es dato roto de antes de la migración, no lo causa
                sincronizar. Se corrigen volviendo a subir el archivo desde su pantalla.
              </p>
              <ul className="mt-2 space-y-0.5">
                {datos.detalle_faltantes.map((f) => (
                  <li key={f.key} className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge tone="neutral">{f.familia}</Badge>
                    <span className="truncate font-mono text-ink-500 dark:text-ink-400" title={f.key}>
                      {f.key}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
