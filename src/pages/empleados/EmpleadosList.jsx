import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Plus, Search, Upload, Download, Pencil, UserMinus, UserCheck,
  FileSpreadsheet, Users as UsersIcon, Eye, ArrowLeft, IdCard, X,
  MoreHorizontal, FileDown, SlidersHorizontal, Info,
} from 'lucide-react'
import {
  PageHeader, Button, Input, Select, Table, THead, TH, THSort, TBody, TR, TD,
  Pagination, EmptyState, ConfirmDialog, Skeleton, SavedViews, InfoTip,
} from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import {
  listarTrabajadores, darBajaTrabajador, reactivarTrabajador,
  exportarTodos, bulkAccionTrabajadores, exportarSeleccion,
  exportarEmpleado, obtenerFiltrosTrabajadores,
} from '../../api/trabajadores'
import AvatarFoto from '../../components/empleados/AvatarFoto'
import CredencialPreviewModal from '../../components/empleados/CredencialPreviewModal'
import { obtenerTrabajador } from '../../api/trabajadores'
import { useResource } from '../../hooks/useResource'
import { useSocket } from '../../context/SocketContext'
import { fmtFecha } from '../../utils/format'

const PER_PAGE = 20

// `fecha_ingreso` y `fecha_baja` son `db.Date` en el backend, o sea "AAAA-MM-DD"
// sin hora. El `new Date(iso)` que había aquí las leía como medianoche UTC y en
// México pintaba el día ANTERIOR: un ingreso del día 1 aparecía como día 30 del
// mes pasado. `fmtFecha` ancla ese caso al huso local.
const fmtFechaCorta = fmtFecha

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
  // Orden por columna, sincronizado a la URL para que un link compartido
  // reproduzca la misma vista. sort vacío = default del backend (nombre asc).
  const [sort, setSort] = useState(searchParams.get('sort') || '')
  const [dir, setDir] = useState(searchParams.get('dir') || 'asc')

  // Filtros avanzados (combinables entre sí y con la búsqueda). Se inicializan
  // desde la URL para que un link compartido o un refresh reproduzcan la misma
  // vista filtrada. Las opciones de los selects las sirve GET /trabajadores/filtros.
  const [filtros, setFiltros] = useState({
    area: searchParams.get('area') || '',
    puesto: searchParams.get('puesto') || '',
    tipoNomina: searchParams.get('tipo_nomina') || '',
    tipoPago: searchParams.get('tipo_pago') || '',
    sinSalario: searchParams.get('sin_salario') === '1',
  })
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  const [opcionesFiltro, setOpcionesFiltro] = useState({ areas: [], puestos: [], tipos_nomina: [], tipos_pago: [] })
  useEffect(() => {
    obtenerFiltrosTrabajadores().then(setOpcionesFiltro).catch(() => {})
  }, [])
  const filtrosActivos =
    (filtros.area ? 1 : 0) + (filtros.puesto ? 1 : 0) +
    (filtros.tipoNomina ? 1 : 0) + (filtros.tipoPago ? 1 : 0) +
    (filtros.sinSalario ? 1 : 0)
  // Cambiar un filtro vuelve a página 1 (la pág. N de un filtro no equivale a la
  // de otro). La selección NO se limpia: es acumulativa entre filtros a propósito.
  const setFiltro = (key, value) => {
    setPage(1)
    setFiltros((f) => ({ ...f, [key]: value }))
  }
  const limpiarFiltros = () => {
    setPage(1)
    setFiltros({ area: '', puesto: '', tipoNomina: '', tipoPago: '', sinSalario: false })
  }

  const [confirmId, setConfirmId] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null) // 'baja' | 'reactivar'
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Modal de credencial — se llena cuando el usuario pide "Mostrar credencial"
  // desde el menú de fila. La lista solo trae datos parciales (no incluye
  // qr_code, foto_perfil, tipo_sangre, etc.), así que pedimos el detalle
  // completo lazy antes de abrir el modal.
  const [credencialTrabajador, setCredencialTrabajador] = useState(null)
  const [loadingCredencial, setLoadingCredencial] = useState(null) // id
  // Export individual desde fila (loading per-row).
  const [exportingId, setExportingId] = useState(null)

  const abrirCredencial = async (t) => {
    setLoadingCredencial(t.id)
    try {
      const detalle = await obtenerTrabajador(t.id)
      setCredencialTrabajador({
        ...detalle,
        nombre_completo: `${detalle.nombre || ''} ${detalle.nombre_apellidos || ''}`.trim(),
      })
    } catch {
      toast.error('No se pudo cargar la credencial')
    } finally {
      setLoadingCredencial(null)
    }
  }

  // Selección múltiple. Per-página: cambiar de página/búsqueda limpia la
  // selección para evitar acciones sorpresa sobre filas que ya no se ven.
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [busyBulk, setBusyBulk] = useState(false)
  const [exportingSel, setExportingSel] = useState(false)
  const headerCbRef = useRef(null)

  const titulo = variante === 'bajas' ? 'Empleados dados de baja' : 'Empleados'

  const {
    data: rawData,
    loading,
    error,
    refetch,
  } = useResource(
    ['empleados', { page, q, variante, sort, dir, ...filtros }],
    () => listarTrabajadores({
      page, q, estado: variante, perPage: PER_PAGE, sort, dir,
      area: filtros.area, puesto: filtros.puesto,
      tipoNomina: filtros.tipoNomina, tipoPago: filtros.tipoPago,
      sinSalario: filtros.sinSalario,
    }),
    {
      staleMs: 30_000,
      // El backend emite 'empleado:changed' en cada mutación (crear, editar,
      // baja, reactivar, bulk, import); al invalidarse se refetchea esta
      // misma key, así el orden y los filtros activos sobreviven al refresh.
      invalidateOn: ['empleado:changed'],
    },
  )
  const data = rawData ?? { items: [], total: 0, page: 1, pages: 1 }

  useEffect(() => {
    if (error) toast.error(error.response?.data?.error || 'Error al cargar empleados')
  }, [error])

  useEffect(() => {
    const next = new URLSearchParams()
    if (q) next.set('q', q)
    if (page !== 1) next.set('page', String(page))
    if (sort) {
      next.set('sort', sort)
      next.set('dir', dir)
    }
    if (filtros.area) next.set('area', filtros.area)
    if (filtros.puesto) next.set('puesto', filtros.puesto)
    if (filtros.tipoNomina) next.set('tipo_nomina', filtros.tipoNomina)
    if (filtros.tipoPago) next.set('tipo_pago', filtros.tipoPago)
    if (filtros.sinSalario) next.set('sin_salario', '1')
    setSearchParams(next, { replace: true })
  }, [q, page, sort, dir, filtros])

  // Click en encabezado: asc → desc → quitar orden. Resetea a página 1 porque
  // la página N de un orden no corresponde a la página N de otro.
  const onSort = (field, nextDir) => {
    setPage(1)
    if (!nextDir) {
      setSort('')
      setDir('asc')
    } else {
      setSort(field)
      setDir(nextDir)
    }
  }

  // Aplicar una vista guardada (o volver al default al deseleccionarla).
  const aplicarVista = (params) => {
    setPage(1)
    setQ(params.q || '')
    setQInput(params.q || '')
    setSort(params.sort || '')
    setDir(params.dir || 'asc')
    setFiltros({
      area: params.area || '',
      puesto: params.puesto || '',
      tipoNomina: params.tipo_nomina || '',
      tipoPago: params.tipo_pago || '',
      sinSalario: params.sin_salario === '1' || params.sin_salario === true,
    })
  }

  // ── Selección múltiple ─────────────────────────────────────────────────────
  // Selección acumulativa entre páginas y búsquedas: el usuario puede armar
  // un lote navegando varias páginas o ajustando filtros sin perder lo que ya
  // marcó. Solo limpiamos al cambiar de `variante` (activos↔bajas) porque ese
  // sí es un cambio de scope semántico — los IDs de bajas no aplican a las
  // acciones de activos y viceversa. Para limpiar manualmente está el botón
  // "Limpiar" en la barra de selección.
  useEffect(() => { setSelectedIds(new Set()) }, [variante])

  // Podar IDs huérfanos: cuando otro admin (o tú desde otra pestaña) mueve
  // un trabajador fuera del scope actual (baja en variante=activos o
  // reactivación en variante=bajas), su ID ya no debe contar en la selección.
  // Sin esto, el contador queda inflado con IDs que la lista ya no muestra.
  const { on: onSocket } = useSocket()
  useEffect(() => {
    const off = onSocket('empleado:changed', (payload) => {
      if (!payload) return
      const action = payload.action
      const ids = payload.ids || (payload.id != null ? [payload.id] : [])
      if (!ids.length) return
      const fueraDeScope = (
        (variante === 'activos' && (action === 'baja' || action === 'bulk_baja')) ||
        (variante === 'bajas' && (action === 'reactivado' || action === 'bulk_reactivar'))
      )
      if (!fueraDeScope) return
      setSelectedIds((prev) => {
        let cambio = false
        const next = new Set(prev)
        for (const id of ids) {
          if (next.delete(id)) cambio = true
        }
        return cambio ? next : prev
      })
    })
    return off
  }, [onSocket, variante])

  const visibleIds = data.items.map((t) => t.id)
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id))
  const visibleSelectedCount = visibleIds.reduce((acc, id) => acc + (selectedIds.has(id) ? 1 : 0), 0)

  // El estado `indeterminate` solo se puede setear vía propiedad JS, no atributo.
  useEffect(() => {
    if (headerCbRef.current) {
      headerCbRef.current.indeterminate = someVisibleSelected && !allVisibleSelected
    }
  }, [someVisibleSelected, allVisibleSelected])

  const toggleOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id))
      } else {
        visibleIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  const onExportarSeleccion = async () => {
    if (selectedIds.size === 0) return
    setExportingSel(true)
    try {
      await exportarSeleccion(Array.from(selectedIds))
      toast.success(`Exportados ${selectedIds.size} empleado${selectedIds.size === 1 ? '' : 's'}`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al exportar selección')
    } finally {
      setExportingSel(false)
    }
  }

  const onBulkAction = async () => {
    const action = variante === 'activos' ? 'baja' : 'reactivar'
    setBusyBulk(true)
    try {
      const res = await bulkAccionTrabajadores({
        ids: Array.from(selectedIds),
        action,
      })
      const verbo = action === 'baja' ? 'dado de baja' : 'reactivado'
      const plural = res.affected === 1 ? '' : 's'
      toast.success(`${res.affected} empleado${plural} ${verbo}${plural}`)
      if (res.skipped?.length) {
        toast(`${res.skipped.length} omitido${res.skipped.length === 1 ? '' : 's'}`, { icon: <Info size={18} /> })
      }
      setSelectedIds(new Set())
      setConfirmBulk(false)
      await refetch()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error en operación en lote')
    } finally {
      setBusyBulk(false)
    }
  }

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
      await refetch()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error en la operación')
    } finally {
      setBusy(false)
    }
  }

  const onExport = async () => {
    setExporting(true)
    try {
      // Respeta la búsqueda y los filtros activos: "Exportar" baja justo lo que
      // se está viendo en la lista, no siempre la plantilla completa.
      await exportarTodos({ q, ...filtros })
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
        title={
          <span className="inline-flex items-center gap-1.5">
            {titulo}
            <InfoTip
              text={
                variante === 'bajas'
                  ? 'Empleados inactivos. Puedes reactivarlos de forma individual o en lote para devolverlos a las operaciones activas.'
                  : 'Plantilla activa. Busca por nombre, número o RFC; ordena por cualquier columna; selecciona varias filas para acciones en lote; e importa o exporta a Excel.'
              }
            />
          </span>
        }
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
                  <Button
                    variant="secondary"
                    size="md"
                    leftIcon={<Download size={14} />}
                    loading={exporting}
                    onClick={onExport}
                    title={(q || filtrosActivos > 0) ? 'Exporta solo los empleados que coinciden con la búsqueda y filtros actuales' : 'Exporta toda la plantilla activa'}
                  >
                    {(q || filtrosActivos > 0) ? 'Exportar filtrado' : 'Exportar'}
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

      {/* Filtros avanzados — combinables con la búsqueda y persistibles como vista */}
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            leftIcon={<SlidersHorizontal size={14} />}
            onClick={() => setFiltrosAbiertos((v) => !v)}
          >
            Filtros{filtrosActivos > 0 ? ` (${filtrosActivos})` : ''}
          </Button>
          {filtrosActivos > 0 && (
            <Button type="button" variant="ghost" size="sm" leftIcon={<X size={14} />} onClick={limpiarFiltros}>
              Limpiar filtros
            </Button>
          )}
        </div>

        {filtrosAbiertos && (
          <div className="mt-3 p-4 rounded-xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Select label="Área" value={filtros.area} onChange={(e) => setFiltro('area', e.target.value)}>
              <option value="">Todas</option>
              {opcionesFiltro.areas.map((a) => <option key={a} value={a}>{a}</option>)}
            </Select>
            <Select label="Puesto" value={filtros.puesto} onChange={(e) => setFiltro('puesto', e.target.value)}>
              <option value="">Todos</option>
              {opcionesFiltro.puestos.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
            <Select label="Tipo de nómina" value={filtros.tipoNomina} onChange={(e) => setFiltro('tipoNomina', e.target.value)}>
              <option value="">Todos</option>
              {opcionesFiltro.tipos_nomina.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Select label="Tipo de pago" value={filtros.tipoPago} onChange={(e) => setFiltro('tipoPago', e.target.value)}>
              <option value="">Todos</option>
              {opcionesFiltro.tipos_pago.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            <label className="inline-flex items-center gap-2 text-sm text-ink-700 dark:text-ink-300 sm:col-span-2 lg:col-span-4">
              <input
                type="checkbox"
                checked={filtros.sinSalario}
                onChange={(e) => setFiltro('sinSalario', e.target.checked)}
                className="h-4 w-4 rounded border-ink-300 dark:border-ink-600 text-brand-600 focus:ring-brand-500 cursor-pointer"
              />
              Solo empleados sin salario pactado
            </label>
          </div>
        )}
      </div>

      <SavedViews
        listKey={variante === 'bajas' ? 'empleados-bajas' : 'empleados'}
        current={{
          q, sort, dir: sort ? dir : '',
          area: filtros.area, puesto: filtros.puesto,
          tipo_nomina: filtros.tipoNomina, tipo_pago: filtros.tipoPago,
          sin_salario: filtros.sinSalario ? '1' : '',
        }}
        defaults={{ q: '', sort: '', dir: '', area: '', puesto: '', tipo_nomina: '', tipo_pago: '', sin_salario: '' }}
        onApply={aplicarVista}
      />

      {isAdmin && selectedIds.size > 0 && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-900 dark:text-brand-100">
            {selectedIds.size} seleccionado{selectedIds.size === 1 ? '' : 's'}
            {selectedIds.size > visibleSelectedCount && (
              <span className="ml-1 text-xs font-normal text-brand-700 dark:text-brand-300">
                ({visibleSelectedCount} en esta vista)
              </span>
            )}
            <InfoTip text="La selección se acumula entre páginas y búsquedas: puedes armar el lote navegando varias vistas sin perder lo ya marcado. Usa Limpiar para reiniciarla." />
          </span>
          <div className="flex-1" />
          {variante === 'activos' && (
            <Button
              variant="danger"
              size="sm"
              leftIcon={<UserMinus size={14} />}
              onClick={() => setConfirmBulk(true)}
            >
              Dar de baja
            </Button>
          )}
          {variante === 'bajas' && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<UserCheck size={14} />}
              onClick={() => setConfirmBulk(true)}
            >
              Reactivar
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Download size={14} />}
            loading={exportingSel}
            onClick={onExportarSeleccion}
          >
            Exportar selección
          </Button>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<X size={14} />}
            onClick={() => setSelectedIds(new Set())}
          >
            Limpiar
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title={(q || filtrosActivos > 0) ? 'Sin resultados' : variante === 'bajas' ? 'Sin bajas registradas' : 'Sin empleados'}
          description={(q || filtrosActivos > 0) ? 'Ningún empleado coincide con la búsqueda o los filtros actuales.' : 'Comienza dando de alta un empleado.'}
          action={(q || filtrosActivos > 0) ? (
            <Button variant="ghost" leftIcon={<X size={14} />} onClick={() => { setQInput(''); setQ(''); limpiarFiltros() }}>
              Limpiar búsqueda y filtros
            </Button>
          ) : variante === 'activos' ? (
            <Button variant="primary" leftIcon={<Plus size={14} />} onClick={() => navigate('/empleados/nuevo')}>
              Nuevo empleado
            </Button>
          ) : null}
        />
      ) : (
        <>
          <Table>
            <THead>
              {isAdmin && (
                <TH className="w-10">
                  <input
                    ref={headerCbRef}
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    aria-label="Seleccionar todos los visibles"
                    className="h-4 w-4 rounded border-ink-300 dark:border-ink-600 text-brand-600 focus:ring-brand-500 cursor-pointer"
                  />
                </TH>
              )}
              <THSort field="nombre" sort={sort} dir={dir} onSort={onSort}>Empleado</THSort>
              <THSort field="area" sort={sort} dir={dir} onSort={onSort}>Área / Puesto</THSort>
              <THSort field="tipo_nomina" sort={sort} dir={dir} onSort={onSort}>Tipo nómina</THSort>
              <THSort field="salario" sort={sort} dir={dir} onSort={onSort} align="right">Salario/sem</THSort>
              <THSort field="ingreso" sort={sort} dir={dir} onSort={onSort}>Ingreso</THSort>
              {variante === 'bajas' && <THSort field="baja" sort={sort} dir={dir} onSort={onSort}>Fecha baja</THSort>}
              <TH align="right">Acciones</TH>
            </THead>
            <TBody>
              {data.items.map((t) => (
                <TR key={t.id}>
                  {isAdmin && (
                    <TD className="w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(t.id)}
                        onChange={() => toggleOne(t.id)}
                        aria-label={`Seleccionar ${t.nombre || ''} ${t.nombre_apellidos || ''}`.trim()}
                        className="h-4 w-4 rounded border-ink-300 dark:border-ink-600 text-brand-600 focus:ring-brand-500 cursor-pointer"
                      />
                    </TD>
                  )}
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
                    <div className="text-sm text-ink-800 dark:text-ink-200">{t.tipo_nomina || '—'}</div>
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
                    <RowActionsMenu
                      // El pager de la ficha (‹ x/y ›) recibe los ids visibles
                      // de esta página para hojear sin volver a la lista.
                      onView={() => navigate(`/empleados/${t.id}`, { state: { pager: { ids: visibleIds } } })}
                      onEdit={() => navigate(`/empleados/${t.id}/editar`)}
                      onShowQr={() => abrirCredencial(t)}
                      loadingQr={loadingCredencial === t.id}
                      onExport={async () => {
                        setExportingId(t.id)
                        try {
                          await exportarEmpleado(t.id, `${t.no_empleado}_${t.nombre_apellidos || ''}.xlsx`)
                        } catch {
                          toast.error('No se pudo exportar')
                        } finally {
                          setExportingId(null)
                        }
                      }}
                      exporting={exportingId === t.id}
                      isAdmin={isAdmin}
                      onBaja={
                        variante === 'activos'
                          ? () => { setConfirmId(t.id); setConfirmAction('baja') }
                          : null
                      }
                      onReactivar={
                        variante === 'bajas'
                          ? () => { setConfirmId(t.id); setConfirmAction('reactivar') }
                          : null
                      }
                    />
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

      <ConfirmDialog
        open={confirmBulk}
        onClose={() => setConfirmBulk(false)}
        onConfirm={onBulkAction}
        loading={busyBulk}
        title={
          variante === 'activos'
            ? `Dar de baja a ${selectedIds.size} empleado${selectedIds.size === 1 ? '' : 's'}`
            : `Reactivar ${selectedIds.size} empleado${selectedIds.size === 1 ? '' : 's'}`
        }
        description={
          variante === 'activos'
            ? 'Los empleados seleccionados pasarán a la lista de bajas y dejarán de aparecer en las operaciones activas. ¿Continuar?'
            : 'Los empleados seleccionados volverán a aparecer en las operaciones activas. ¿Continuar?'
        }
        confirmLabel={variante === 'activos' ? 'Dar de baja' : 'Reactivar'}
        tone={variante === 'activos' ? 'danger' : 'warning'}
      />

      <CredencialPreviewModal
        open={credencialTrabajador !== null}
        onClose={() => setCredencialTrabajador(null)}
        trabajador={credencialTrabajador}
      />
    </>
  )
}

// ── Quick actions por fila ──────────────────────────────────────────────────
// Menú con: Ver, Editar, QR, Exportar individual, y la acción de baja/reactivar
// según corresponda. Para no romper la sensación rápida con teclado, el
// botón "Ver" sigue siendo accesible como acción primaria por separado.

function RowActionsMenu({
  onView, onEdit, onShowQr, loadingQr, onExport, exporting, isAdmin, onBaja, onReactivar,
}) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (!wrapperRef.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="inline-flex items-center gap-1" ref={wrapperRef}>
      <Button size="icon-sm" variant="ghost" title="Ver ficha" onClick={onView}>
        <Eye size={14} />
      </Button>
      <div className="relative">
        <Button
          size="icon-sm"
          variant="ghost"
          title="Más acciones"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <MoreHorizontal size={14} />
        </Button>
        {open && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-1 z-30 w-56 rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 shadow-lg py-1"
          >
            <MenuAction icon={Pencil} label="Editar" onClick={() => { setOpen(false); onEdit() }} />
            <MenuAction
              icon={IdCard}
              label={loadingQr ? 'Cargando…' : 'Mostrar credencial'}
              disabled={loadingQr}
              onClick={() => { setOpen(false); onShowQr() }}
            />
            <MenuAction
              icon={FileDown}
              label={exporting ? 'Exportando…' : 'Exportar a Excel'}
              disabled={exporting}
              onClick={() => { setOpen(false); onExport() }}
            />
            {isAdmin && onBaja && (
              <>
                <div className="my-1 border-t border-ink-100 dark:border-ink-800" />
                <MenuAction
                  icon={UserMinus}
                  label="Dar de baja"
                  danger
                  onClick={() => { setOpen(false); onBaja() }}
                />
              </>
            )}
            {isAdmin && onReactivar && (
              <>
                <div className="my-1 border-t border-ink-100 dark:border-ink-800" />
                <MenuAction
                  icon={UserCheck}
                  label="Reactivar"
                  onClick={() => { setOpen(false); onReactivar() }}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function MenuAction({ icon: Icon, label, onClick, disabled = false, danger = false }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors focus-ring disabled:opacity-50 disabled:cursor-not-allowed ${
        danger
          ? 'text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
          : 'text-ink-700 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-ink-800/60'
      }`}
    >
      <Icon size={14} className="flex-shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  )
}
