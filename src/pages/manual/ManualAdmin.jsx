import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen, Search, ChevronDown, ChevronUp, ArrowUp, Printer, Star, Info,
  Route, FileSpreadsheet, Calculator, Lock, HandCoins, Sliders, Table as TableIcon, CheckCheck,
  CheckCircle2, XCircle, AlertTriangle, Ban, Lightbulb, PlayCircle, Edit3,
  DollarSign, Clock, Zap, Car, Home, History, Calendar, RefreshCw,
  Eye, Plus, Key, CalendarCheck, FileText, X, Sigma, MousePointerClick,
} from 'lucide-react'
import { PageHeader, Input, Badge } from '../../components/ui'

// ── Contenido del manual ─────────────────────────────────────────────────────
// Estructurado como data para poder buscar y renderizar dinámicamente.

const SECCIONES = [
  {
    id: 'flujo',
    num: 1,
    title: 'Flujo General del Proceso',
    icon: Route,
    accent: 'blue',
    intro: 'El orden correcto de operación es fundamental para que los descuentos y abonos se apliquen sin diferencias.',
    blocks: [
      {
        type: 'steps',
        items: [
          'Capturar y cerrar las horas de la semana.',
          ['Generar la vista previa de prenómina desde el menú ', { strong: 'Prenómina' }, '.'],
          ['Guardar la prenómina semanal — queda en estado ', { badge: 'abierta', label: 'ABIERTA' }, '.'],
          'Mientras está abierta, aplicar ajustes: descuentos manuales, depósitos extra, viáticos y festivos.',
          ['Validar todos los netos y presionar ', { strong: 'Cerrar Nómina Global' }, '.'],
          ['Al cerrarla pasa a ', { badge: 'aprobado', label: 'APROBADO' }, ' y se aplican definitivamente los descuentos de préstamos y Ajuste Inbursa.'],
        ],
      },
      {
        type: 'info', tone: 'blue', icon: Info,
        text: ['Solo se puede generar prenómina para semanas cuyos reportes estén en estado ', { strong: 'TERMINADO' }, ' o ', { strong: 'PRENOMINA_CERRADA' }, '.'],
      },
    ],
  },
  {
    id: 'prenomina',
    num: 2,
    title: 'Módulo de Prenómina',
    icon: FileSpreadsheet,
    accent: 'emerald',
    blocks: [
      { type: 'h3', icon: PlayCircle, text: 'Cómo generar una prenómina' },
      {
        type: 'steps',
        items: [
          ['Entrar al menú ', { strong: 'Prenómina' }, '.'],
          'Elegir la semana.',
          'Abrir la vista de cálculo y revisar la vista previa.',
          'Guardar la prenómina.',
        ],
      },
      {
        type: 'p',
        text: ['Al guardar se crean registros por trabajador en estado ', { badge: 'abierta', label: 'ABIERTA' }, ' y los reportes de esa semana quedan como ', { strong: 'PRENOMINA_CERRADA' }, '.'],
      },
      { type: 'divider' },
      { type: 'h3', icon: Edit3, text: 'Qué se puede editar mientras está ABIERTA' },
      {
        type: 'cards2',
        items: [
          { icon: CheckCircle2, color: 'text-emerald-500', title: 'Se puede agregar', text: 'Descuentos manuales, depósitos extra, ajuste de viáticos y festivos.' },
          { icon: XCircle, color: 'text-rose-500', title: 'Se puede eliminar', text: 'Descuentos manuales y depósitos extra que no estén ligados a nómina aprobada.' },
        ],
      },
      {
        type: 'info', tone: 'rose', icon: Ban,
        text: ['Cuando la prenómina está en ', { strong: 'APROBADO' }, ' ya no se puede editar.'],
      },
    ],
  },
  {
    id: 'calculo',
    num: 3,
    title: 'Cómo Calcula el Sistema',
    icon: Calculator,
    accent: 'violet',
    blocks: [
      { type: 'h3', icon: DollarSign, text: 'Salario base por tipo de nómina' },
      {
        type: 'cards2',
        items: [
          { icon: Clock, color: 'text-blue-500', title: 'Por hora', text: 'Horas trabajadas × salario pactado semanal.' },
          { icon: CalendarCheck, color: 'text-violet-500', title: 'Cuadrado / Semanal', text: 'Salario pactado semanal fijo (independiente de horas).' },
        ],
      },
      { type: 'h3', icon: Zap, text: 'Horas extra' },
      { type: 'p', text: ['Solo aplica para nómina ', { strong: 'Semanal' }, '. Si el trabajador rebasa 50 horas productivas:'] },
      { type: 'formula', label: 'Fórmula', code: 'pago_horas_extras = (horas_totales - 50) × hr_extra' },
      { type: 'h3', icon: Car, text: 'Viáticos' },
      { type: 'p', text: ['Se suman por registro diario cuando el día tiene activado ', { strong: 'aplica_viaticos' }, '. Si el registro tiene monto manual se usa ese; si no, se usa el viático del perfil del trabajador.'] },
      { type: 'h3', icon: Star, text: 'Festivos' },
      { type: 'formula', label: 'Fórmula', code: 'pago_festivos = núm_días_festivos_marcados × pago_dia_festivo_del_trabajador' },
      { type: 'h3', icon: Home, text: 'Infonavit' },
      { type: 'p', text: ['Se toma directamente del campo financiero del trabajador: ', { code: 'descuento_infonavit' }, '.'] },
      { type: 'h3', icon: Sliders, text: 'Ajuste Inbursa' },
      {
        type: 'bullets',
        items: [
          'Si existen descuentos del módulo Ajuste con fecha dentro de esa semana, se suman todos esos descuentos.',
          ['Si no hay descuentos semanales, el sistema usa el valor fijo ', { code: 'ajuste_inbursa' }, ' del trabajador.'],
        ],
      },
      { type: 'info', tone: 'amber', icon: Lightbulb, text: ['Los descuentos del módulo Ajuste tienen ', { strong: 'prioridad' }, ' sobre el valor fijo del trabajador cuando hay registros para esa semana.'] },
      { type: 'h3', icon: HandCoins, text: 'Préstamos' },
      { type: 'formula', label: 'Fórmula', code: 'descuento_prestamos = Σ descuento_semanal de todos los préstamos activos' },
      { type: 'h3', icon: AlertTriangle, text: 'Incidencias' },
      { type: 'p', text: ['Aparecen en la vista de edición pero el sistema ', { strong: 'no descuenta dinero automáticamente' }, '. El administrador debe agregar el descuento manualmente.'] },
      { type: 'divider' },
      { type: 'h3', icon: Sigma, text: 'Fórmula final' },
      { type: 'formula', label: 'Total percepciones', code: 'salario_base + horas_extras + viáticos + festivos + depósitos_otros' },
      { type: 'formula', label: 'Total deducciones', code: 'infonavit + ajuste_inbursa + incidencias + préstamos + descuentos_otros' },
      { type: 'formula', label: 'Neto a pagar', code: 'total_percepciones − total_deducciones', highlight: true },
    ],
  },
  {
    id: 'cierre',
    num: 4,
    title: 'Cómo Cerrar una Prenómina',
    icon: Lock,
    accent: 'rose',
    blocks: [
      {
        type: 'steps',
        items: [
          ['Entrar a ', { strong: 'Editar Prenómina' }, '.'],
          'Validar netos, descuentos, depósitos, viáticos y festivos.',
          ['Presionar ', { strong: 'Cerrar Nómina Global' }, '.'],
        ],
      },
      { type: 'p', text: 'Al cerrarla ocurren tres cosas simultáneas:' },
      {
        type: 'cards2',
        items: [
          { icon: Lock, color: 'text-rose-500', title: 'Semana bloqueada', text: ['Todas las prenóminas abiertas de esa semana pasan a ', { badge: 'aprobado', label: 'APROBADO' }, '.'] },
          { icon: Sliders, color: 'text-amber-500', title: 'Ajuste Inbursa cobrado', text: ['Los descuentos de esa semana se marcan como ', { strong: 'cobrado = True' }, '.'] },
          { icon: HandCoins, color: 'text-blue-500', title: 'Abono real a préstamos', text: 'Los préstamos activos reciben su abono y baja el saldo restante.' },
          { icon: History, color: 'text-violet-500', title: 'Histórico', text: ['Solo aparecen prenóminas en estado ', { badge: 'aprobado', label: 'APROBADO' }, ' — resultado final pagado.'] },
        ],
      },
    ],
  },
  {
    id: 'prestamos',
    num: 5,
    title: 'Módulo de Préstamos',
    icon: HandCoins,
    accent: 'amber',
    blocks: [
      { type: 'h3', icon: Plus, text: 'Registrar un préstamo' },
      { type: 'p', text: ['En ', { strong: 'Préstamos → Nuevo Préstamo' }, ' se captura: trabajador, monto total, plazo en semanas, descuento por periodo, frecuencia, fecha de inicio y motivo.'] },
      { type: 'p', text: ['Al guardar el préstamo queda en estado ', { badge: 'activo', label: 'ACTIVO' }, ' y el sistema recalcula las prenóminas abiertas del trabajador.'] },
      { type: 'h3', icon: RefreshCw, text: 'Cuándo baja realmente la deuda' },
      { type: 'info', tone: 'blue', icon: Info, text: ['El préstamo se refleja en la prenómina desde que está activo, pero la deuda ', { strong: 'solo baja al cerrar la prenómina' }, '.'] },
      { type: 'p', text: ['Al cerrar, el sistema aplica como abono el menor entre el descuento programado y el saldo restante, registra un abono tipo ', { strong: 'NOMINA' }, ' y, si la deuda llega a cero, el préstamo pasa a ', { badge: 'liquidado', label: 'LIQUIDADO' }, '.'] },
      { type: 'h3', icon: HandCoins, text: 'Abonos manuales y liquidación' },
      {
        type: 'cards2',
        items: [
          { icon: HandCoins, color: 'text-emerald-500', title: 'Abono manual', text: ['Descuenta inmediatamente del saldo y recalcula prenóminas abiertas. Se guarda como abono tipo ', { strong: 'MANUAL' }, '.'] },
          { icon: CheckCheck, color: 'text-indigo-500', title: 'Liquidación total', text: ['Genera un abono por el saldo restante, deja la deuda en cero y cambia el estado a ', { badge: 'liquidado', label: 'LIQUIDADO' }, '.'] },
        ],
      },
      { type: 'h3', icon: Eye, text: 'Dónde debe reflejarse un préstamo' },
      {
        type: 'steps',
        items: [
          ['En ', { strong: 'Préstamos' }, ', como saldo activo o liquidado.'],
          ['En la edición de prenómina, dentro de ', { strong: 'Préstamos Activos' }, '.'],
          ['En la prenómina semanal como ', { code: 'descuento_prestamos' }, '.'],
          'En el historial del préstamo como abonos NOMINA o MANUAL.',
        ],
      },
      {
        type: 'warn',
        text: ['Crear un préstamo ', { strong: 'no genera automáticamente' }, ' un depósito en la prenómina. Si la empresa necesita reflejar el dinero entregado, debe registrarse como depósito extra en la prenómina correspondiente.'],
      },
    ],
  },
  {
    id: 'ajuste',
    num: 6,
    title: 'Módulo de Ajuste Inbursa',
    icon: Sliders,
    accent: 'teal',
    blocks: [
      { type: 'p', text: 'Sirve para recuperar descuentos relacionados con depósitos adelantados de Inbursa dentro de un periodo de ajuste.' },
      { type: 'h3', icon: Calendar, text: 'Crear un periodo' },
      { type: 'p', text: ['En ', { strong: 'Ajuste' }, ' se crea un periodo con nombre, fecha inicio, fecha fin, trabajadores y monto meta por trabajador.'] },
      {
        type: 'bullets',
        items: [
          'La fecha inicial debe ser menor que la final.',
          'No puede haber otro periodo con fechas traslapadas.',
          'Debe seleccionarse al menos un trabajador.',
        ],
      },
      { type: 'h3', icon: Key, text: 'Capturar descuentos' },
      {
        type: 'steps',
        items: [
          'Elegir al trabajador dentro del detalle del periodo.',
          'Capturar el monto y la fecha exacta del descuento.',
          'Agregar notas si es necesario.',
        ],
      },
      { type: 'h3', icon: CalendarCheck, text: 'Cuándo entra a la prenómina' },
      { type: 'p', text: ['El descuento entra a la prenómina cuando la ', { strong: 'fecha_descuento' }, ' cae dentro de la semana de prenómina del trabajador. El sistema suma todos los descuentos de esa semana y los coloca en el campo ', { code: 'ajuste_inbursa' }, '.'] },
      { type: 'info', tone: 'green', icon: CheckCircle2, text: ['El ajuste se considera ', { strong: 'cobrado' }, ' hasta que se cierra la prenómina. Al aprobarla, los registros se marcan y ya no se pueden eliminar del periodo.'] },
      { type: 'h3', icon: Eye, text: 'Dónde debe reflejarse' },
      {
        type: 'bullets',
        items: [
          'En el detalle del periodo: meta, descontado, restante, progreso y detalle por fecha.',
          ['En la prenómina semanal como ', { strong: 'Ajuste Inbursa' }, '.'],
          'En el recibo PDF y reportes Excel de prenómina.',
          'En el histórico cuando la prenómina ya fue aprobada.',
        ],
      },
    ],
  },
  {
    id: 'reportes',
    num: 7,
    title: 'Reportes Excel',
    icon: TableIcon,
    accent: 'indigo',
    blocks: [
      {
        type: 'cards2',
        items: [
          { icon: FileSpreadsheet, color: 'text-emerald-500', title: 'Excel de Prenómina', text: 'Salario base, horas extras, viáticos, festivos, otros depósitos, ajuste Inbursa, otros descuentos, abono préstamos, descuento incidencias, total deducciones y total a pagar.' },
          { icon: FileSpreadsheet, color: 'text-blue-500', title: 'Excel de Préstamos', text: 'Monto original, total abonado, saldo restante, descuento semanal, estado y motivo.' },
          { icon: FileSpreadsheet, color: 'text-violet-500', title: 'Excel de Ajustes', text: 'Resumen por trabajador: meta, total descontado, saldo restante y detalle por fecha de descuento.' },
        ],
      },
    ],
  },
  {
    id: 'recomendaciones',
    num: 8,
    title: 'Recomendaciones Operativas',
    icon: CheckCheck,
    accent: 'emerald',
    intro: 'Para evitar diferencias en el pago, seguir siempre este orden:',
    blocks: [
      {
        type: 'steps',
        items: [
          'Cerrar primero las horas de la semana.',
          ['Crear o actualizar préstamos ', { strong: 'antes' }, ' de cerrar prenómina.'],
          'Capturar descuentos Inbursa con su fecha real dentro del periodo.',
          ['Guardar prenómina y revisarla en estado ', { badge: 'abierta', label: 'ABIERTA' }, '.'],
          'Aplicar manualmente descuentos por incidencias cuando corresponda.',
          'Agregar depósitos extras solo si deben aumentar el neto real a pagar.',
          ['Aprobar la prenómina ', { strong: 'solo cuando todo esté validado' }, '.'],
        ],
      },
    ],
  },
]

const REGLAS_CLAVE = [
  { icon: HandCoins, text: ['Préstamo activo se ve en prenómina desde antes, pero la deuda baja hasta ', { strong: 'aprobar' }, ' la semana.'] },
  { icon: Sliders, text: ['Ajuste Inbursa entra según su fecha, pero se considera cobrado hasta ', { strong: 'aprobar' }, ' la prenómina.'] },
  { icon: Clock, text: ['Incidencias se muestran, pero el descuento lo decide y captura ', { strong: 'el administrador' }, '.'] },
  { icon: RefreshCw, text: ['Depósitos extra y ajustes manuales recalculan el neto mientras la prenómina siga ', { strong: 'abierta' }, '.'] },
]

// ── Helpers de estilo ────────────────────────────────────────────────────────

const ACCENT_BG = {
  blue:    'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300',
  violet:  'bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300',
  rose:    'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300',
  amber:   'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300',
  teal:    'bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-300',
  indigo:  'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300',
}

const BADGE_TONE = {
  abierta:   'warning',
  aprobado:  'success',
  activo:    'info',
  liquidado: 'neutral',
  cerrado:   'danger',
}

const INFO_TONE = {
  blue:  'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 text-blue-900 dark:text-blue-200',
  amber: 'bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 text-amber-900 dark:text-amber-200',
  green: 'bg-emerald-50 dark:bg-emerald-900/20 border-l-4 border-emerald-500 text-emerald-900 dark:text-emerald-200',
  rose:  'bg-rose-50 dark:bg-rose-900/20 border-l-4 border-rose-500 text-rose-900 dark:text-rose-200',
}

// ── Render de tokens (texto enriquecido) ─────────────────────────────────────

function renderTokens(content, keyPrefix = '') {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) {
    // Token único
    return renderToken(content, keyPrefix + '0')
  }
  return content.map((part, i) => {
    if (typeof part === 'string') return <span key={keyPrefix + i}>{part}</span>
    return renderToken(part, keyPrefix + i)
  })
}

function renderToken(t, k) {
  if (t.strong) return <strong key={k} className="font-bold text-ink-900 dark:text-ink-100">{t.strong}</strong>
  if (t.code) return (
    <code key={k} className="bg-ink-100 dark:bg-ink-800 text-ink-900 dark:text-ink-100 px-1.5 py-0.5 rounded text-[0.85em] font-mono">
      {t.code}
    </code>
  )
  if (t.badge) return <Badge key={k} tone={BADGE_TONE[t.badge] || 'neutral'} dot>{t.label || t.badge}</Badge>
  return null
}

// ── Bloques ──────────────────────────────────────────────────────────────────

function Block({ block }) {
  switch (block.type) {
    case 'p':
      return <p className="text-sm text-ink-600 dark:text-ink-300 leading-relaxed mb-3">{renderTokens(block.text)}</p>

    case 'h3':
      return (
        <h3 className="flex items-center gap-2 text-base font-bold text-ink-900 dark:text-ink-100 mt-5 mb-2">
          {block.icon && <block.icon size={15} className="text-ink-400 dark:text-ink-500" />}
          {block.text}
        </h3>
      )

    case 'steps':
      return (
        <ol className="my-3 space-y-2">
          {block.items.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-ink-600 dark:text-ink-300 leading-relaxed">
              <span className="mt-0.5 flex-shrink-0 h-6 w-6 rounded-full bg-brand-600 text-white text-xs font-bold inline-flex items-center justify-center">
                {i + 1}
              </span>
              <span className="pt-0.5">{renderTokens(item)}</span>
            </li>
          ))}
        </ol>
      )

    case 'bullets':
      return (
        <ul className="my-3 space-y-1.5">
          {block.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-ink-600 dark:text-ink-300 leading-relaxed">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-500" />
              <span>{renderTokens(item)}</span>
            </li>
          ))}
        </ul>
      )

    case 'info': {
      const Icon = block.icon
      return (
        <div className={`flex gap-3 rounded-md p-3 my-3 text-sm leading-relaxed ${INFO_TONE[block.tone] || INFO_TONE.blue}`}>
          {Icon && <Icon size={16} className="flex-shrink-0 mt-0.5" />}
          <span>{renderTokens(block.text)}</span>
        </div>
      )
    }

    case 'warn':
      return (
        <div className="flex gap-3 rounded-lg p-4 my-3 text-sm leading-relaxed bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-900/30 dark:to-amber-900/10 border border-amber-200 dark:border-amber-700/60">
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <span className="text-amber-900 dark:text-amber-100">{renderTokens(block.text)}</span>
        </div>
      )

    case 'formula':
      return (
        <FormulaBox label={block.label} code={block.code} highlight={block.highlight} />
      )

    case 'cards2':
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-3">
          {block.items.map((card, i) => (
            <div key={i} className="rounded-lg border border-ink-200 dark:border-ink-800 bg-ink-50/40 dark:bg-ink-900/40 p-4">
              <h4 className="flex items-center gap-2 text-sm font-bold text-ink-900 dark:text-ink-100 mb-1.5">
                {card.icon && <card.icon size={14} className={card.color} />}
                {card.title}
              </h4>
              <p className="text-sm text-ink-600 dark:text-ink-300 leading-relaxed">
                {renderTokens(card.text)}
              </p>
            </div>
          ))}
        </div>
      )

    case 'divider':
      return <hr className="my-5 border-ink-200 dark:border-ink-800" />

    default:
      return null
  }
}

function FormulaBox({ label, code, highlight }) {
  const [copied, setCopied] = useState(false)
  const onCopy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <div className={`relative rounded-lg p-3 my-3 font-mono text-sm ${
      highlight
        ? 'bg-brand-50 border border-brand-300 dark:bg-brand-900/30 dark:border-brand-700/60'
        : 'bg-ink-50 border border-ink-200 dark:bg-ink-900/40 dark:border-ink-800'
    }`}>
      <div className={`text-[10px] uppercase tracking-wider font-semibold mb-1 ${
        highlight ? 'text-brand-700 dark:text-brand-300' : 'text-ink-500 dark:text-ink-400'
      }`}>
        {label}
      </div>
      <div className="flex items-start justify-between gap-2">
        <code className="text-ink-900 dark:text-ink-100 break-words">{code}</code>
        <button
          type="button"
          onClick={onCopy}
          title="Copiar fórmula"
          className="flex-shrink-0 inline-flex items-center justify-center h-6 w-6 rounded text-ink-400 hover:text-brand-600 hover:bg-white dark:hover:bg-ink-800 transition-colors focus-ring"
        >
          {copied
            ? <CheckCircle2 size={13} className="text-emerald-500" />
            : <span className="text-[10px] font-sans font-medium">⧉</span>}
        </button>
      </div>
    </div>
  )
}

// ── Sección ──────────────────────────────────────────────────────────────────

function Seccion({ s, registerRef, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)
  const Icon = s.icon
  return (
    <section
      id={s.id}
      ref={(el) => registerRef(s.id, el)}
      className="scroll-mt-20 bg-white dark:bg-ink-900 rounded-xl border border-ink-200 dark:border-ink-800 shadow-card overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-ink-50/50 dark:hover:bg-ink-900/60 transition-colors focus-ring"
      >
        <div className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 ${ACCENT_BG[s.accent]}`}>
          <Icon size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-ink-400 dark:text-ink-500">
            Sección {s.num}
          </div>
          <h2 className="text-base sm:text-lg font-bold text-ink-900 dark:text-ink-100 leading-tight">
            {s.title}
          </h2>
        </div>
        {open
          ? <ChevronUp size={16} className="text-ink-400 flex-shrink-0" />
          : <ChevronDown size={16} className="text-ink-400 flex-shrink-0" />}
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-ink-100 dark:border-ink-800">
          {s.intro && <p className="text-sm text-ink-600 dark:text-ink-300 leading-relaxed mb-3 mt-3">{s.intro}</p>}
          {s.blocks.map((b, i) => <Block key={i} block={b} />)}
        </div>
      )}
    </section>
  )
}

// ── Reglas clave (banner final) ──────────────────────────────────────────────

function ReglasClave() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-brand-700 to-brand-900 dark:from-brand-800 dark:to-brand-950 p-6 sm:p-7 text-white shadow-lg mt-6">
      <h3 className="flex items-center gap-2 font-bold text-base mb-4">
        <Star size={18} className="text-amber-300" />
        Reglas Clave del Sistema
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {REGLAS_CLAVE.map((r, i) => {
          const Icon = r.icon
          return (
            <div key={i} className="bg-white/10 backdrop-blur-sm rounded-lg p-3 flex gap-3 items-start">
              <Icon size={18} className="flex-shrink-0 mt-0.5 text-brand-200" />
              <p className="text-sm leading-relaxed">{renderTokens(r.text)}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Búsqueda: extrae texto plano de un bloque ────────────────────────────────

function blockText(b) {
  if (!b) return ''
  if (b.text) return tokenText(b.text)
  if (b.code) return b.code
  if (b.items) return b.items.map((it) => it.title ? `${it.title} ${tokenText(it.text)}` : tokenText(it)).join(' ')
  return ''
}

function tokenText(t) {
  if (typeof t === 'string') return t
  if (Array.isArray(t)) return t.map(tokenText).join(' ')
  if (t.strong) return t.strong
  if (t.code) return t.code
  if (t.label) return t.label
  return ''
}

function seccionContieneTexto(s, q) {
  if (!q) return true
  const haystack = [s.title, s.intro || '', ...s.blocks.map(blockText)].join(' ').toLowerCase()
  return haystack.includes(q.toLowerCase())
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function ManualAdmin() {
  const [q, setQ] = useState('')
  const [activeId, setActiveId] = useState(SECCIONES[0].id)
  const [showTop, setShowTop] = useState(false)
  const refs = useRef({})

  const registerRef = (id, el) => { if (el) refs.current[id] = el }

  const filtradas = useMemo(() => {
    const term = q.trim()
    if (!term) return SECCIONES
    return SECCIONES.filter((s) => seccionContieneTexto(s, term))
  }, [q])

  // Scroll-spy: cuando el usuario hace scroll, marcamos la sección visible
  // en el TOC. Usamos IntersectionObserver para detectar cuál está más cerca
  // del top del viewport.
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return
    const visible = new Map()
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) visible.set(e.target.id, e.intersectionRatio)
          else visible.delete(e.target.id)
        })
        if (visible.size > 0) {
          // Tomar la primera sección visible en el orden del DOM.
          const ids = Array.from(visible.keys())
          const ordered = SECCIONES.map((s) => s.id).filter((id) => ids.includes(id))
          if (ordered[0]) setActiveId(ordered[0])
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: [0, 0.25, 0.5, 1] },
    )
    SECCIONES.forEach((s) => {
      const el = refs.current[s.id]
      if (el) obs.observe(el)
    })
    return () => obs.disconnect()
  }, [filtradas.length])

  // Botón "volver arriba"
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = (id) => {
    const el = refs.current[id]
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      <PageHeader
        icon={BookOpen}
        title="Manual de Uso del Sistema"
        description="Prenómina, Préstamos y Ajuste Inbursa — Guía operativa para administradores."
        actions={
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-700 dark:text-ink-200 text-sm font-medium hover:bg-ink-50 dark:hover:bg-ink-800 focus-ring print:hidden"
          >
            <Printer size={14} /> Imprimir
          </button>
        }
      />

      {/* Búsqueda */}
      <div className="mb-5 max-w-md print:hidden">
        <Input
          placeholder="Buscar en el manual..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          leftIcon={<Search size={15} />}
          rightIcon={q ? (
            <button
              type="button"
              onClick={() => setQ('')}
              className="hover:text-ink-700 pointer-events-auto"
              aria-label="Limpiar"
            >
              <X size={14} />
            </button>
          ) : null}
        />
        {q && (
          <p className="text-xs text-ink-500 dark:text-ink-400 mt-1">
            {filtradas.length} de {SECCIONES.length} secciones coinciden con "{q}"
          </p>
        )}
      </div>

      {/* Layout principal: TOC sticky + contenido */}
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        {/* TOC */}
        <aside className="hidden lg:block print:hidden">
          <nav className="sticky top-4 bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-xl p-3 shadow-card">
            <div className="flex items-center gap-2 px-2 pb-2 mb-2 border-b border-ink-100 dark:border-ink-800">
              <MousePointerClick size={13} className="text-brand-500" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">
                Contenido
              </span>
            </div>
            <ul className="space-y-0.5">
              {SECCIONES.map((s) => {
                const isActive = activeId === s.id
                const SecIcon = s.icon
                const dim = q && !seccionContieneTexto(s, q)
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => scrollTo(s.id)}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-sm transition-colors focus-ring ${
                        isActive
                          ? 'bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200 font-semibold'
                          : 'text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800'
                      } ${dim ? 'opacity-40' : ''}`}
                    >
                      <SecIcon size={13} className="flex-shrink-0" />
                      <span className="truncate">{s.title}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>
        </aside>

        {/* Contenido */}
        <div className="min-w-0 space-y-4">
          {filtradas.length === 0 ? (
            <div className="text-center py-12 text-ink-500 dark:text-ink-400">
              <Search size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">Ninguna sección coincide con tu búsqueda.</p>
            </div>
          ) : (
            filtradas.map((s) => (
              <Seccion key={s.id} s={s} registerRef={registerRef} defaultOpen={true} />
            ))
          )}

          {!q && <ReglasClave />}
        </div>
      </div>

      {/* Botón volver arriba */}
      {showTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-30 h-11 w-11 rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-700 inline-flex items-center justify-center focus-ring print:hidden"
          title="Volver arriba"
          aria-label="Volver arriba"
        >
          <ArrowUp size={18} />
        </button>
      )}
    </>
  )
}
