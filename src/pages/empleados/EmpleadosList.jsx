import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Plus, Search, Upload, Download, Pencil, UserMinus, UserCheck,
  FileSpreadsheet, Users as UsersIcon, Eye, ArrowLeft, IdCard,
} from 'lucide-react'
import {
  PageHeader, Button, Input, Table, THead, TH, TBody, TR, TD,
  Badge, Pagination, EmptyState, ConfirmDialog, Skeleton,
} from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import {
  listarTrabajadores, darBajaTrabajador, reactivarTrabajador,
  exportarTodos,
} from '../../api/trabajadores'
import AvatarFoto from '../../components/empleados/AvatarFoto'

const PER_PAGE = 20

function nominaTone(tipo) {
  const v = (tipo || '').toLowerCase()
  if (v === 'semanal') return 'brand'
  if (v === 'por hora') return 'info'
  if (v === 'cuadrado') return 'warning'
  return 'neutral'
}

function fmtFechaCorta(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return iso }
}

function fmtMoney(n) {
  if (n == null) return null
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(n)
}

export default function EmpleadosList({ variante = 'activos' }) {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10))
  const [q, setQ] = useState(searchParams.get('q') || '')
  const [qInput, setQInput] = useState(q)
  const [data, setData] = useState({ items: [], total: 0, page: 1, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [confirmId, setConfirmId] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null) // 'baja' | 'reactivar'
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)

  const titulo = variante === 'bajas' ? 'Empleados dados de baja' : 'Empleados'

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listarTrabajadores({ page, q, estado: variante, perPage: PER_PAGE })
      .then((res) => { if (!cancelled) setData(res) })
      .catch((err) => {
        if (cancelled) return
        toast.error(err.response?.data?.error || 'Error al cargar empleados')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [page, q, variante])

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

  const handleBaja = async () => {
    if (!confirmId) return
    setBusy(true)
    try {
      if (confirmAction === 'baja') {
        await darBajaTrabajador(confirmId)
        toast.success('Empleado dado de baja')
      } else {
        await reactivarTrabajador(confirmId)
        toast.success('Empleado reactivado')
      }
      setConfirmId(null)
      const res = await listarTrabajadores({ page, q, estado: variante, perPage: PER_PAGE })
      setData(res)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error en la operación')
    } finally {
      setBusy(false)
    }
  }

  const onExport = async () => {
    setExporting(true)
    try {
      await exportarTodos()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al exportar')
    } finally {
      setExporting(false)
    }
  }

  const totalEmpleados = data.total ?? 0

  return (
    <>
      <PageHeader
        icon={UsersIcon}
        title={titulo}
        description={
          variante === 'bajas'
            ? 'Empleados inactivos o con fecha de baja registrada.'
            : 'Listado de empleados activos. Puedes buscar, exportar o dar de alta.'
        }
        breadcrumb={
          variante === 'bajas' ? (
            <Link to="/empleados" className="hover:underline inline-flex items-center gap-1">
              <ArrowLeft size={12} /> Volver a empleados activos
            </Link>
          ) : null
        }
        actions={
          variante === 'activos' ? (
            <div className="flex flex-wrap gap-2">
              {isAdmin && (
                <>
                  <Button variant="secondary" size="md" leftIcon={<Upload size={14} />} onClick={() => navigate('/empleados/importar')}>
                    Importar
                  </Button>
                  <Button variant="secondary" size="md" leftIcon={<Download size={14} />} loading={exporting} onClick={onExport}>
                    Exportar
                  </Button>
                  <Button variant="ghost" size="md" leftIcon={<UserMinus size={14} />} onClick={() => navigate('/empleados/bajas')}>
                    Ver bajas
                  </Button>
                </>
              )}
              <Button variant="primary" size="md" leftIcon={<Plus size={14} />} onClick={() => navigate('/empleados/nuevo')}>
                Nuevo
              </Button>
            </div>
          ) : null
        }
      />

      <form onSubmit={onSearch} className="mb-4 flex flex-col sm:flex-row gap-2 sm:items-end max-w-2xl">
        <Input
          wrapperClassName="flex-1"
          label="Buscar"
          placeholder="Nombre, apellidos, No. empleado o RFC"
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

      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title={q ? 'Sin resultados' : variante === 'bajas' ? 'Sin bajas registradas' : 'Sin empleados'}
          description={q ? 'Ningún empleado coincide con la búsqueda actual.' : 'Comienza dando de alta un empleado.'}
          action={!q && variante === 'activos' ? (
            <Button variant="primary" leftIcon={<Plus size={14} />} onClick={() => navigate('/empleados/nuevo')}>
              Nuevo empleado
            </Button>
          ) : null}
        />
      ) : (
        <>
          <Table>
            <THead>
              <TH>Empleado</TH>
              <TH>Área / Puesto</TH>
              <TH>Tipo nómina</TH>
              <TH align="right">Salario/sem</TH>
              <TH>Ingreso</TH>
              {variante === 'bajas' && <TH>Fecha baja</TH>}
              <TH align="right">Acciones</TH>
            </THead>
            <TBody>
              {data.items.map((t) => (
                <TR key={t.id}>
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
                        <div className="text-xs font-mono text-brand-700 dark:text-brand-300 mt-0.5">
                          #{t.no_empleado}
                        </div>
                      </div>
                    </div>
                  </TD>
                  <TD>
                    <div className="text-sm text-ink-800 dark:text-ink-200">{t.area || '—'}</div>
                    {t.puesto && <div className="text-xs text-ink-500 dark:text-ink-400">{t.puesto}</div>}
                  </TD>
                  <TD>
                    {t.tipo_nomina
                      ? <Badge tone={nominaTone(t.tipo_nomina)} dot>{t.tipo_nomina}</Badge>
                      : <span className="text-ink-400 text-xs">—</span>}
                  </TD>
                  <TD align="right">
                    {t.salario_real_pactado_x_sem
                      ? <span className="font-mono text-emerald-700 dark:text-emerald-400">{fmtMoney(t.salario_real_pactado_x_sem)}</span>
                      : <span className="text-red-600 dark:text-red-400 text-xs font-medium">sin salario</span>}
                  </TD>
                  <TD>
                    <span className="text-sm">{fmtFechaCorta(t.fecha_ingreso)}</span>
                  </TD>
                  {variante === 'bajas' && <TD><span className="text-sm">{fmtFechaCorta(t.fecha_baja)}</span></TD>}
                  <TD align="right">
                    <div className="inline-flex gap-1">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        title="Ver ficha"
                        onClick={() => navigate(`/empleados/${t.id}`)}
                      >
                        <Eye size={14} />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        title="Editar"
                        onClick={() => navigate(`/empleados/${t.id}/editar`)}
                      >
                        <Pencil size={14} />
                      </Button>
                      {isAdmin && variante === 'activos' && (
                        <Button
                          size="icon-sm"
                          variant="danger-ghost"
                          title="Dar de baja"
                          onClick={() => { setConfirmId(t.id); setConfirmAction('baja') }}
                        >
                          <UserMinus size={14} />
                        </Button>
                      )}
                      {isAdmin && variante === 'bajas' && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title="Reactivar"
                          onClick={() => { setConfirmId(t.id); setConfirmAction('reactivar') }}
                        >
                          <UserCheck size={14} />
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
            totalElements={totalEmpleados}
            size={data.per_page || PER_PAGE}
            onChange={(newZeroPage) => setPage(newZeroPage + 1)}
          />
        </>
      )}

      <ConfirmDialog
        open={confirmId !== null}
        onClose={() => setConfirmId(null)}
        onConfirm={handleBaja}
        loading={busy}
        title={confirmAction === 'baja' ? 'Dar de baja' : 'Reactivar empleado'}
        description={confirmAction === 'baja'
          ? 'El empleado pasará a la lista de bajas y dejará de aparecer en las operaciones activas. ¿Continuar?'
          : 'El empleado volverá a aparecer en las operaciones activas. ¿Continuar?'}
        confirmLabel={confirmAction === 'baja' ? 'Dar de baja' : 'Reactivar'}
        tone={confirmAction === 'baja' ? 'danger' : 'warning'}
      />
    </>
  )
}
