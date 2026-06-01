import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  IdCard, Search, Pencil, Eye, Plus, Trash2, AlertCircle, CheckCircle2, XCircle,
} from 'lucide-react'
import {
  PageHeader, Button, Input, Select, Table, THead, TH, TBody, TR, TD,
  Badge, Pagination, EmptyState, Skeleton, Modal,
} from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { listarCredencialesPlanta, guardarCredencialesPlanta } from '../../api/credenciales'
import { extractApiError } from '../../utils/apiError'
import { useResource } from '../../hooks/useResource'
import AvatarFoto from '../../components/empleados/AvatarFoto'

const PER_PAGE = 20

const PLANTAS_PREDEF = ['CAET', 'STELLANTIS', 'AUDI', 'BMW', 'AXALTA', 'VOLVO', 'DTNA', 'OTRA']

function credentialState(fecha_caducidad, today) {
  if (!fecha_caducidad) return 'vigente'
  const exp = new Date(fecha_caducidad + 'T00:00:00')
  if (exp < today) return 'caducada'
  const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24))
  if (diffDays <= 30) return 'proxima'
  return 'vigente'
}

const stateToTone = {
  vigente: 'success',
  proxima: 'warning',
  caducada: 'danger',
}

function CredencialChip({ cred, today }) {
  const state = credentialState(cred.fecha_caducidad, today)
  const tone = stateToTone[state]
  const titleParts = [`${cred.planta} · ID ${cred.credencial_id}`]
  if (cred.fecha_caducidad) {
    titleParts.push(`${state === 'caducada' ? 'Caducada' : 'Vence'} ${cred.fecha_caducidad}`)
  }
  return (
    <Badge tone={tone} dot title={titleParts.join(' · ')}>
      {cred.planta}
    </Badge>
  )
}

function CredencialesSummary({ credenciales, today }) {
  const counts = useMemo(() => {
    const c = { vigentes: 0, proximas: 0, caducadas: 0 }
    for (const cred of credenciales) {
      const state = credentialState(cred.fecha_caducidad, today)
      if (state === 'caducada') c.caducadas += 1
      else {
        c.vigentes += 1
        if (state === 'proxima') c.proximas += 1
      }
    }
    return c
  }, [credenciales, today])

  return (
    <div className="text-xs text-ink-500 dark:text-ink-400 flex gap-2 items-center mt-1">
      <span><strong>{credenciales.length}</strong> total</span>
      {counts.vigentes > 0 && (
        <>
          <span className="text-ink-300 dark:text-ink-600">·</span>
          <span>{counts.vigentes} vigentes</span>
        </>
      )}
      {counts.proximas > 0 && (
        <>
          <span className="text-ink-300 dark:text-ink-600">·</span>
          <span className="text-amber-700 dark:text-amber-400 font-medium">{counts.proximas} por vencer</span>
        </>
      )}
      {counts.caducadas > 0 && (
        <>
          <span className="text-ink-300 dark:text-ink-600">·</span>
          <span className="text-red-700 dark:text-red-400 font-medium">{counts.caducadas} caducadas</span>
        </>
      )}
    </div>
  )
}

function FichaModal({ open, onClose, trabajador, today }) {
  if (!trabajador) return null
  const fullName = `${trabajador.nombre || ''} ${trabajador.nombre_apellidos || ''}`.trim()

  return (
    <Modal open={open} onClose={onClose} size="lg" hideHeader bodyClassName="!p-0">
      <div className="bg-gradient-to-br from-brand-700 to-brand-500 px-6 py-6 flex flex-col items-center text-center rounded-t-xl relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-white/80 hover:text-white text-xl leading-none p-1"
          aria-label="Cerrar"
        >×</button>
        <AvatarFoto
          id={trabajador.id}
          hasFoto={Boolean(trabajador.foto_perfil)}
          name={fullName}
          size="lg"
        />
        <h3 className="mt-3 text-white text-lg font-semibold">{fullName}</h3>
        <span className="text-white/75 text-xs mt-0.5">No. {trabajador.no_empleado}</span>
      </div>

      <div className="px-6 py-5 space-y-5">
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400 border-b border-ink-200 dark:border-ink-800 pb-1.5 mb-2">
            Información general
          </h4>
          <dl className="text-sm">
            {[
              ['Puesto', trabajador.puesto],
              ['Área', trabajador.area],
              ['Tipo Pago', trabajador.tipo_nomina],
              ['Coord. a Cargo', trabajador.coord_a_cargo],
              ['Ubicación Proy.', trabajador.proyectos_activos || trabajador.ubicacion_actual],
              ['Estado', trabajador.ubicacion_estado],
              ['Celular', trabajador.celular],
              ...(trabajador.observaciones ? [['Observaciones', trabajador.observaciones]] : []),
            ].map(([label, value]) => (
              <div key={label} className="flex gap-4 py-1.5 border-b border-dashed border-ink-200 dark:border-ink-800 last:border-0">
                <dt className="text-ink-500 dark:text-ink-400 w-32 flex-shrink-0">{label}</dt>
                <dd className="text-ink-900 dark:text-ink-100 font-medium flex-1 break-words">{value || '—'}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400 border-b border-ink-200 dark:border-ink-800 pb-1.5 mb-2">
            Credenciales de planta
          </h4>
          {trabajador.credenciales?.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {trabajador.credenciales.map((c) => {
                const state = credentialState(c.fecha_caducidad, today)
                const Icon = state === 'caducada' ? XCircle : CheckCircle2
                const colorClass =
                  state === 'caducada'
                    ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-700/60 dark:text-red-300'
                    : state === 'proxima'
                      ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/30 dark:border-amber-700/60 dark:text-amber-300'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-700/60 dark:text-emerald-300'
                return (
                  <div key={`${c.planta}-${c.credencial_id}`} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm ${colorClass}`}>
                    <Icon size={14} />
                    <strong>{c.planta}</strong>
                    <span className="font-mono text-xs opacity-80">{c.credencial_id}</span>
                    {c.fecha_caducidad && (
                      <span className="text-xs opacity-70 ml-1">
                        ({state === 'caducada' ? 'Caducada' : 'Vence'}: {c.fecha_caducidad})
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-ink-400 dark:text-ink-500">Sin credenciales registradas</p>
          )}
        </section>
      </div>
    </Modal>
  )
}

function EditarCredencialesModal({ open, onClose, trabajador, onSaved, today }) {
  const [credenciales, setCredenciales] = useState([])
  const [observaciones, setObservaciones] = useState('')
  const [planta, setPlanta] = useState('CAET')
  const [plantaCustom, setPlantaCustom] = useState('')
  const [credId, setCredId] = useState('')
  const [caducidad, setCaducidad] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && trabajador) {
      setCredenciales(trabajador.credenciales ? [...trabajador.credenciales] : [])
      setObservaciones(trabajador.observaciones || '')
      setPlanta('CAET')
      setPlantaCustom('')
      setCredId('')
      setCaducidad('')
      setError('')
    }
  }, [open, trabajador])

  if (!trabajador) return null

  const fullName = `${trabajador.nombre || ''} ${trabajador.nombre_apellidos || ''}`.trim()

  const handleAdd = () => {
    setError('')
    let plantaFinal = planta === 'OTRA' ? plantaCustom.trim().toUpperCase() : planta
    if (!plantaFinal) {
      setError('Especifica el nombre de la planta.')
      return
    }
    const idTrim = credId.trim()
    if (!idTrim) {
      setError('El ID de credencial es obligatorio.')
      return
    }
    if (idTrim.length > 40) {
      setError('El ID no puede superar 40 caracteres.')
      return
    }
    if (credenciales.find((c) => c.planta === plantaFinal)) {
      setError('Ya hay una credencial para esta planta.')
      return
    }
    setCredenciales([
      ...credenciales,
      { planta: plantaFinal, credencial_id: idTrim, fecha_caducidad: caducidad || null },
    ])
    setCredId('')
    setCaducidad('')
    if (planta === 'OTRA') {
      setPlantaCustom('')
      setPlanta('CAET')
    }
  }

  const handleRemove = (idx) => {
    setCredenciales(credenciales.filter((_, i) => i !== idx))
  }

  const handleSave = async () => {
    // Auto-capturar credencial pendiente si dejaron texto en credId
    let finalList = credenciales
    if (credId.trim()) {
      let plantaFinal = planta === 'OTRA' ? plantaCustom.trim().toUpperCase() : planta
      if (plantaFinal && !credenciales.find((c) => c.planta === plantaFinal)) {
        if (credId.trim().length > 40) {
          setError('El ID no puede superar 40 caracteres.')
          return
        }
        finalList = [
          ...credenciales,
          { planta: plantaFinal, credencial_id: credId.trim(), fecha_caducidad: caducidad || null },
        ]
      }
    }

    setSaving(true)
    setError('')
    try {
      await guardarCredencialesPlanta(trabajador.id, {
        credenciales: finalList,
        observaciones,
      })
      toast.success('Credenciales actualizadas')
      onSaved?.()
      onClose()
    } catch (err) {
      const msg = extractApiError(err, 'Error al guardar credenciales')
      setError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Credenciales de planta — ${fullName}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>Guardar credenciales</Button>
        </>
      }
    >
      <div className="space-y-5">
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800/60 dark:text-red-300">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select
            label="Planta"
            value={planta}
            onChange={(e) => setPlanta(e.target.value)}
          >
            {PLANTAS_PREDEF.map((p) => <option key={p} value={p}>{p === 'OTRA' ? 'OTRA…' : p}</option>)}
          </Select>
          <Input
            label="ID de credencial"
            value={credId}
            onChange={(e) => setCredId(e.target.value)}
            placeholder="Máx 40 chars"
            maxLength={40}
          />
          <Input
            label="Caducidad (opcional)"
            type="date"
            value={caducidad}
            onChange={(e) => setCaducidad(e.target.value)}
          />
        </div>

        {planta === 'OTRA' && (
          <Input
            label="Nombre de la planta"
            value={plantaCustom}
            onChange={(e) => setPlantaCustom(e.target.value.toUpperCase())}
            placeholder="Escribe la planta…"
          />
        )}

        <Button variant="secondary" size="md" leftIcon={<Plus size={14} />} onClick={handleAdd} className="w-full">
          Agregar credencial
        </Button>

        {credenciales.length > 0 && (
          <ul className="space-y-2">
            {credenciales.map((c, idx) => {
              const state = credentialState(c.fecha_caducidad, today)
              const isExpired = state === 'caducada'
              return (
                <li
                  key={`${c.planta}-${idx}`}
                  className={`flex items-center justify-between gap-3 px-3 py-2 rounded-md border ${
                    isExpired
                      ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/60'
                      : 'bg-ink-50 border-ink-200 dark:bg-ink-800/50 dark:border-ink-700'
                  }`}
                >
                  <div className="min-w-0 flex items-center gap-3 flex-wrap">
                    <strong className="text-ink-900 dark:text-ink-100">{c.planta}</strong>
                    <span className="font-mono text-xs text-ink-600 dark:text-ink-300">ID: {c.credencial_id}</span>
                    {c.fecha_caducidad && (
                      <Badge tone={stateToTone[state]}>
                        {state === 'caducada' ? 'Caducada' : 'Vigente'} ({c.fecha_caducidad})
                      </Badge>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    className="text-red-600 hover:text-red-700 dark:text-red-400 p-1 rounded focus-ring"
                    aria-label="Eliminar credencial"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <div>
          <label className="block text-xs font-medium text-ink-700 dark:text-ink-300 mb-1.5">
            Observaciones operativas
          </label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows={2}
            placeholder="Notas sobre el trabajador, permisos, pendientes…"
            className="block w-full px-3 py-2 border border-ink-300 dark:border-ink-700 bg-white dark:bg-ink-800 rounded-md text-sm text-ink-900 dark:text-ink-100 placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
          />
        </div>
      </div>
    </Modal>
  )
}

export default function CredencialesList() {
  const { isAdmin } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10))
  const [q, setQ] = useState(searchParams.get('q') || '')
  const [qInput, setQInput] = useState(q)

  const [fichaTrabajador, setFichaTrabajador] = useState(null)
  const [editTrabajador, setEditTrabajador] = useState(null)

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const {
    data: rawData,
    loading,
    error,
    refetch,
  } = useResource(
    ['credenciales', { page, q }],
    () => listarCredencialesPlanta({ page, q, perPage: PER_PAGE }),
    { staleMs: 30_000, invalidateOn: ['credencial:changed'] },
  )
  const data = rawData ?? { items: [], total: 0, page: 1, pages: 1 }

  useEffect(() => {
    if (error) toast.error(extractApiError(error, 'Error al cargar credenciales'))
  }, [error])

  const refresh = () => { refetch() }

  useEffect(() => {
    const next = new URLSearchParams()
    if (q) next.set('q', q)
    if (page !== 1) next.set('page', String(page))
    setSearchParams(next, { replace: true })
  }, [q, page])

  const onSearch = (e) => {
    e.preventDefault()
    setPage(1)
    setQ(qInput.trim())
  }

  return (
    <>
      <PageHeader
        icon={IdCard}
        title="Credenciales"
        description="Recuento de personal por ubicación y credenciales de planta."
      />

      <form onSubmit={onSearch} className="mb-4 flex flex-col sm:flex-row gap-2 sm:items-end max-w-2xl">
        <Input
          wrapperClassName="flex-1"
          label="Buscar"
          placeholder="Nombre, No. empleado o RFC"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          leftIcon={<Search size={15} />}
        />
        <div className="flex gap-2">
          <Button type="submit" variant="primary">Buscar</Button>
          {q && (
            <Button type="button" variant="ghost" onClick={() => { setQInput(''); setQ(''); setPage(1) }}>
              Limpiar
            </Button>
          )}
        </div>
      </form>

      <div className="mb-3 text-sm text-ink-500 dark:text-ink-400">
        Total registros: <strong className="text-ink-700 dark:text-ink-200">{data.total ?? 0}</strong>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={IdCard}
          title={q ? 'Sin resultados' : 'Sin trabajadores'}
          description={q ? 'Ningún trabajador coincide con la búsqueda.' : 'Aún no hay personal registrado.'}
        />
      ) : (
        <>
          <Table>
            <THead>
              <TH>No. Emp</TH>
              <TH>Empleado</TH>
              <TH>Área</TH>
              <TH>Credenciales</TH>
              <TH align="right">Acciones</TH>
            </THead>
            <TBody>
              {data.items.map((t) => (
                <TR key={t.id}>
                  <TD>
                    <span className="inline-block font-mono text-xs font-semibold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/30 px-2 py-0.5 rounded">
                      {t.no_empleado}
                    </span>
                  </TD>
                  <TD>
                    <div className="flex items-center gap-3">
                      <AvatarFoto
                        id={t.id}
                        hasFoto={Boolean(t.foto_perfil)}
                        name={`${t.nombre || ''} ${t.nombre_apellidos || ''}`}
                        size="sm"
                        lazy
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-ink-900 dark:text-ink-100 truncate">
                          {(t.nombre || '') + ' ' + (t.nombre_apellidos || '')}
                        </div>
                        {t.puesto && (
                          <div className="text-xs text-ink-500 dark:text-ink-400 truncate">{t.puesto}</div>
                        )}
                      </div>
                    </div>
                  </TD>
                  <TD>
                    {t.area
                      ? <Badge tone="neutral">{t.area}</Badge>
                      : <span className="text-xs text-ink-400">S/A</span>}
                  </TD>
                  <TD>
                    {t.credenciales?.length > 0 ? (
                      <div>
                        <div className="flex flex-wrap gap-1.5">
                          {t.credenciales.map((c) => (
                            <CredencialChip key={`${c.planta}-${c.credencial_id}`} cred={c} today={today} />
                          ))}
                        </div>
                        <CredencialesSummary credenciales={t.credenciales} today={today} />
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-ink-400 dark:text-ink-500 px-2.5 py-1 border border-dashed border-ink-300 dark:border-ink-700 rounded-full">
                        <IdCard size={12} /> Sin credenciales
                      </span>
                    )}
                  </TD>
                  <TD align="right">
                    <div className="inline-flex gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        leftIcon={<Eye size={14} />}
                        onClick={() => setFichaTrabajador(t)}
                      >
                        Ver ficha
                      </Button>
                      {isAdmin && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title="Editar credenciales"
                          onClick={() => setEditTrabajador(t)}
                        >
                          <Pencil size={14} />
                        </Button>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>

          <Pagination
            page={(data.page || 1) - 1}
            totalPages={data.pages || 1}
            totalElements={data.total ?? 0}
            size={data.per_page || PER_PAGE}
            onChange={(newZeroPage) => setPage(newZeroPage + 1)}
          />
        </>
      )}

      <FichaModal
        open={Boolean(fichaTrabajador)}
        onClose={() => setFichaTrabajador(null)}
        trabajador={fichaTrabajador}
        today={today}
      />

      <EditarCredencialesModal
        open={Boolean(editTrabajador)}
        onClose={() => setEditTrabajador(null)}
        trabajador={editTrabajador}
        onSaved={refresh}
        today={today}
      />
    </>
  )
}
