import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen, Search, ChevronDown, ChevronUp, ArrowUp, Printer, Star, Info,
  Route, Package, Boxes, Warehouse, ArrowRightLeft, History, AlertTriangle,
  ClipboardList, Send, FileSpreadsheet, Tag, ShoppingCart, ClipboardCheck,
  ScanLine, Wrench, Lightbulb, PlayCircle, Edit3, CheckCircle2, XCircle,
  Ban, Plus, Minus, MousePointerClick, X, MapPin, QrCode, ShieldCheck,
  Calculator, Lock, RefreshCw, Truck, FileText, Bell, Smartphone,
} from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { PageHeader, Input, Badge } from '../../components/ui'
import useIsMobileDevice from '../../hooks/useIsMobileDevice'

// ═══════════════════════════════════════════════════════════════════════════
// Contenido del manual — todo como data para búsqueda + render dinámico
// ═══════════════════════════════════════════════════════════════════════════

const SECCIONES = [
  // 1. Flujo general
  {
    id: 'flujo',
    num: 1,
    title: 'Flujo General del Inventario',
    icon: Route,
    accent: 'blue',
    intro: 'Entender el ciclo completo evita errores comunes. El orden importa: catálogo → bodegas → estantes → movimientos.',
    blocks: [
      { type: 'h3', icon: PlayCircle, text: 'Día 1 — Setup inicial' },
      {
        type: 'steps',
        items: [
          ['Crear los ', { strong: 'Almacenes' }, ' (bodegas físicas) — sin esto no se pueden registrar movimientos.'],
          ['Crear los ', { strong: 'Estantes' }, ' dentro de cada almacén (opcional, pero recomendado para usar el scanner móvil).'],
          ['Importar o crear el ', { strong: 'Catálogo de productos' }, ' (manual uno-por-uno, o Excel masivo).'],
          ['Asignar productos a los estantes (botón "Productos" en cada estante).'],
          'Capturar el stock inicial vía ENTRADA en cada bodega.',
        ],
      },
      { type: 'h3', icon: RefreshCw, text: 'Día a día — operación' },
      {
        type: 'cards2',
        items: [
          { icon: Package, color: 'text-emerald-500', title: 'Entradas', text: 'Llega material → ENTRADA al almacén destino.' },
          { icon: Send, color: 'text-rose-500', title: 'Salidas', text: 'Un trabajador pide material → solicitud → entrega → SALIDA del almacén origen.' },
          { icon: ArrowRightLeft, color: 'text-blue-500', title: 'Traspasos', text: 'Mover stock entre bodegas → TRASPASO.' },
          { icon: AlertTriangle, color: 'text-amber-500', title: 'Ajustes', text: 'Diferencias por conteo, merma o errores → AJUSTE con motivo obligatorio.' },
        ],
      },
      {
        type: 'info', tone: 'blue', icon: Info,
        text: ['Toda operación que mueve stock queda registrada en el ', { strong: 'Kardex del producto' }, ' con usuario, fecha y motivo. No hay forma de "borrar" un movimiento — solo registrar otro que lo compense.'],
      },
    ],
  },

  // 2. Catálogo de productos
  {
    id: 'catalogo',
    num: 2,
    title: 'Catálogo de Productos',
    icon: Package,
    accent: 'emerald',
    intro: 'El producto es la unidad mínima del sistema. Cada producto tiene código único, descripción, unidad de medida, stock mínimo y categoría.',
    blocks: [
      { type: 'h3', icon: Plus, text: 'Crear un producto manualmente' },
      {
        type: 'steps',
        items: [
          ['Menú ', { strong: 'Inventario → Catálogo' }, '.'],
          ['Botón ', { strong: '+ Nuevo producto' }, '.'],
          [{ strong: 'Código' }, ' (único, ej. PROD-001), ', { strong: 'descripción' }, ', ', { strong: 'unidad' }, ' (pza, kg, lt…), ', { strong: 'categoría' }, ' y ', { strong: 'stock mínimo' }, '.'],
          ['Opcional: ', { strong: 'imagen' }, ', ', { strong: 'proveedor default' }, ' y ', { strong: 'contacto' }, ' (estos últimos sirven para Compras Express).'],
          'Guardar — el producto arranca con stock 0 en todas las bodegas.',
        ],
      },
      {
        type: 'info', tone: 'amber', icon: Lightbulb,
        text: ['El ', { strong: 'código' }, ' es lo que se imprime en los QRs (etiquetas). No se puede cambiar después si ya hay movimientos.'],
      },
      { type: 'h3', icon: FileSpreadsheet, text: 'Importar masivo desde Excel' },
      {
        type: 'steps',
        items: [
          ['Menú ', { strong: 'Catálogo → Importar' }, '.'],
          ['Descargar la ', { strong: 'plantilla Excel' }, ' (botón).'],
          'Llenar las columnas: código, descripción, categoría, unidad, stock_minimo, stock_inicial.',
          'Subir el archivo. El sistema valida fila por fila.',
          'Si una categoría es nueva, se crea automáticamente con normalización (case/acento-insensitive).',
        ],
      },
      {
        type: 'info', tone: 'green', icon: CheckCircle2,
        text: 'Las filas con código duplicado o vacío se rechazan, pero las demás sí se importan (no aborta todo).',
      },
      { type: 'h3', icon: Edit3, text: 'Editar un producto' },
      {
        type: 'bullets',
        items: [
          ['En la lista, ícono lápiz → modal con los mismos campos.'],
          ['El ', { strong: 'código no se puede modificar' }, ' si hay movimientos registrados.'],
          ['Cambiar el ', { strong: 'stock mínimo' }, ' afecta inmediatamente la alerta de Bajo mínimo.'],
          ['Marcar como ', { strong: 'inactivo' }, ' lo oculta del catálogo pero mantiene su histórico.'],
        ],
      },
      { type: 'h3', icon: Warehouse, text: 'Ver stock por bodega (ícono almacén)' },
      {
        type: 'p',
        text: ['En cada fila del catálogo hay un ícono de bodega. Al hacer click se abre un modal con el desglose: cuánto hay en cada almacén. Si la suma de bodegas no coincide con el campo ', { code: 'stock_actual' }, ' aparece aviso (rara vez, indicaría un problema de caché).'],
      },
    ],
  },

  // 3. Almacenes y Estantes
  {
    id: 'almacenes',
    num: 3,
    title: 'Almacenes y Estantes',
    icon: Boxes,
    accent: 'violet',
    intro: 'Los almacenes son bodegas físicas. Los estantes son subdivisiones dentro de un almacén. Cada estante tiene su propio QR escaneable.',
    blocks: [
      { type: 'h3', icon: Plus, text: 'Crear un almacén' },
      {
        type: 'steps',
        items: [
          ['Menú ', { strong: 'Inventario → Almacenes' }, '.'],
          ['Botón ', { strong: '+ Nuevo almacén' }, '.'],
          [{ strong: 'Nombre' }, ' (ej. "Bodega Principal") y ', { strong: 'ubicación' }, ' (texto libre).'],
          'Guardar. El sistema genera un QR único para el almacén.',
        ],
      },
      { type: 'h3', icon: MapPin, text: 'Crear estantes dentro del almacén' },
      {
        type: 'steps',
        items: [
          ['Click en el almacén → panel derecho muestra sus estantes.'],
          ['Botón ', { strong: '+ Añadir estante' }, '.'],
          [{ strong: 'Nombre' }, ' (ej. "Rack A-1"), ', { strong: 'descripción' }, ' opcional (texto libre).'],
          ['Click en ', { strong: 'Guardar y abrir QR' }, ' para descargar/imprimir el QR para pegar al estante físico.'],
        ],
      },
      { type: 'h3', icon: QrCode, text: 'Asignar productos a un estante' },
      {
        type: 'p',
        text: ['Cada estante puede tener una lista de productos asignados. Esto es lo que aparece cuando el almacenista escanea el QR del estante desde el celular.'],
      },
      {
        type: 'steps',
        items: [
          ['En la tabla de estantes, botón ', { strong: 'Productos' }, '.'],
          'Modal con checkboxes y buscador. Marca los productos que viven en ese estante.',
          'Click Guardar. El mapping se reemplaza completo (idempotente).',
        ],
      },
      {
        type: 'info', tone: 'blue', icon: Info,
        text: ['Un producto puede estar asignado a ', { strong: 'varios estantes' }, ' (no es 1:1). Si está en varios, al escanear cualquiera lo verá. La cantidad NO se trackea por estante — solo por almacén.'],
      },
      { type: 'h3', icon: Printer, text: 'Imprimir los QRs' },
      {
        type: 'bullets',
        items: [
          ['Botón ', { strong: 'Imprimir QR' }, ' en cada estante abre una página optimizada para impresión.'],
          'Imprimir en papel adhesivo, pegar al estante físico.',
          'Al escanear con el celular se abre la lista de productos asignados.',
        ],
      },
    ],
  },

  // 4. Stock por almacén
  {
    id: 'stock-por-bodega',
    num: 4,
    title: 'Stock por Bodega (cómo se calcula)',
    icon: Warehouse,
    accent: 'teal',
    intro: 'A partir de la actualización de mayo 2026, el stock real vive por bodega, no como un único número global. Esto permite TRASPASOS reales y reportes por sucursal.',
    blocks: [
      { type: 'h3', icon: Calculator, text: 'Modelo de datos' },
      {
        type: 'cards2',
        items: [
          { icon: Package, color: 'text-blue-500', title: 'stock_actual (cache global)', text: 'Suma de todas las bodegas para ese producto. Lo que se ve en el catálogo. Se recalcula automáticamente con cada movimiento.' },
          { icon: Warehouse, color: 'text-teal-500', title: 'StockPorAlmacen (fuente de verdad)', text: 'Tabla con (producto, almacén) → cantidad. Es lo que cuenta para validaciones de SALIDA y TRASPASO.' },
        ],
      },
      { type: 'h3', icon: Lock, text: 'Reservas (stock apartado)' },
      {
        type: 'p',
        text: ['Cuando una solicitud pasa a APROBADA, su cantidad queda ', { strong: 'reservada' }, '. No se descuenta del stock todavía, pero ya no se puede usar en otras solicitudes.'],
      },
      { type: 'formula', label: 'Stock disponible', code: 'stock_disponible = stock_actual - stock_reservado' },
      {
        type: 'bullets',
        items: [
          ['SALIDA manual valida contra ', { code: 'stock_disponible' }, '. No puede invadir lo apartado.'],
          ['Aprobar más solicitudes que el disponible → ', { strong: 'rechazo con 409' }, '.'],
          'Cancelar/rechazar una solicitud aprobada libera la reserva automáticamente.',
        ],
      },
      {
        type: 'info', tone: 'green', icon: CheckCircle2,
        text: 'En el catálogo, los productos con reservas activas muestran "(X apart.)" debajo del stock — pasa el mouse para ver el desglose por solicitud.',
      },
    ],
  },

  // 5. Movimientos
  {
    id: 'movimientos',
    num: 5,
    title: 'Movimientos de Inventario',
    icon: ArrowRightLeft,
    accent: 'rose',
    intro: 'Toda variación de stock se hace mediante un Movimiento. Hay 4 tipos. Cada uno requiere distintos campos.',
    blocks: [
      { type: 'h3', icon: PlayCircle, text: 'Tipos de movimiento' },
      {
        type: 'cards2',
        items: [
          { icon: Plus, color: 'text-emerald-500', title: 'ENTRADA (+)', text: 'Suma stock a una bodega. Requiere almacén destino. Cantidad positiva.' },
          { icon: Minus, color: 'text-rose-500', title: 'SALIDA (−)', text: 'Resta stock de una bodega. Requiere almacén origen. Valida contra disponible (no toca lo apartado).' },
          { icon: ArrowRightLeft, color: 'text-blue-500', title: 'TRASPASO (→)', text: 'Mueve stock de bodega A → bodega B. Total global no cambia. Lock determinístico anti-deadlock.' },
          { icon: AlertTriangle, color: 'text-amber-500', title: 'AJUSTE (±)', text: 'Corrige el stock por conteo, merma o error. Acepta cantidad positiva (aumentar) o negativa (disminuir). Motivo obligatorio.' },
        ],
      },
      { type: 'h3', icon: Edit3, text: 'Cómo registrar un movimiento' },
      {
        type: 'steps',
        items: [
          ['Menú ', { strong: 'Inventario → Registrar movimiento' }, '.'],
          'Elegir el tipo (Entrada / Salida / Traspaso / Ajuste).',
          'Seleccionar el producto del catálogo.',
          'Elegir la bodega (origen, destino o ambas según tipo).',
          ['Capturar la ', { strong: 'cantidad' }, '. Para AJUSTE: usar los botones ', { strong: 'Aumentar' }, ' o ', { strong: 'Disminuir' }, '.'],
          ['Escribir un ', { strong: 'motivo' }, ' (obligatorio en AJUSTE, opcional en los otros).'],
          'Click Registrar. El panel derecho muestra el cálculo en vivo.',
        ],
      },
      { type: 'h3', icon: Calculator, text: 'Validaciones automáticas' },
      {
        type: 'bullets',
        items: [
          'No se puede dejar el stock global negativo.',
          'No se puede sacar más de lo disponible en la bodega origen.',
          ['No se puede invadir stock reservado (', { strong: 'apartado' }, ' por solicitudes APROBADAS).'],
          ['TRASPASO requiere bodegas ', { strong: 'distintas' }, '.'],
          ['Si el movimiento dejará el stock por debajo del mínimo, aparece banner amarillo y se ', { strong: 'genera notificación' }, ' STOCK_BAJO (idempotente por día).'],
        ],
      },
      {
        type: 'info', tone: 'amber', icon: Lightbulb,
        text: ['Para ajustes, el sistema te pregunta ', { strong: 'qué pasó con el stock' }, ' (aumentar/disminuir) en lugar de pedirte que escribas el signo. La cantidad siempre es positiva.'],
      },
    ],
  },

  // 6. Kardex
  {
    id: 'kardex',
    num: 6,
    title: 'Kardex — Historial por Producto',
    icon: History,
    accent: 'indigo',
    intro: 'El Kardex es el libro mayor de un producto: todos los movimientos en orden cronológico con saldo corrido.',
    blocks: [
      { type: 'h3', icon: PlayCircle, text: 'Acceder al Kardex' },
      {
        type: 'steps',
        items: [
          ['Menú ', { strong: 'Catálogo' }, '.'],
          ['En la fila del producto, ícono ', { strong: 'reloj/historia' }, '.'],
          'Se abre la vista timeline con todos los movimientos.',
        ],
      },
      { type: 'h3', icon: Calculator, text: 'Cómo se calcula el saldo' },
      {
        type: 'formula', label: 'Saldo después del movimiento N',
        code: 'saldo[N] = saldo[N-1] + (entradas - salidas)',
      },
      {
        type: 'p',
        text: ['El sistema parte del ', { code: 'stock_actual' }, ' y resta los movimientos posteriores a la fecha seleccionada para obtener el ', { strong: 'saldo inicial' }, ' del periodo. Luego suma/resta movimiento por movimiento.'],
      },
      { type: 'h3', icon: Edit3, text: 'Filtros disponibles' },
      {
        type: 'bullets',
        items: [
          'Rango de fechas (default últimos 30 días).',
          'Tipo de movimiento (ENTRADA / SALIDA / AJUSTE / TRASPASO).',
          'Usuario que registró el movimiento.',
          'Toggle de orden (más reciente arriba o más antiguo arriba).',
        ],
      },
      {
        type: 'info', tone: 'blue', icon: Info,
        text: ['Los TRASPASOS aparecen como delta=0 (no cambian el total) pero se muestran en azul para trazabilidad: te dicen ', { strong: 'de qué bodega salió a cuál' }, '.'],
      },
      { type: 'h3', icon: FileSpreadsheet, text: 'Exportar a Excel' },
      {
        type: 'p',
        text: ['Botón ', { strong: 'Exportar a Excel' }, ' en la barra superior. Descarga un xlsx con 2 hojas: Resumen (KPIs) y Kardex (filas con saldo corrido).'],
      },
    ],
  },

  // 7. Bajo mínimo
  {
    id: 'bajo-minimo',
    num: 7,
    title: 'Bajo Mínimo y Alertas',
    icon: AlertTriangle,
    accent: 'amber',
    intro: 'La pantalla más importante del día a día: te dice qué productos están por agotarse y cuántos días te quedan.',
    blocks: [
      { type: 'h3', icon: PlayCircle, text: 'Cómo se calcula' },
      {
        type: 'cards2',
        items: [
          { icon: Calculator, color: 'text-amber-500', title: 'Consumo promedio diario', text: 'Suma de SALIDAs de los últimos 30 días / 30.' },
          { icon: Calculator, color: 'text-rose-500', title: 'Días restantes', text: 'stock_actual / consumo_promedio. Si consumo=0, se muestra "—" (estático).' },
        ],
      },
      { type: 'h3', icon: ShieldCheck, text: 'Códigos de color por urgencia' },
      {
        type: 'bullets',
        items: [
          ['Rojo: ', { strong: 'crítico' }, ' (menos de 7 días de stock).'],
          ['Amarillo: ', { strong: 'alto' }, ' (entre 7 y 14 días).'],
          ['Normal: ', { strong: 'medio' }, ' (más de 14 días).'],
          ['Gris ', { strong: 'estático' }, ': sin consumo en 30 días.'],
        ],
      },
      { type: 'h3', icon: Bell, text: 'Notificaciones automáticas' },
      {
        type: 'p',
        text: ['Cuando una SALIDA hace que el stock cruce el umbral mínimo (antes estaba arriba, ahora abajo), el sistema crea una notificación in-app para todos los usuarios con rol inventario+admin. ', { strong: 'Solo al cruzar' }, ' — los movimientos siguientes bajo mínimo no spamean.'],
      },
      {
        type: 'info', tone: 'amber', icon: Lightbulb,
        text: ['Idempotencia diaria: si en el mismo día hay 5 SALIDAs que mantienen el stock bajo, ', { strong: 'solo 1 notificación' }, ' se crea (la del primer cruce).'],
      },
      { type: 'h3', icon: ShoppingCart, text: 'Generar OC desde aquí' },
      {
        type: 'p',
        text: ['Cada producto tiene un botón de carrito ', { icon: ShoppingCart }, '. Selecciona varios y usa ', { strong: 'Generar OC Express' }, ' (ver sección Compras Express).'],
      },
    ],
  },

  // 8. Solicitudes de material
  {
    id: 'solicitudes',
    num: 8,
    title: 'Solicitudes de Material',
    icon: ClipboardList,
    accent: 'blue',
    intro: 'Los trabajadores y coordinadores piden material vía solicitudes. Inventario aprueba, ajusta y entrega.',
    blocks: [
      { type: 'h3', icon: PlayCircle, text: 'Ciclo de vida' },
      {
        type: 'cards2',
        items: [
          { icon: Edit3, color: 'text-blue-500', title: 'PENDIENTE', text: 'Solicitante creó la solicitud. Inventario la ve en su bandeja. Aún no afecta el stock.' },
          { icon: CheckCircle2, color: 'text-emerald-500', title: 'APROBADA', text: 'Inventario aprobó. El stock queda APARTADO (reservado). No se puede entregar todavía si no hay físicamente.' },
          { icon: Truck, color: 'text-violet-500', title: 'ENTREGADA', text: 'Inventario entregó (total o parcial). Se descuenta el stock real, se libera la reserva.' },
          { icon: XCircle, color: 'text-rose-500', title: 'RECHAZADA', text: 'Inventario rechaza. La reserva se libera. No se puede reabrir.' },
        ],
      },
      { type: 'h3', icon: Edit3, text: 'Aprobar una solicitud' },
      {
        type: 'steps',
        items: [
          ['Menú ', { strong: 'Solicitudes' }, '.'],
          'Click en la fila pendiente → modal "Ver detalles".',
          'Revisar líneas (producto, cantidad solicitada, comentarios).',
          ['Si quieres ajustar lo aprobado vs lo solicitado, ícono lápiz por línea → modifica ', { code: 'cantidad_aprobada' }, '.'],
          ['Botón ', { strong: 'Aprobar' }, ' → estado pasa a APROBADA y reserva el stock.'],
        ],
      },
      {
        type: 'info', tone: 'amber', icon: Lightbulb,
        text: ['Si al aprobar no hay stock disponible suficiente, el sistema responde 409 y la solicitud queda PENDIENTE. Resolver con ENTRADA del producto faltante antes de reintentar.'],
      },
      { type: 'h3', icon: Truck, text: 'Entregar (total o parcial)' },
      {
        type: 'steps',
        items: [
          'Solicitud APROBADA → botón Entregar abre el modal.',
          'Seleccionar la bodega origen (de dónde sale el material).',
          'En cada línea, ajustar la cantidad a entregar AHORA (puede ser parcial).',
          'Click Guardar. Genera SALIDAs por cada línea con cantidad > 0.',
          'Si todas las líneas quedan completas → estado ENTREGADA. Si no → sigue APROBADA con badge "Entrega parcial".',
        ],
      },
      {
        type: 'info', tone: 'green', icon: CheckCircle2,
        text: ['Entrega parcial: puedes hacer varias entregas hasta completar. Cada entrega libera la reserva equivalente. El sistema cobra solo lo entregado, no lo aprobado.'],
      },
      { type: 'h3', icon: FileText, text: 'PDF de la solicitud' },
      {
        type: 'p',
        text: ['Cada solicitud tiene un PDF descargable con folio, fecha, solicitante, proyecto, lista de materiales/herramientas y firmas. Útil para entregar copia física al trabajador.'],
      },
    ],
  },

  // 9. Etiquetas imprimibles
  {
    id: 'etiquetas',
    num: 9,
    title: 'Etiquetas Imprimibles',
    icon: Tag,
    accent: 'indigo',
    intro: 'Generador de PDFs con códigos QR o de barras para pegar a cajas, productos individuales o ubicaciones.',
    blocks: [
      { type: 'h3', icon: PlayCircle, text: 'Cómo generar' },
      {
        type: 'steps',
        items: [
          ['Menú ', { strong: 'Inventario → Etiquetas' }, '.'],
          'Elegir formato: Avery 5160 (30 etiq/hoja, chicas) o Avery 5163 (10 etiq/hoja, grandes).',
          'Elegir tipo: QR Code (recomendado, el scanner móvil los lee) o Code 128 (lineal).',
          'En el catálogo (panel derecho) buscar productos y agregarlos con el botón +.',
          'En cada línea seleccionada, escribir cuántas etiquetas quieres de ese producto.',
          ['Click ', { strong: 'Generar PDF' }, '. Se abre en pestaña nueva listo para imprimir.'],
        ],
      },
      {
        type: 'info', tone: 'blue', icon: Info,
        text: ['Tope máximo: ', { strong: '500 etiquetas por PDF' }, ' para evitar archivos enormes.'],
      },
      { type: 'h3', icon: Printer, text: 'Imprimir bien' },
      {
        type: 'bullets',
        items: [
          'Usar hojas Avery del formato exacto seleccionado.',
          'En el diálogo de impresión: tamaño "Real / 100%", márgenes "Ninguno".',
          'Prueba primero con una hoja en blanco para verificar alineación.',
        ],
      },
    ],
  },

  // 10. Reportes
  {
    id: 'reportes',
    num: 10,
    title: 'Reportes Excel',
    icon: FileSpreadsheet,
    accent: 'emerald',
    intro: '5 reportes Excel para análisis y entrega a contabilidad/gerencia. Todos respetan filtros y traen el header azul corporativo.',
    blocks: [
      { type: 'h3', icon: FileText, text: 'Reportes disponibles' },
      {
        type: 'cards2',
        items: [
          { icon: Package, color: 'text-blue-500', title: 'Inventario actual', text: 'Snapshot del stock por producto (actual, reservado, disponible, mínimo, estado OK/BAJO). Filtros: categoría, solo bajo mínimo.' },
          { icon: ArrowRightLeft, color: 'text-rose-500', title: 'Movimientos', text: 'Historial filtrado por fechas, tipo, producto o usuario. Default 30 días.' },
          { icon: History, color: 'text-indigo-500', title: 'Kardex de un producto', text: '2 hojas: Resumen + Kardex con saldo corrido. Requiere elegir producto.' },
          { icon: ClipboardList, color: 'text-violet-500', title: 'Consumo por proyecto', text: 'Agrupa solicitudes por proyecto + producto. Por default incluye APROBADAS y ENTREGADAS.' },
          { icon: Send, color: 'text-emerald-500', title: 'Solicitudes', text: 'Listado plano con totales solicitada/aprobada/entregada por solicitud.' },
        ],
      },
      { type: 'h3', icon: PlayCircle, text: 'Cómo descargar' },
      {
        type: 'steps',
        items: [
          ['Menú ', { strong: 'Inventario → Reportes' }, '.'],
          'Cada reporte es una card con sus filtros (fechas, selects, checkbox).',
          ['Click ', { strong: 'Descargar Excel' }, '. El botón se deshabilita si faltan filtros requeridos o el rango está invertido.'],
        ],
      },
      {
        type: 'info', tone: 'blue', icon: Info,
        text: ['Tope: ', { strong: '10,000 filas por reporte' }, '. Si esperas más, filtra por fecha o categoría.'],
      },
    ],
  },

  // 11. Compras express (OC)
  {
    id: 'oc-express',
    num: 11,
    title: 'Compras Express (OC + WhatsApp)',
    icon: ShoppingCart,
    accent: 'amber',
    intro: 'Genera órdenes de compra rápidas para enviar al proveedor por PDF o WhatsApp. No construye un módulo de compras completo — es un atajo desde Bajo Mínimo.',
    blocks: [
      { type: 'h3', icon: Edit3, text: 'Configurar proveedor default por producto' },
      {
        type: 'p',
        text: ['En el catálogo, al editar un producto, hay 2 campos opcionales: ', { strong: 'Proveedor' }, ' (nombre) y ', { strong: 'Contacto' }, ' (teléfono/email). Llenarlos permite que las OC Express se agrupen por proveedor automáticamente.'],
      },
      { type: 'h3', icon: PlayCircle, text: 'Generar una OC' },
      {
        type: 'steps',
        items: [
          ['Menú ', { strong: 'Bajo mínimo' }, '.'],
          'Marcar los checkboxes de los productos a comprar.',
          ['Click ', { strong: 'Generar OC Express' }, '.'],
          'Modal abre con los productos agrupados por proveedor. Cada grupo muestra cantidad sugerida según consumo de los últimos 30 días.',
          'Ajustar cantidades a comprar (puedes quitar líneas).',
          ['Click ', { strong: 'Generar PDF' }, ' por proveedor. Se abre en pestaña nueva.'],
          ['Aparece bloque con ', { strong: 'Descargar PDF' }, ' + ', { strong: 'Enviar por WhatsApp' }, '.'],
        ],
      },
      { type: 'h3', icon: Calculator, text: 'Cómo se sugiere la cantidad' },
      {
        type: 'formula', label: 'Necesidad mensual',
        code: 'necesidad = (consumo_diario × 30) - stock_actual + stock_minimo',
      },
      {
        type: 'p',
        text: ['Si la fórmula da ≤ 0 (porque hay suficiente), usa el fallback: ', { code: 'max(0, stock_minimo - stock_actual)' }, '. Redondeo hacia arriba a 2 decimales.'],
      },
      {
        type: 'info', tone: 'amber', icon: Lightbulb,
        text: ['La OC ', { strong: 'NO se persiste' }, ' en el sistema (es throw-away). El stock NO se incrementa hasta que registres la ENTRADA real al recibir el material.'],
      },
    ],
  },

  // 12. Tomas físicas
  {
    id: 'tomas',
    num: 12,
    title: 'Tomas Físicas de Inventario',
    icon: ClipboardCheck,
    accent: 'violet',
    intro: 'Conteo físico periódico de un almacén. El sistema snapshotea el stock, tú capturas lo real, y al cerrar se generan los AJUSTES automáticos.',
    blocks: [
      { type: 'h3', icon: PlayCircle, text: 'Iniciar una toma' },
      {
        type: 'steps',
        items: [
          ['Menú ', { strong: 'Inventario → Tomas físicas' }, '.'],
          ['Botón ', { strong: 'Iniciar toma' }, '.'],
          'Elegir almacén y agregar notas opcionales (ej. "Toma trimestral abril 2026").',
          ['Click ', { strong: 'Iniciar' }, '. El sistema crea una toma ABIERTA y snapshotea TODOS los productos activos con su stock actual en ese almacén.'],
        ],
      },
      {
        type: 'info', tone: 'rose', icon: Ban,
        text: ['Solo puede haber ', { strong: 'una toma ABIERTA por almacén' }, ' a la vez. Si intentas iniciar otra, el sistema te dice cuál está abierta.'],
      },
      { type: 'h3', icon: Edit3, text: 'Capturar cantidades físicas' },
      {
        type: 'bullets',
        items: [
          ['Tabla con cada producto: ', { strong: 'Sistema' }, ' (lo que el sistema cree) y ', { strong: 'Físico' }, ' (lo que vas a contar).'],
          ['Click en la celda "Físico" → edición inline. Enter para guardar, Esc para cancelar.'],
          ['Filtros: ', { strong: 'Todos' }, ' / ', { strong: 'Sin capturar' }, ' / ', { strong: 'Con diferencia' }, ' / ', { strong: 'Iguales' }, '.'],
          ['KPIs en vivo: progreso, líneas con diferencia, no capturadas.'],
        ],
      },
      { type: 'h3', icon: Smartphone, text: 'Modo scanner móvil' },
      {
        type: 'p',
        text: ['En celular, botón ', { strong: 'Escanear producto' }, ' abre la cámara. Al detectar un QR, abre input grande de cantidad. Enter → guarda y vuelve al scanner. Workflow ideal para almacenista con el celular en la mano.'],
      },
      { type: 'h3', icon: Lock, text: 'Cerrar la toma' },
      {
        type: 'steps',
        items: [
          ['Botón ', { strong: 'Cerrar y aplicar ajustes' }, '.'],
          ['Modal de confirmación muestra cuántos ajustes se generarán y cuántas líneas quedaron sin capturar.'],
          ['Por default, las ', { strong: 'no capturadas se asumen iguales al sistema' }, ' (no se ajustan). Hay un checkbox para tratarlas como "cantidad física = 0" (riesgoso).'],
          ['Click ', { strong: 'Cerrar y generar ajustes' }, '. Por cada línea con diferencia se crea un AJUSTE en el kardex con motivo "Toma física #N".'],
        ],
      },
      {
        type: 'info', tone: 'amber', icon: Lightbulb,
        text: ['Una vez ', { strong: 'CERRADA' }, ' la toma queda en solo lectura. El PDF de acta se puede descargar siempre desde el botón Imprimir acta PDF.'],
      },
      { type: 'h3', icon: Ban, text: 'Cancelar una toma' },
      {
        type: 'p',
        text: ['Si la toma está mal o ya no aplica, ', { strong: 'Cancelar toma' }, ' la cierra sin generar ningún ajuste. Queda como CANCELADA, también solo lectura.'],
      },
    ],
  },

  // 13. Scanner móvil PWA
  {
    id: 'scanner',
    num: 13,
    title: 'Scanner Móvil (PWA)',
    icon: ScanLine,
    accent: 'teal',
    intro: 'El sistema se puede usar como app instalada en el celular del almacenista. Funciones específicas: escaneo de QRs, acción rápida, captura de toma.',
    blocks: [
      { type: 'h3', icon: Smartphone, text: 'Instalar la PWA' },
      {
        type: 'bullets',
        items: [
          ['Android (Chrome): menú ⋮ → ', { strong: 'Instalar app' }, ' o ', { strong: 'Añadir a pantalla de inicio' }, '.'],
          ['iPhone (Safari): botón compartir → ', { strong: 'Añadir a pantalla de inicio' }, '.'],
          'Una vez instalada se ve como una app normal en el celular.',
        ],
      },
      { type: 'h3', icon: QrCode, text: 'Qué reconoce el scanner' },
      {
        type: 'cards2',
        items: [
          { icon: Boxes, color: 'text-violet-500', title: 'QR de estante', text: 'Abre el menú del estante con su lista de productos asignados. Permite Entrada/Salida/Ajuste de cualquier producto del estante.' },
          { icon: Package, color: 'text-emerald-500', title: 'QR de producto', text: 'Abre acción rápida con el producto. Botones Entrada/Salida/Ajuste + cantidad + Registrar. Usa el almacén default.' },
          { icon: Wrench, color: 'text-amber-500', title: 'QR de herramienta', text: 'Navega a la ficha de la unidad. Permite ver su historial de asignaciones e incidencias.' },
        ],
      },
      { type: 'h3', icon: Lightbulb, text: 'Tips de uso' },
      {
        type: 'bullets',
        items: [
          'Pegar los QRs a los estantes a la altura del ojo del almacenista.',
          'Los QRs de productos se pegan a la caja (no a cada pieza individual).',
          ['Si un QR no se reconoce, el scanner te dice ', { strong: '"no es estante, herramienta ni producto"' }, '. Verifica que el código existe en el sistema.'],
          ['Después de registrar un movimiento, la cámara ', { strong: 'reabre automáticamente' }, ' para escanear el siguiente — diseñado para ráfagas rápidas.'],
        ],
      },
    ],
  },

  // 14. Herramientas
  {
    id: 'herramientas',
    num: 14,
    title: 'Módulo de Herramientas',
    icon: Wrench,
    accent: 'rose',
    intro: 'Catálogo aparte para herramientas. Cada herramienta tiene unidades individuales que se asignan a un trabajador, se mantienen y se dan de baja.',
    blocks: [
      { type: 'h3', icon: Package, text: 'Catálogo vs Unidades' },
      {
        type: 'cards2',
        items: [
          { icon: Wrench, color: 'text-blue-500', title: 'Herramienta (catálogo)', text: 'El tipo de herramienta. Ej. "Taladro Makita HP1640". Tiene categoría y descripción.' },
          { icon: QrCode, color: 'text-amber-500', title: 'Unidad', text: 'Una herramienta física específica con su propio código interno y QR. Una herramienta puede tener N unidades.' },
        ],
      },
      { type: 'h3', icon: Send, text: 'Estados de una unidad' },
      {
        type: 'bullets',
        items: [
          [{ strong: 'DISPONIBLE' }, ' — en bodega, lista para asignar.'],
          [{ strong: 'ASIGNADA' }, ' — entregada a un trabajador.'],
          [{ strong: 'EN_MANTENIMIENTO' }, ' — en reparación.'],
          [{ strong: 'DAÑADA' }, ' — reportada como rota/dañada.'],
          [{ strong: 'EXTRAVIADA' }, ' — reportada como perdida.'],
          [{ strong: 'DADA_DE_BAJA' }, ' — fuera del sistema (chatarrizada).'],
        ],
      },
      { type: 'h3', icon: PlayCircle, text: 'Flujo típico' },
      {
        type: 'steps',
        items: [
          'Crear la herramienta en el catálogo (tipo).',
          'Crear N unidades de esa herramienta (cada una con QR).',
          ['Asignar una unidad a un trabajador (estado pasa a ', { strong: 'ASIGNADA' }, ').'],
          'Trabajador la usa. Si hay problema → crea incidencia.',
          'Trabajador devuelve → ASIGNADA pasa a DEVUELTA, unidad vuelve a DISPONIBLE.',
          'Si requiere mantenimiento → cambio de estado a EN_MANTENIMIENTO, registrar el mantenimiento.',
          'Si llega al final de vida → solicitud de baja → aprobada → DADA_DE_BAJA.',
        ],
      },
      {
        type: 'info', tone: 'blue', icon: Info,
        text: ['Los trabajadores pueden ver sus herramientas asignadas y reportar incidencias desde su menú ', { strong: 'Mis herramientas' }, ' (rol solicitante_material).'],
      },
    ],
  },
]

// ── Reglas clave del sistema (banner final) ─────────────────────────────────

const REGLAS_CLAVE = [
  { icon: ShieldCheck, text: ['Toda variación de stock se hace vía ', { strong: 'Movimiento' }, '. No hay edición directa del stock_actual.'] },
  { icon: Warehouse, text: ['El stock vive ', { strong: 'por bodega' }, '. El catálogo muestra la suma global como cache.'] },
  { icon: Lock, text: ['Las solicitudes APROBADAS ', { strong: 'reservan' }, ' stock. SALIDA manual no puede invadirlo.'] },
  { icon: AlertTriangle, text: ['STOCK_BAJO se notifica al ', { strong: 'cruzar' }, ' el umbral, no en cada movimiento posterior.'] },
  { icon: ClipboardCheck, text: ['Solo una ', { strong: 'toma ABIERTA' }, ' por almacén. Cerrar toma genera AJUSTES automáticos.'] },
  { icon: History, text: ['Kardex es ', { strong: 'inmutable' }, ' — corrección se hace con otro movimiento que compense.'] },
]

// ═══════════════════════════════════════════════════════════════════════════
// Helpers de estilo
// ═══════════════════════════════════════════════════════════════════════════

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
  aprobada:  'success',
  pendiente: 'info',
  entregada: 'success',
  rechazada: 'danger',
  cerrada:   'neutral',
}

const INFO_TONE = {
  blue:  'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 text-blue-900 dark:text-blue-200',
  amber: 'bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 text-amber-900 dark:text-amber-200',
  green: 'bg-emerald-50 dark:bg-emerald-900/20 border-l-4 border-emerald-500 text-emerald-900 dark:text-emerald-200',
  rose:  'bg-rose-50 dark:bg-rose-900/20 border-l-4 border-rose-500 text-rose-900 dark:text-rose-200',
}

// ═══════════════════════════════════════════════════════════════════════════
// Render de tokens enriquecidos
// ═══════════════════════════════════════════════════════════════════════════

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
  if (t.icon) {
    const Ic = t.icon
    return <Ic key={k} size={14} className="inline-block align-text-bottom mx-0.5 text-ink-500 dark:text-ink-400" />
  }
  return null
}

// ═══════════════════════════════════════════════════════════════════════════
// Bloques
// ═══════════════════════════════════════════════════════════════════════════

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

    case 'formula':
      return <FormulaBox label={block.label} code={block.code} highlight={block.highlight} />

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

// ═══════════════════════════════════════════════════════════════════════════
// Sección colapsable
// ═══════════════════════════════════════════════════════════════════════════

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

function ReglasClave() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-brand-700 to-brand-900 dark:from-brand-800 dark:to-brand-950 p-6 sm:p-7 text-white shadow-lg mt-6">
      <h3 className="flex items-center gap-2 font-bold text-base mb-4">
        <Star size={18} className="text-amber-300" />
        Reglas Clave del Inventario
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

// ═══════════════════════════════════════════════════════════════════════════
// Búsqueda
// ═══════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════
// Componente principal
// ═══════════════════════════════════════════════════════════════════════════

export default function ManualInventario() {
  // Todos los hooks ANTES de cualquier early return — rules of hooks.
  const isMobileDevice = useIsMobileDevice()
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

  // En celular el manual no aplica — redirige al scanner.
  if (isMobileDevice) {
    return <Navigate to="/inventario/scanner" replace />
  }

  return (
    <>
      <PageHeader
        icon={BookOpen}
        title="Manual del Módulo de Inventario"
        description="Guía operativa completa — catálogo, bodegas, movimientos, solicitudes, tomas, scanner, herramientas."
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

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        <aside className="hidden lg:block print:hidden">
          <nav className="sticky top-4 bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-xl p-3 shadow-card">
            <div className="flex items-center gap-2 px-2 pb-2 mb-2 border-b border-ink-100 dark:border-ink-800">
              <MousePointerClick size={13} className="text-brand-500" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">
                Contenido
              </span>
            </div>
            <ul className="space-y-0.5 max-h-[calc(100vh-180px)] overflow-y-auto">
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
