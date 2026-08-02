/**
 * Detalle de la base de datos: tablas que crecen sin límite y purga.
 *
 * La purga es la única acción IRREVERSIBLE del panel. Por eso vive al fondo del
 * modal, en un bloque de color de advertencia y separada de la tabla informativa:
 * no debe quedar al alcance de un clic distraído mientras se consultan cifras.
 */
import { Modal, Table, THead, TH, TBody, TR, TD } from '../../../components/ui'
import { fmtNumero } from '../PanelLayout'
import PurgaTabla from './PurgaTabla'

export default function ModalBaseDatos({
  open, onClose, datos, tablasPurgables, onPurgar,
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

          {datos.bitacora_desde && (
            <p className="text-xs text-ink-500 dark:text-ink-400">
              La entrada más antigua de la bitácora es del{' '}
              <strong className="font-medium">
                {new Date(datos.bitacora_desde).toLocaleDateString('es-MX')}
              </strong>.
            </p>
          )}

          <PurgaTabla tablas={tablasPurgables} onPurgar={onPurgar} />
        </div>
      )}
    </Modal>
  )
}
