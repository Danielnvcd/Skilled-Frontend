/**
 * Detalle de la base de datos: tablas que crecen sin límite y purga de bitácora.
 *
 * La purga es la única acción IRREVERSIBLE del panel. Por eso vive al fondo del
 * modal, en un bloque de color de advertencia y separada de la tabla informativa:
 * no debe quedar al alcance de un clic distraído mientras se consultan cifras.
 */
import { Trash2 } from 'lucide-react'
import {
  Modal, Button, Select, Table, THead, TH, TBody, TR, TD,
} from '../../../components/ui'
import { fmtNumero } from '../PanelLayout'

export default function ModalBaseDatos({
  open, onClose, datos, mesesPurga, setMesesPurga, onPurgar,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Base de datos"
      description="Tablas que suman una fila por evento y nada las poda. El resto crece con el negocio y se autolimita."
      size="xl"
    >
      {datos && (
        <div className="space-y-4">
          <Table>
            <THead>
              <TH>Tabla</TH>
              <TH align="right">Filas</TH>
              <TH align="right">Tamaño</TH>
            </THead>
            <TBody>
              {datos.tablas.map((t) => (
                <TR key={t.tabla}>
                  <TD>
                    <span className="font-medium">{t.etiqueta}</span>
                    <span className="ml-2 font-mono text-xs text-ink-500 dark:text-ink-400">
                      {t.tabla}
                    </span>
                  </TD>
                  <TD align="right" className="tabular-nums">{fmtNumero(t.filas)}</TD>
                  <TD align="right" className="whitespace-nowrap tabular-nums">
                    {t.tamano || '—'}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>

          {!datos.tamano_disponible && (
            <p className="text-xs text-ink-500 dark:text-ink-400">
              El tamaño en disco solo está disponible en PostgreSQL
              (motor actual: {datos.motor}).
            </p>
          )}

          <div className="rounded-xl border border-red-200 bg-red-50/60 p-4 dark:border-red-900/40 dark:bg-red-900/10">
            <h3 className="text-sm font-medium text-ink-900 dark:text-ink-100">
              Purgar bitácora antigua
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-ink-500 dark:text-ink-400">
              Elimina entradas anteriores al periodo elegido.{' '}
              {datos.bitacora_desde && (
                <>
                  El registro más antiguo es del{' '}
                  <strong className="font-medium">
                    {new Date(datos.bitacora_desde).toLocaleDateString('es-MX')}
                  </strong>.{' '}
                </>
              )}
              Es irreversible, y por eso no se permite tocar los últimos 3 meses:
              son los que sirven para investigar un incidente.
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <Select
                label="Conservar"
                value={String(mesesPurga)}
                onChange={(e) => setMesesPurga(Number(e.target.value))}
                wrapperClassName="w-48"
              >
                <option value="6">Últimos 6 meses</option>
                <option value="12">Últimos 12 meses</option>
                <option value="24">Últimos 24 meses</option>
              </Select>
              <Button
                variant="danger"
                size="md"
                leftIcon={<Trash2 size={15} />}
                onClick={onPurgar}
              >
                Purgar
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
