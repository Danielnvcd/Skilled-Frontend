import { User, X } from 'lucide-react'
import TrabajadorPicker from './TrabajadorPicker'

/**
 * Una parte del comprobante: quién entrega o quién recibe.
 *
 * Cada parte es un trabajador del sistema (se guarda su id, que es lo que hace
 * el comprobante rastreable) o un nombre libre para quien no está dado de alta —un
 * proveedor, un externo—. Sin la segunda opción, el almacenista acababa
 * apuntando el nombre en el campo de motivo.
 *
 * Vive aquí y no dentro de una pantalla porque lo usan tanto "Registrar
 * movimiento" como las acciones rápidas del catálogo: si cada una tuviera su
 * copia, el día que cambie el criterio de "quién puede recibir" solo cambiaría
 * en una.
 */
export default function PartePicker({
  label, modo, setModo, trabajador, setTrabajador, nombre, setNombre,
}) {
  return (
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400 mb-1.5">
        <User size={12} className="inline mr-1 -mt-0.5" /> {label}
      </label>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <button
          type="button"
          onClick={() => setModo('trabajador')}
          className={`py-1.5 rounded-lg border-2 text-xs font-bold transition-all ${
            modo === 'trabajador'
              ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
              : 'border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-500'
          }`}
        >
          Trabajador
        </button>
        <button
          type="button"
          onClick={() => setModo('libre')}
          className={`py-1.5 rounded-lg border-2 text-xs font-bold transition-all ${
            modo === 'libre'
              ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
              : 'border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-500'
          }`}
        >
          Nombre libre
        </button>
      </div>
      {modo === 'trabajador' ? (
        trabajador ? (
          <div className="flex items-center justify-between gap-2 rounded-md border border-ink-200 dark:border-ink-700 bg-ink-50 dark:bg-ink-800/50 px-3 py-2">
            {/* `min-w-0` es lo que hace efectivo el `truncate`: sin él, un flex
                item no se encoge por debajo de su contenido, así que un nombre
                largo empujaba la ✕ fuera de la caja en vez de recortarse.
                El nº de empleado va en su propio elemento y no dentro del texto
                truncado — es el dato corto que identifica a la persona y se
                perdía antes que el nombre al recortar. */}
            <span className="min-w-0 flex-1 text-sm font-medium text-ink-900 dark:text-ink-100 truncate" title={trabajador.nombre_completo}>
              {trabajador.nombre_completo}
            </span>
            <span className="text-[11px] text-ink-400 font-normal tabular-nums shrink-0">
              #{trabajador.no_empleado}
            </span>
            <button type="button" onClick={() => setTrabajador(null)} title="Cambiar" className="shrink-0 text-ink-400 hover:text-ink-700 dark:hover:text-ink-200">
              <X size={16} />
            </button>
          </div>
        ) : (
          <TrabajadorPicker value={trabajador} onSelect={setTrabajador} />
        )
      ) : (
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={200}
          placeholder="Nombre (no está en el sistema)"
          className="block w-full h-10 px-3 rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
        />
      )}
    </div>
  )
}
