import { useMemo, useState, memo } from 'react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, LabelList,
} from 'recharts'

// Gráficas corporativas compartidas (Dashboard, Métricas…). Vivían dentro de
// Dashboard.jsx; se extrajeron para que todas las páginas usen el MISMO
// lenguaje visual: paleta navy monocromática, tooltips estructurados con
// participación %, donut con centro informativo + leyenda interactiva y
// barras horizontales con degradado.
//
// Contrato de datos: [{ label, value, color? }] — `color` opcional fuerza el
// tono de esa categoría (útil en binarias tipo Con/Sin); si falta, se asigna
// el degradado navy por jerarquía (mayor valor = tono más saturado).

// Paleta monocromática corporativa: degradado de azul navy (brand) de oscuro
// a claro. Estilo enterprise SaaS — el orden importa: la primera categoría
// (la de mayor peso) recibe el tono más saturado.
export const CHART_COLORS = [
  '#1f3554', // brand-800
  '#2b4870', // brand-700
  '#345a89', // brand-600
  '#4471a3', // brand-500
  '#688fbc', // brand-400
  '#9ab6d6', // brand-300
  '#c5d6e9', // brand-200
]
export const BRAND_PRIMARY = '#345a89'      // brand-600
export const BRAND_PRIMARY_DARK = '#688fbc' // brand-400 para modo oscuro

export const ChartTooltip = memo(function ChartTooltip({ active, payload, isDark, total, valueLabel = 'Empleados' }) {
  if (!active || !payload?.length) return null
  const value = payload[0].value
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : null
  return (
    <div
      className="rounded-md px-3 py-2 text-xs shadow-elevated border min-w-[160px]"
      style={{
        background: isDark ? '#1e293b' : '#ffffff',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        color: isDark ? '#f1f5f9' : '#0f172a',
      }}
    >
      <div className="flex items-center gap-2 mb-1.5 pb-1.5 border-b" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
        <span
          className="inline-block h-2.5 w-2.5 rounded-sm flex-shrink-0"
          style={{ background: payload[0].payload?.fill || payload[0].color || BRAND_PRIMARY }}
        />
        <p className="font-semibold truncate">{payload[0].name || payload[0].payload.label}</p>
      </div>
      <div className="flex items-baseline justify-between gap-3 tabular-nums">
        <span className="text-ink-500 dark:text-ink-400">{valueLabel}</span>
        <strong className="text-sm">{value}</strong>
      </div>
      {pct !== null && (
        <div className="flex items-baseline justify-between gap-3 tabular-nums mt-0.5">
          <span className="text-ink-500 dark:text-ink-400">Participación</span>
          <strong className="text-sm">{pct}%</strong>
        </div>
      )}
    </div>
  )
})

export const DonutCorporativo = memo(function DonutCorporativo({
  data, isDark, valueLabel = 'Empleados', centerLabel = 'Empleados',
  emptyText = 'Sin datos registrados',
}) {
  // Ordenar de mayor a menor para que el degradado navy refleje la jerarquía.
  const sorted = useMemo(
    () => [...(data || [])].sort((a, b) => (b.value || 0) - (a.value || 0)),
    [data],
  )
  const total = useMemo(() => sorted.reduce((s, d) => s + (d.value || 0), 0), [sorted])

  const [hoverIdx, setHoverIdx] = useState(null)
  const [pinnedIdx, setPinnedIdx] = useState(null)
  const activeIdx = hoverIdx ?? pinnedIdx
  const activeItem = activeIdx != null ? sorted[activeIdx] : null
  const activePct = activeItem && total > 0 ? (activeItem.value / total) * 100 : null

  if (!sorted.length || total === 0) {
    return <p className="text-sm text-ink-500 italic text-center py-10">{emptyText}</p>
  }

  const toggle = (i) => setPinnedIdx((prev) => (prev === i ? null : i))
  const colorOf = (item, i) => item.color || CHART_COLORS[i % CHART_COLORS.length]

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
      {/* Donut — más compacto, sin gap doble por strokeWidth+paddingAngle */}
      <div className="relative flex-shrink-0 w-[170px] h-[170px]">
        <ResponsiveContainer width="100%" height="100%" debounce={200}>
          <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Pie
              data={sorted}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={54}
              outerRadius={78}
              paddingAngle={sorted.length > 1 ? 0.5 : 0}
              stroke={isDark ? '#0f172a' : '#ffffff'}
              strokeWidth={1}
              isAnimationActive={false}
              onMouseEnter={(_, i) => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              onClick={(_, i) => toggle(i)}
            >
              {sorted.map((item, i) => {
                const isActive = activeIdx === i
                const isDimmed = activeIdx != null && !isActive
                return (
                  <Cell
                    key={i}
                    fill={colorOf(item, i)}
                    fillOpacity={isDimmed ? 0.28 : 1}
                    style={{ cursor: 'pointer', transition: 'fill-opacity 150ms ease' }}
                  />
                )
              })}
            </Pie>
            <Tooltip content={<ChartTooltip isDark={isDark} total={total} valueLabel={valueLabel} />} isAnimationActive={false} />
          </PieChart>
        </ResponsiveContainer>
        {/* Centro: usa el diámetro interno (108px) para evitar desborde sobre el aro */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center justify-center text-center w-[108px]">
            {activeItem ? (
              <>
                <span className="text-[9px] uppercase tracking-wider font-medium text-ink-500 dark:text-ink-400 leading-tight line-clamp-2 px-1" title={activeItem.label}>
                  {activeItem.label}
                </span>
                <span className="text-lg font-semibold tabular-nums text-ink-900 dark:text-ink-100 leading-none mt-1">
                  {activeItem.value}
                </span>
                <span className="text-[10px] tabular-nums font-medium text-brand-600 dark:text-sky-300 mt-0.5">
                  {activePct.toFixed(1)}%
                </span>
              </>
            ) : (
              <>
                <span className="text-xl font-semibold tabular-nums text-ink-900 dark:text-ink-100 leading-none">{total}</span>
                <span className="text-[9px] uppercase tracking-wider font-medium text-ink-500 dark:text-ink-400 mt-1">{centerLabel}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Leyenda — al lado del donut en sm+, debajo en móvil. Ancho contenido (no flex-1) para que el grupo donut+leyenda quede centrado horizontalmente. */}
      <ul className="w-full sm:w-auto sm:max-w-[280px] sm:min-w-[200px] space-y-0.5 max-h-[170px] overflow-y-auto scrollbar-thin pr-1 min-w-0">
        {sorted.map((item, i) => {
          const pct = total > 0 ? (item.value / total) * 100 : 0
          const isActive = activeIdx === i
          const isDimmed = activeIdx != null && !isActive
          return (
            <li key={i}>
              <button
                type="button"
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
                onClick={() => toggle(i)}
                className={`w-full flex items-center gap-2 text-[11px] px-1.5 py-1 rounded transition-colors ${
                  isActive
                    ? 'bg-ink-100 dark:bg-ink-800'
                    : 'hover:bg-ink-50 dark:hover:bg-ink-800/60'
                } ${isDimmed ? 'opacity-50' : ''}`}
              >
                <span
                  className="inline-block h-2 w-2 rounded-sm flex-shrink-0"
                  style={{ background: colorOf(item, i) }}
                />
                <span className="flex-1 truncate text-ink-700 dark:text-ink-300 text-left" title={item.label}>{item.label}</span>
                <span className="tabular-nums font-semibold text-ink-900 dark:text-ink-100">{item.value}</span>
                <span className="tabular-nums text-ink-500 dark:text-ink-400 w-9 text-right">{pct.toFixed(1)}%</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
})

export const BarrasCorporativas = memo(function BarrasCorporativas({
  data, isDark, valueLabel = 'Empleados', emptyText = 'Sin datos registrados',
  gradientId = 'corp-bar-gradient',
}) {
  // Ordenado descendente para que las barras más largas estén arriba —
  // patrón estándar en dashboards corporativos.
  const sorted = useMemo(
    () => [...(data || [])].sort((a, b) => (b.value || 0) - (a.value || 0)),
    [data],
  )
  const total = useMemo(() => sorted.reduce((s, d) => s + (d.value || 0), 0), [sorted])
  const primary = isDark ? BRAND_PRIMARY_DARK : BRAND_PRIMARY

  const [hoverIdx, setHoverIdx] = useState(null)

  if (!sorted.length) {
    return <p className="text-sm text-ink-500 italic text-center py-10">{emptyText}</p>
  }

  // Altura por barra suficiente para que el texto Y (fontSize 11) no se encime.
  // 26px da ~13px de aire entre labels consecutivas.
  const height = Math.min(340, Math.max(220, sorted.length * 26 + 20))
  // Tick personalizado: envuelve a 2 líneas por palabras cuando el label
  // excede ~22 chars; corta con elipsis solo cuando la segunda línea no cabe.
  const renderYTick = ({ x, y, payload }) => {
    const raw = String(payload?.value ?? '')
    const MAX = 22
    let line1 = raw
    let line2 = ''
    if (raw.length > MAX) {
      const words = raw.split(' ')
      line1 = ''
      let rest = []
      for (const w of words) {
        const next = (line1 ? `${line1} ${w}` : w)
        if (next.length <= MAX) line1 = next
        else rest.push(w)
      }
      // Si la primera palabra ya excede MAX, recorta crudo
      if (!line1) {
        line1 = raw.slice(0, MAX - 1) + '…'
        line2 = ''
      } else {
        line2 = rest.join(' ')
        if (line2.length > MAX) line2 = line2.slice(0, MAX - 1) + '…'
      }
    }
    const fill = isDark ? '#cbd5e1' : '#334155'
    return (
      <g transform={`translate(${x},${y})`}>
        <text textAnchor="end" fill={fill} fontSize={11}>
          {line2 ? (
            <>
              <tspan x={-6} dy="-0.25em">{line1}</tspan>
              <tspan x={-6} dy="1.15em">{line2}</tspan>
            </>
          ) : (
            <tspan x={-6} dy="0.355em">{line1}</tspan>
          )}
        </text>
      </g>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height} debounce={200}>
      <BarChart
        data={sorted}
        layout="vertical"
        margin={{ top: 4, right: 30, bottom: 4, left: 2 }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={primary} stopOpacity={0.85} />
            <stop offset="100%" stopColor={primary} stopOpacity={1} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} horizontal={false} />
        <XAxis
          type="number"
          allowDecimals={false}
          tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#64748b' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={renderYTick}
          width={150}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
        <Tooltip
          content={<ChartTooltip isDark={isDark} total={total} valueLabel={valueLabel} />}
          cursor={{ fill: isDark ? 'rgba(30,41,59,0.5)' : 'rgba(248,250,252,0.8)' }}
          isAnimationActive={false}
        />
        <Bar
          dataKey="value"
          fill={`url(#${gradientId})`}
          radius={[0, 3, 3, 0]}
          isAnimationActive={false}
          barSize={14}
          onMouseEnter={(_, i) => setHoverIdx(i)}
        >
          {sorted.map((_, i) => {
            const isDimmed = hoverIdx != null && hoverIdx !== i
            return (
              <Cell
                key={i}
                fillOpacity={isDimmed ? 0.3 : 1}
                style={{ cursor: 'pointer', transition: 'fill-opacity 150ms ease' }}
              />
            )
          })}
          <LabelList
            dataKey="value"
            position="right"
            style={{
              fill: isDark ? '#cbd5e1' : '#334155',
              fontSize: 11,
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
})
