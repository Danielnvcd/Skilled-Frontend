import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen, Search, ChevronDown, ChevronUp, ArrowUp, Printer, Star, Info,
  Route, Clock, ScanLine, IdCard, HardHat, CheckCheck, CheckCircle2, XCircle,
  AlertTriangle, Lock, Lightbulb, PlayCircle, Edit3,
  Eye, Plus, FileText, X, MousePointerClick, Camera, Phone, Droplet, HeartPulse,
  Users, FileCheck2, Pencil, MapPin, Coffee, FolderOpen, ShieldCheck,
} from 'lucide-react'
import { PageHeader, Input, Badge } from '../../components/ui'

// ── Contenido del manual del Coordinador ─────────────────────────────────────
// Estructura idéntica al ManualAdmin: data → render. Permite búsqueda,
// TOC sticky, scroll-spy y modo impresión.

const SECCIONES = [
  {
    id: 'flujo',
    num: 1,
    title: 'Tu Semana como Coordinador',
    icon: Route,
    accent: 'blue',
    intro: 'El flujo correcto evita errores en prenómina y te permite cerrar la semana sin retrabajo.',
    blocks: [
      {
        type: 'steps',
        items: [
          ['Al inicio de la semana abres un ', { strong: 'Reporte de Horas' }, ' para cada proyecto a tu cargo.'],
          ['Durante la semana registras día por día las horas de cada trabajador (manual o por ', { strong: 'QR móvil' }, ').'],
          'Validas que cada empleado tenga sus registros completos: horas, incidencias y comidas.',
          ['Cuando termina la semana, presionas ', { strong: 'Cerrar reporte' }, ' para enviarlo a prenómina.'],
          'Administración procesa la prenómina con los datos que cerraste.',
        ],
      },
      {
        type: 'info', tone: 'blue', icon: Info,
        text: ['Solo puedes operar reportes de los proyectos donde estás asignado como ', { strong: 'coordinador a cargo' }, '. El sistema filtra automáticamente lo que ves.'],
      },
    ],
  },

  {
    id: 'reporte',
    num: 2,
    title: 'Reporte de Horas',
    icon: Clock,
    accent: 'emerald',
    intro: 'Es la captura semanal de horas por proyecto. La semana laboral va de martes a lunes.',
    blocks: [
      { type: 'h3', icon: PlayCircle, text: 'Abrir un reporte nuevo' },
      {
        type: 'steps',
        items: [
          ['Entra al menú ', { strong: 'Reporte de Horas' }, ' y presiona ', { strong: 'Nuevo reporte' }, '.'],
          'Selecciona el proyecto (solo aparecen los tuyos).',
          ['Valida el rango de fechas — el sistema sugiere ', { code: 'martes → lunes' }, ' de la semana en curso.'],
          ['Guarda. Queda en estado ', { badge: 'abierta', label: 'BORRADOR' }, ' listo para capturar.'],
        ],
      },
      {
        type: 'info', tone: 'amber', icon: Lightbulb,
        text: ['No puedes abrir dos reportes para el ', { strong: 'mismo proyecto' }, ' en el mismo rango. Si necesitas reabrir, pide apoyo al administrador.'],
      },

      { type: 'divider' },
      { type: 'h3', icon: FileCheck2, text: 'Estados de un reporte' },
      {
        type: 'cards2',
        items: [
          { icon: Pencil, color: 'text-amber-500', title: 'BORRADOR', text: 'En captura. Puedes agregar, editar y eliminar registros libremente.' },
          { icon: CheckCircle2, color: 'text-emerald-500', title: 'TERMINADO', text: 'Reporte cerrado por ti. Queda listo para que administración lo cargue a prenómina.' },
          { icon: Lock, color: 'text-sky-500', title: 'PRENÓMINA CERRADA', text: 'Administración ya procesó la prenómina con este reporte. Solo lectura.' },
        ],
      },
      {
        type: 'p',
        text: ['Las tarjetas de la parte superior (', { strong: 'En captura' }, ', ', { strong: 'Listos para nómina' }, ', ', { strong: 'Nómina cerrada' }, ') funcionan como filtro: dale click para ver solo los de ese estado.'],
      },
    ],
  },

  {
    id: 'captura',
    num: 3,
    title: 'Capturar Registros Diarios',
    icon: Edit3,
    accent: 'violet',
    intro: 'Cada celda de la tabla representa un día de un trabajador. Click en cualquier celda para capturar o editar.',
    blocks: [
      { type: 'h3', icon: MousePointerClick, text: 'Cómo se navega la cuadrícula' },
      {
        type: 'bullets',
        items: [
          ['Filas = ', { strong: 'trabajadores' }, ' asignados al proyecto.'],
          ['Columnas = ', { strong: 'días de la semana' }, ' (martes a lunes).'],
          ['Celdas ', { strong: 'verdes' }, ' = horas capturadas. ', { strong: 'Ámbar' }, ' = incidencia. ', { strong: 'Punteadas' }, ' = vacías, pendientes por capturar.'],
          'La columna final muestra el total de horas por trabajador en la semana.',
        ],
      },

      { type: 'divider' },
      { type: 'h3', icon: Plus, text: 'Crear o editar un registro' },
      {
        type: 'steps',
        items: [
          'Click en la celda del día y trabajador correspondiente.',
          ['Selecciona ', { strong: 'hora de entrada' }, ' y ', { strong: 'hora de salida' }, ' (intervalos de 30 min).'],
          ['Si el empleado tomó comida, marca ', { code: 'Tomó comida' }, ' (se descuenta automáticamente del cálculo).'],
          ['Si no asistió o hubo una situación especial, elige una ', { strong: 'incidencia' }, ' (ver sección 4).'],
          'Guarda. La celda cambia a verde con el rango horario y las horas productivas calculadas.',
        ],
      },
      {
        type: 'info', tone: 'green', icon: CheckCircle2,
        text: ['El sistema calcula automáticamente las ', { strong: 'horas productivas' }, ' (salida − entrada − comida si aplica). Tú solo capturas las horas reales.'],
      },

      { type: 'h3', icon: Coffee, text: 'La casilla "Tomó comida"' },
      {
        type: 'p',
        text: 'Marca esta casilla cuando el trabajador disfrutó del descanso para comida durante esa jornada. El sistema descuenta el tiempo correspondiente para calcular las horas productivas reales.',
      },

      { type: 'h3', icon: XCircle, text: 'Eliminar un registro' },
      {
        type: 'p',
        text: ['Abre la celda existente y presiona el botón ', { strong: 'Eliminar' }, '. Solo se puede mientras el reporte esté en ', { badge: 'abierta', label: 'BORRADOR' }, '.'],
      },
    ],
  },

  {
    id: 'incidencias',
    num: 4,
    title: 'Incidencias',
    icon: AlertTriangle,
    accent: 'amber',
    intro: 'Las incidencias documentan por qué un trabajador no cubrió un día completo. Se registran en el día específico.',
    blocks: [
      { type: 'h3', icon: FileText, text: 'Qué es una incidencia' },
      {
        type: 'p',
        text: ['Es una etiqueta que pones en lugar (o además) de las horas de un día: ', { strong: 'Falta' }, ', ', { strong: 'Permiso' }, ', ', { strong: 'Vacaciones' }, ', ', { strong: 'Incapacidad' }, ', etc. Cada empresa configura su catálogo, por eso la lista te aparece directamente al abrir la celda.'],
      },
      {
        type: 'cards2',
        items: [
          { icon: CheckCircle2, color: 'text-emerald-500', title: 'Cuándo usarla', text: 'Cuando el día no es trabajado normal: falta, retardo grave, vacaciones, permiso con o sin goce, incapacidad médica, etc.' },
          { icon: Pencil, color: 'text-blue-500', title: 'Cómo se captura', text: 'Abre la celda del día, selecciona la incidencia en el dropdown. Puedes dejar las horas vacías si el día no se trabajó.' },
        ],
      },

      {
        type: 'info', tone: 'rose', icon: AlertTriangle,
        text: ['Importante: la incidencia ', { strong: 'NO descuenta dinero automáticamente' }, '. Solo deja constancia de lo ocurrido. El descuento, si aplica, lo aplica el administrador al cerrar la prenómina.'],
      },
      {
        type: 'info', tone: 'amber', icon: Lightbulb,
        text: 'Captura la incidencia siempre en el día exacto. Tu disciplina aquí ayuda a que administración aplique correctamente los descuentos o pagos.',
      },
    ],
  },

  {
    id: 'cerrar',
    num: 5,
    title: 'Cerrar el Reporte Semanal',
    icon: Lock,
    accent: 'rose',
    intro: 'Cerrar el reporte es el paso que envía las horas a prenómina. Hazlo solo cuando todo esté validado.',
    blocks: [
      { type: 'h3', icon: CheckCheck, text: 'Antes de cerrar — checklist' },
      {
        type: 'bullets',
        items: [
          'Cada trabajador tiene capturados todos los días que correspondía.',
          'Las incidencias del periodo están reflejadas en su día exacto.',
          'Los totales de horas por trabajador se ven correctos.',
          'No hay celdas pendientes en ámbar o sin completar.',
        ],
      },

      { type: 'h3', icon: PlayCircle, text: 'Cómo cerrar' },
      {
        type: 'steps',
        items: [
          ['Entra al reporte y presiona ', { strong: 'Cerrar reporte' }, ' (botón verde, arriba a la derecha).'],
          'Confirma en la ventana de aviso.',
          ['El reporte pasa a estado ', { badge: 'aprobado', label: 'TERMINADO' }, ' y queda disponible para prenómina.'],
        ],
      },

      {
        type: 'info', tone: 'rose', icon: Lock,
        text: ['Una vez cerrado ya ', { strong: 'no puedes editar' }, ' ni agregar registros. Solo administración (mediante reapertura) puede modificarlo.'],
      },
      {
        type: 'info', tone: 'amber', icon: Lightbulb,
        text: ['Cierra preferentemente el ', { strong: 'martes en la mañana' }, ' (después de cerrar el lunes laboral). Esto le da margen a administración para procesar prenómina sin presión.'],
      },
    ],
  },

  {
    id: 'qr',
    num: 6,
    title: 'Captura por QR Móvil',
    icon: ScanLine,
    accent: 'teal',
    intro: 'En tu celular puedes registrar entradas y salidas escaneando el QR del trabajador. Ideal para obra o proyectos en campo.',
    blocks: [
      { type: 'h3', icon: Camera, text: 'Requisitos' },
      {
        type: 'bullets',
        items: [
          ['Un reporte abierto en estado ', { badge: 'abierta', label: 'BORRADOR' }, ' para el proyecto en curso.'],
          'Permiso de cámara concedido al navegador.',
          'Conexión a internet en el momento del escaneo.',
          'Cada trabajador debe tener impreso o disponible su QR personal (lo genera administración).',
        ],
      },

      { type: 'h3', icon: ScanLine, text: 'Cómo escanear' },
      {
        type: 'steps',
        items: [
          ['Entra desde el menú móvil a ', { strong: 'Escanear QR' }, '.'],
          'Selecciona el reporte de la semana sobre el que vas a registrar.',
          'Apunta la cámara al QR del trabajador.',
          ['El sistema decide automáticamente si es ', { strong: 'ENTRADA' }, ' (primer escaneo del día) o ', { strong: 'SALIDA' }, ' (segundo escaneo) y muestra la hora registrada.'],
        ],
      },

      {
        type: 'info', tone: 'green', icon: CheckCircle2,
        text: ['El escaneo crea o actualiza el registro del día automáticamente. Luego puedes ir al escritorio y completar detalles como ', { strong: 'comida' }, ' o ', { strong: 'incidencias' }, ' si aplica.'],
      },
      {
        type: 'info', tone: 'rose', icon: XCircle,
        text: ['Si el QR no se reconoce o el trabajador no pertenece al proyecto del reporte, el sistema rechaza el escaneo y muestra el motivo. No fuerces el registro — corrige primero la asignación.'],
      },
    ],
  },

  {
    id: 'credenciales',
    num: 7,
    title: 'Credenciales de Planta',
    icon: IdCard,
    accent: 'indigo',
    intro: 'Aquí consultas qué credenciales (CAET, Stellantis, Audi, BMW, etc.) tiene cada trabajador y si están vigentes.',
    blocks: [
      { type: 'h3', icon: Eye, text: 'Para qué te sirve' },
      {
        type: 'bullets',
        items: [
          'Antes de asignar a un trabajador a una planta, verificar que tenga la credencial vigente.',
          'Detectar a tiempo credenciales próximas a vencer o caducadas.',
          'Consultar la ficha de un trabajador con sus datos de contacto y estado de credenciales.',
        ],
      },

      { type: 'h3', icon: ShieldCheck, text: 'Estados de una credencial' },
      {
        type: 'cards2',
        items: [
          { icon: CheckCircle2, color: 'text-emerald-500', title: 'Vigente', text: 'En verde. Sin caducidad o con más de 30 días por vencer.' },
          { icon: AlertTriangle, color: 'text-amber-500', title: 'Próxima a vencer', text: 'En ámbar. Vence en los siguientes 30 días. Avisar al trabajador para renovar.' },
          { icon: XCircle, color: 'text-rose-500', title: 'Caducada', text: 'En rojo. Ya venció — no debe usarla para acceder a planta hasta renovar.' },
        ],
      },

      { type: 'h3', icon: FileText, text: 'Ver la ficha del trabajador' },
      {
        type: 'p',
        text: ['Click en ', { strong: 'Ver ficha' }, ' para abrir la información completa: foto, puesto, área, coordinador, ubicación de proyecto, celular, observaciones y el detalle visual de todas sus credenciales con fechas.'],
      },

      {
        type: 'info', tone: 'blue', icon: Info,
        text: ['Tú puedes ', { strong: 'consultar' }, ' credenciales pero no editarlas. La carga y actualización la hace el administrador desde su panel.'],
      },
    ],
  },

  {
    id: 'ficha',
    num: 8,
    title: 'Ficha Técnica',
    icon: HardHat,
    accent: 'rose',
    intro: 'Información médica y de contacto de emergencia de los trabajadores asignados a tus proyectos. Crítica ante cualquier eventualidad en campo.',
    blocks: [
      { type: 'h3', icon: HeartPulse, text: 'Qué información contiene' },
      {
        type: 'cards2',
        items: [
          { icon: Droplet, color: 'text-red-500', title: 'Datos médicos', text: 'Tipo de sangre, alergias y enfermedades crónicas declaradas por el trabajador.' },
          { icon: Phone, color: 'text-emerald-500', title: 'Contacto de emergencia', text: 'Nombre, parentesco y teléfono. Click en el teléfono para marcar directo desde tu celular.' },
          { icon: FolderOpen, color: 'text-amber-500', title: 'Documentos', text: 'Expediente digital: INE, comprobantes, contratos, etc. Click en un documento para visualizarlo.' },
        ],
      },

      { type: 'h3', icon: Search, text: 'Buscar un trabajador' },
      {
        type: 'p',
        text: ['Usa la barra de búsqueda para filtrar por ', { strong: 'nombre' }, ' o ', { strong: 'número de empleado' }, '. Solo verás trabajadores activos en tus proyectos a cargo.'],
      },

      {
        type: 'info', tone: 'rose', icon: AlertTriangle,
        text: ['Esta información es ', { strong: 'confidencial' }, '. Úsala únicamente para coordinación operativa y emergencias — nunca la compartas fuera del equipo.'],
      },
    ],
  },

  {
    id: 'directorio',
    num: 9,
    title: 'Directorio',
    icon: Users,
    accent: 'blue',
    intro: 'Listado de contactos del personal de la empresa. Para coordinarte con otros coordinadores, administración o personal de oficina.',
    blocks: [
      { type: 'h3', icon: Phone, text: 'Cómo usarlo' },
      {
        type: 'bullets',
        items: [
          'Busca a alguien por nombre, puesto o área.',
          'Consulta su correo, celular y rol dentro del sistema.',
          'Desde el móvil puedes marcar al toque o iniciar un mensaje.',
        ],
      },
      {
        type: 'info', tone: 'blue', icon: Info,
        text: 'Los datos del directorio los mantiene administración. Si detectas un teléfono o correo desactualizado, repórtalo para corrección.',
      },
    ],
  },

  {
    id: 'recomendaciones',
    num: 10,
    title: 'Buenas Prácticas',
    icon: CheckCheck,
    accent: 'emerald',
    intro: 'Estas rutinas reducen errores en prenómina y te ahorran trabajo de corrección al final de la semana.',
    blocks: [
      {
        type: 'steps',
        items: [
          ['Captura las horas ', { strong: 'todos los días' }, ', no acumules hasta el lunes — los detalles se olvidan.'],
          ['Registra las incidencias en el ', { strong: 'día exacto' }, ' en que ocurrieron.'],
          ['Antes de cerrar, valida ', { strong: 'fila por fila' }, ' que los totales tengan sentido para cada empleado.'],
          ['Cierra el reporte ', { strong: 'temprano el martes' }, ' siguiente — da margen a administración para procesar prenómina.'],
          ['Si usas QR en campo, lleva un ', { strong: 'plan B en papel' }, ' por si falla internet o cámara.'],
          'Antes de mover a un trabajador a otra planta, revisa que su credencial esté vigente.',
          'Avisa al trabajador con tiempo cuando su credencial esté por vencer (estado ámbar).',
        ],
      },
      {
        type: 'info', tone: 'green', icon: CheckCircle2,
        text: ['La calidad de tu captura define la calidad de la nómina. Cada hora que dejas sin registrar es un descuento o pago indebido para alguien del equipo.'],
      },
    ],
  },
]

const REGLAS_CLAVE = [
  { icon: Clock, text: ['La semana laboral va de ', { strong: 'martes a lunes' }, '. Esa es la unidad de captura y cierre.'] },
  { icon: AlertTriangle, text: ['Las incidencias documentan pero ', { strong: 'no descuentan' }, ' — el descuento lo aplica administración al cerrar prenómina.'] },
  { icon: Lock, text: ['Cerrar un reporte es ', { strong: 'definitivo' }, ' para el coordinador. Solo administración puede reabrirlo.'] },
  { icon: MapPin, text: ['Solo ves y operas los proyectos donde estás registrado como ', { strong: 'coordinador a cargo' }, '.'] },
]

// ── Helpers de estilo (idénticos al ManualAdmin) ─────────────────────────────

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
  if (!Array.isArray(content)) return renderToken(content, keyPrefix + '0')
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
        Reglas Clave para Coordinadores
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

export default function ManualCoordinador() {
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

  // Scroll-spy
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
        title="Manual del Coordinador"
        description="Reporte de horas, captura QR, credenciales y ficha técnica — guía operativa para coordinadores."
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
