import { Plus, Trash2, AlertTriangle, Check } from 'lucide-react'
import { Button, Input } from '../ui'

// Plantas predefinidas como sugerencia (datalist). El usuario puede tipear cualquier otra.
const PLANTAS_SUGERIDAS = ['CAET', 'STELLANTIS', 'AUDI', 'BMW', 'AXALTA', 'VOLVO', 'DTNA']

/**
 * Editor inline de credenciales de planta. Recibe el arreglo y un setter.
 * Cada credencial: { planta, credencial_id, fecha_caducidad }.
 */
export default function CredencialesEditor({ credenciales, onChange }) {
  const add = () => onChange([...credenciales, { planta: '', credencial_id: '', fecha_caducidad: '' }])
  const update = (idx, patch) => {
    const next = credenciales.map((c, i) => (i === idx ? { ...c, ...patch } : c))
    onChange(next)
  }
  const remove = (idx) => onChange(credenciales.filter((_, i) => i !== idx))

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-3">
      <datalist id="plantas-sugeridas">
        {PLANTAS_SUGERIDAS.map((p) => <option key={p} value={p} />)}
      </datalist>
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-600 dark:text-ink-400">
          {credenciales.length === 0 ? 'No hay credenciales registradas.' : `${credenciales.length} credencial(es).`}
        </p>
        <Button type="button" size="sm" variant="secondary" leftIcon={<Plus size={14} />} onClick={add}>
          Agregar credencial
        </Button>
      </div>

      {credenciales.length > 0 && (
        <div className="space-y-2">
          {credenciales.map((c, idx) => {
            const vencida = c.fecha_caducidad && c.fecha_caducidad < today
            return (
              <div
                key={idx}
                className={`grid grid-cols-1 sm:grid-cols-[1fr_1fr_180px_auto] gap-2 items-end p-3 rounded-lg border ${
                  vencida
                    ? 'border-red-200 bg-red-50/40 dark:border-red-900/50 dark:bg-red-950/10'
                    : 'border-ink-200 bg-ink-50/30 dark:border-ink-800 dark:bg-ink-900/30'
                }`}
              >
                <Input
                  label="Planta"
                  value={c.planta || ''}
                  onChange={(e) => update(idx, { planta: e.target.value.toUpperCase() })}
                  placeholder="CAET, STELLANTIS, AUDI..."
                  maxLength={100}
                  list="plantas-sugeridas"
                />
                <Input
                  label="ID Credencial"
                  value={c.credencial_id || ''}
                  onChange={(e) => update(idx, { credencial_id: e.target.value })}
                  maxLength={40}
                />
                <Input
                  type="date"
                  label="Caducidad"
                  value={c.fecha_caducidad || ''}
                  onChange={(e) => update(idx, { fecha_caducidad: e.target.value })}
                  rightIcon={
                    c.fecha_caducidad
                      ? vencida
                        ? <AlertTriangle size={14} className="text-red-500" />
                        : <Check size={14} className="text-emerald-500" />
                      : null
                  }
                />
                <Button
                  type="button"
                  variant="danger-ghost"
                  size="icon"
                  title="Eliminar"
                  onClick={() => remove(idx)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
