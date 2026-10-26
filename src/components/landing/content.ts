import {
  BadgePercent,
  BellRing,
  CreditCard,
  BookOpen,
  FileText,
  Stamp,
  CalendarClock,
  ChefHat,
  Globe,
  BarChart3,
  Boxes,
  Calculator,
  Clock,
  FlaskConical,
  HeartHandshake,
  LayoutDashboard,
  NotebookPen,
  Package,
  Receipt,
  Scale,
  ShieldCheck,
  ShoppingBag,
  Store,
  Tag,
  Target,
  Truck,
  Users,
  UsersRound,
  Vault,
  type LucideIcon,
} from "lucide-react"
import { BILLING_ENABLED } from "@/lib/plans"
import { CONTACT_EMAIL, WHATSAPP } from "@/lib/contact"

// Textos de las páginas públicas. Solo se describe lo que el producto hace hoy;
// lo que viene se marca como "Próximamente".

export type Feature = { icon: LucideIcon; title: string; text: string }

export const HIGHLIGHTS: Feature[] = [
  {
    icon: ShoppingBag,
    title: "Ventas en segundos",
    text: "Anota una venta desde el celular con solo el monto, o con detalle de productos, cliente y forma de pago.",
  },
  {
    icon: NotebookPen,
    title: "Fiado sin cuaderno",
    text: "Anota lo que fías, registra los abonos y sabe de inmediato cuánto te debe cada cliente.",
  },
  { icon: Vault, title: "Cierre de caja", text: "Al final del día cuentas el efectivo y te decimos si falta o sobra dinero." },
  {
    icon: Receipt,
    title: "Gastos ordenados",
    text: "Arriendo, luz, proveedores, sueldos… todo en categorías para saber en qué se va tu dinero.",
  },
  {
    icon: LayoutDashboard,
    title: "Tu negocio de un vistazo",
    text: "Ventas, gastos y ganancia de hoy y del mes, con gráficos simples y comparaciones.",
  },
  {
    icon: BellRing,
    title: "Avisos al celular y al correo",
    text: "Un pedido nuevo, un descuento por aprobar, algo que se agota o un fiado atrasado: te avisamos de inmediato.",
  },
  {
    icon: Package,
    title: "Productos e inventario",
    text: "Costo, precio y stock de cada producto: cuánto ganas por unidad y qué tienes que reponer.",
  },
  { icon: UsersRound, title: "Tu equipo", text: "Invita a tus empleados: venden sin ver tus ganancias, y tú ves sus metas y comisiones." },
  {
    icon: Calculator,
    title: "Calculadoras simples",
    text: "Precio correcto, punto de equilibrio, metas y simulaciones, explicadas en palabras simples.",
  },
]

export type FeatureGroup = {
  id: string
  icon: LucideIcon
  title: string
  description: string
  points: string[]
}

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    id: "ventas",
    icon: ShoppingBag,
    title: "Ventas",
    description: "Registra cada venta en segundos, aunque estés atendiendo.",
    points: [
      "Venta rápida: escribe solo el monto y listo",
      "Venta con detalle: varios productos, cantidades y precios",
      "Efectivo, débito, crédito, transferencia, otro o fiado",
      "Cliente opcional en cada venta (obligatorio si es fiado)",
      "Corrige o elimina una venta si te equivocaste",
      "Devoluciones totales o parciales: vuelven al stock o quedan como merma, y la caja cuadra sola",
      "Historial con filtros por fecha: hoy, 7 días, este mes o el que elijas",
      "El stock se descuenta solo al vender un producto",
    ],
  },
  {
    id: "gastos",
    icon: Receipt,
    title: "Gastos",
    description: "Sabe exactamente en qué se va tu dinero cada mes.",
    points: [
      "Categorías listas: arriendo, luz, agua, internet, sueldos, publicidad y más",
      "Crea tus propias categorías",
      "Proveedor opcional en cada gasto",
      "Corrige o elimina un gasto si te equivocaste",
      "Ranking de las categorías donde más gastas",
      "Qué porcentaje de tus ventas se va en gastos",
    ],
  },
  {
    id: "fiado",
    icon: NotebookPen,
    title: "Fiado",
    description: "Lleva la cuenta de lo que te deben, sin cuaderno ni discusiones.",
    points: [
      "Marca una venta como fiado y escribe a quién le fiaste",
      "Cuánto te debe cada cliente y cuánto te deben en total",
      "Registra abonos parciales o el pago completo",
      "Historial de lo fiado y lo abonado de cada cliente",
      "Filtro para ver solo a los clientes que te deben",
      "Plazo de pago: ves quiénes se atrasaron y les cobras por WhatsApp en un toque",
      "Aviso semanal con el fiado por cobrar, al correo y al celular",
    ],
  },
  {
    id: "caja",
    icon: Vault,
    title: "Cierre de caja",
    description: "Cuadra el efectivo al final del día en un minuto.",
    points: [
      "Cuánto vendiste con cada medio de pago: efectivo, débito, transferencia…",
      "Incluye los abonos de fiado que te pagaron en efectivo",
      "Escribe cuánto contaste y te decimos si falta o sobra dinero",
      "Historial de cierres de los últimos días",
      "Comparte el cierre del día por WhatsApp",
      "Turnos de caja: cada persona abre con el sencillo y cuenta al salir; sabes en qué turno faltó o sobró",
      "Las propinas en efectivo se suman a lo que debería haber en la caja",
    ],
  },
  {
    id: "restaurantes",
    icon: ChefHat,
    title: "Comandas y cocina",
    description: "Para restaurantes, cafés, sangucherías y carros de comida (plan Pro).",
    points: [
      "Abre una comanda por mesa o pedido: Mesa 4, Barra, Para llevar, Delivery",
      "Tus mesas, las que quieras: hasta 200, más barra, terraza o lo que uses",
      "Ves de inmediato qué mesas están ocupadas y cuánto lleva cada una",
      "Notas por plato: “sin mayo”, “bien cocido”, “para llevar”",
      "Enviar a cocina: el pedido aparece en la pantalla de la cocina, sin papel",
      "La cocina marca cada plato listo y el garzón ve “Listo para servir”",
      "Si piden algo más, a la cocina le llega solo lo nuevo",
      "Al cobrar queda como venta: descuenta stock y suma a la caja y a tus reportes",
      "Cuenta dividida: cobra todo junto o lo de cada persona por separado",
      "Propina sugerida del 10% u otro monto, guardada aparte de tus ventas",
      "Carta con QR por mesa: el cliente pide desde su celular y el pedido llega marcado con su mesa",
      "Al tomar el pedido eliges de quién es cada plato, y la cuenta sale separada por persona",
      "Imprime la cuenta en tu impresora de boletas de 58 u 80 mm: por Bluetooth, en PDF o en imagen",
    ],
  },
  {
    id: "tienda",
    icon: Globe,
    title: "Tienda online",
    description: "Tu catálogo en internet: pedidos por WhatsApp sin comisión, o pagados con tarjeta con Mercado Pago (plan Pro).",
    points: [
      "Tu propia página: ordensimple.cl/tienda/tu-negocio",
      "Tus productos con foto, precio y stock, buscador y categorías: se ve como una vitrina",
      "El cliente arma su pedido y te lo manda por WhatsApp, ordenado y con emojis",
      "Retiro en el local o despacho, con la dirección",
      "Los precios salen de tu sistema: nadie los puede cambiar",
      "Pedidos web: lo registras como venta (o comanda) con un toque",
      "Aviso al celular apenas entra un pedido",
      "Compártela por WhatsApp o en tus redes con un botón",
      "Seguimiento del pedido: tu cliente ve en un enlace si está recibido, en preparación, listo o en camino, y entregado",
      "Le avisas cada cambio por WhatsApp con el mensaje ya escrito",
    ],
  },
  {
    id: "agenda",
    icon: CalendarClock,
    title: "Agenda y reservas",
    description: "Para peluquerías, barberías, estética, consultas, clases y talleres (plan Pro).",
    points: [
      "Servicios con precio y duración, aparte de tus productos",
      "Agenda del día por profesional, sin choques de hora",
      "Tus clientes reservan solos en tu página: eligen servicio, profesional, día y hora libre",
      "Tú decides el horario de atención, cada cuánto hay horas y con cuánta anticipación",
      "Recordatorio por WhatsApp a cada cliente, uno tras otro",
      "Estados: agendada, confirmada, llegó, no vino o cancelada",
      "Cobra la cita con un toque: queda como venta, con la comisión de quien atendió",
      "Aviso al celular de cada reserva nueva y las citas del día cada mañana",
    ],
  },
  {
    id: "promociones",
    icon: BadgePercent,
    title: "Promociones y cupones",
    description: "Descuentos que se aplican solos, sin que tu equipo tenga que acordarse (plan Pro).",
    points: [
      "2×1, 3×2 o “lleva X, paga Y” en los productos que elijas",
      "% de descuento en un producto, una categoría o todo",
      "Happy hour: solo ciertos días y horas (ej.: lunes a jueves de 18:00 a 20:00)",
      "Con fecha de inicio y término, o para siempre",
      "Se aplican solas al vender, en las comandas y en tu tienda online",
      "Cupones para la tienda online (BIENVENIDO10): % o monto, compra mínima y límite de usos",
      "En Reportes ves cuánto descontaste con cada una",
    ],
  },
  {
    id: "cotizaciones",
    icon: FileText,
    title: "Cotizaciones",
    description: "Presupuestos con tus precios que el cliente acepta desde un enlace (plan Pro).",
    points: [
      "Con tus productos guardados o lo que escribas: cantidades, precios y descuento",
      "Numeradas solas, con días de validez y una nota para el cliente",
      "Tu logo, RUT, dirección, contacto y condiciones en cada una",
      "IVA desglosado: neto, IVA y total",
      "Se envían por WhatsApp con un enlace: el cliente la ve, la descarga en PDF y la acepta o rechaza",
      "Sabes si ya la abrió y te llega un aviso al celular cuando responde",
      "La vendes con un toque y con los precios cotizados: se descuenta el stock",
      "Estados: pendiente, aceptada, rechazada, vencida y vendida",
    ],
  },
  {
    id: "cobros",
    icon: CreditCard,
    title: "Cobros online",
    description: "Tus clientes te pagan con tarjeta o Mercado Pago y el dinero llega a tu cuenta (todos los planes).",
    points: [
      "Conectas tu cuenta de Mercado Pago con un botón: nunca vemos tu clave",
      "Tarjeta de crédito, débito o saldo de Mercado Pago",
      "Tienda online: tú decides si todo se paga al pedir, solo los despachos o al retirar o recibir",
      "Cotizaciones: tu cliente la acepta y la paga desde el mismo enlace",
      "Enlaces de pago: cobras un monto (un abono, una reserva) y lo mandas por WhatsApp; al pagarse queda como venta",
      "Aviso al celular de cada pago y el historial con lo que recibiste",
      "Sin costo fijo: Mercado Pago cobra su comisión de siempre y OrdenSimple un 1 % por pago",
    ],
  },
  {
    id: "fidelidad",
    icon: Stamp,
    title: "Tarjeta de fidelidad",
    description: "Tus clientes juntan sellos o puntos en su celular y vuelven por su premio (plan Pro).",
    points: [
      "Tú eliges: sellos (ej.: 10 cafés y el siguiente gratis) o puntos según lo que compran",
      "El premio y la meta los decides tú, con compra mínima por sello si quieres",
      "Le envías la tarjeta por WhatsApp y el cliente la guarda en su pantalla de inicio, como una app",
      "Se suma sola al venderle: en ventas, comandas, citas, pedidos web y cotizaciones",
      "Escaneas el código de su tarjeta para encontrarla al tiro",
      "Canjeas el premio con un toque y queda el historial de cada cliente",
      "Si eliminas una venta, se descuenta lo que había sumado",
    ],
  },
  {
    id: "productos",
    icon: Package,
    title: "Productos",
    description: "Tu catálogo con lo que te cuesta y lo que ganas en cada uno.",
    points: [
      "Costo, precio, categoría y código (SKU)",
      "Foto de cada producto: la sacas con el celular y aparece en tu tienda y al vender",
      "Etiquetas con código de barras para imprimir: hojas de stickers A4 o impresora de etiquetas",
      "¿Un producto no trae código? Te creamos uno y lo vendes escaneando",
      "Ganancia por unidad y margen, explicados con ejemplos",
      "Aviso si un producto te deja pérdida",
      "Stock actual, stock mínimo y productos agotados",
      "Valor de tu inventario: lo que pagaste y lo que vale a precio de venta",
      "Si tu negocio cobra IVA, ves el neto y el IVA de cada precio",
    ],
  },
  {
    id: "recetas",
    icon: BookOpen,
    title: "Recetas",
    description: "Para lo que cocinas o fabricas: panes, tortas, comida, jabones, velas y cosmética (gratis).",
    points: [
      "Tus materiales con su precio y unidad: kilos, gramos, litros o unidades",
      "Cada receta con sus ingredientes y cuánto rinde",
      "Costo por unidad y precio sugerido según el margen que quieres",
      "Stock de tus materiales, con cuántas tandas te alcanzan",
      "Fecha de vencimiento de cada material y aviso antes de que venza",
      "Registra tus compras de materiales: se suman al stock y, si quieres, actualizan el precio",
      "Al vender, los materiales se descuentan solos",
    ],
  },
  {
    id: "panel",
    icon: LayoutDashboard,
    title: "Panel de inicio",
    description: "Todo lo importante de tu negocio en una sola pantalla.",
    points: [
      "¿Cómo va tu negocio? 🟢 Vas bien · 🟡 Hay cosas que revisar · 🔴 Gastas más de lo que vendes",
      "Ventas, gastos y ganancia de hoy y del mes",
      "Gráficos de los últimos 7 días y 6 meses",
      "Esta semana vs. la pasada, este mes vs. el anterior",
      "Modo Fácil: solo lo esencial, para quien recién empieza",
    ],
  },
  {
    id: "herramientas",
    icon: Calculator,
    title: "Herramientas",
    description: "Calculadoras para decidir mejor, sin tocar tus datos reales.",
    points: [
      "¿A cuánto debería vender? Precio sugerido según el margen que quieres",
      "Punto de equilibrio: cuánto vender para no perder",
      "Meta de ganancia: cuánto vender al mes, a la semana y al día",
      "¿Qué pasa si…? Simula subir precios, contratar, hacer descuentos y más",
      "Las calculadoras de precio, equilibrio y metas también son gratis en ordensimple.cl/calculadoras",
    ],
  },
  {
    id: "inventario",
    icon: Boxes,
    title: "Inventario",
    description: "Sabe qué tienes, qué se acaba y qué no se mueve.",
    points: [
      "Stock actual, stock bajo y productos agotados",
      "Alertas como “Te quedan 4 unidades de Coca-Cola 1.5L”",
      "Entradas, salidas y ajustes por conteo",
      "Productos más vendidos del mes",
      "Dinero inmovilizado en productos que no se venden",
      "Los materiales de tus recetas, con su stock y su vencimiento",
    ],
  },
  {
    id: "clientes",
    icon: Users,
    title: "Clientes",
    description: "Conoce a quienes te compran.",
    points: [
      "Ficha con teléfono, correo y notas",
      "Total comprado, número de compras y última compra",
      "Clientes frecuentes, nuevos y los que más compran",
      "Historial de compras de cada cliente",
      "Lo que te debe cada uno (fiado) y sus abonos",
      "Contacto directo por WhatsApp",
    ],
  },
  {
    id: "proveedores",
    icon: Truck,
    title: "Proveedores",
    description: "Compra mejor y sabe cuánto le compras a cada uno.",
    points: [
      "Ficha con contacto, productos y costo de despacho",
      "Cuánto le has comprado y cuándo fue la última vez",
      "Comparador: ¿qué proveedor me conviene según la cantidad?",
    ],
  },
  {
    id: "reportes",
    icon: BarChart3,
    title: "Reportes y consejos",
    description: "Entiende qué está funcionando y qué no.",
    points: [
      "Resumen de cualquier período comparado con el anterior",
      "Productos más vendidos y más rentables",
      "Gastos por categoría y ventas por método de pago",
      "Descarga el reporte del período en PDF, listo para imprimir o mandar",
      "Tus ventas y gastos en PDF o Excel, y el estado de resultados del año",
      "Ventas, metas y comisiones de cada persona de tu equipo",
      "Consejos automáticos calculados con tus números reales",
    ],
  },
  {
    id: "avisos",
    icon: BellRing,
    title: "Avisos al celular y al correo",
    description: "Tú atiende el negocio: nosotros vigilamos los números.",
    points: [
      "En el celular, aunque tengas la app cerrada: pedidos web, reservas y solicitudes de tu equipo",
      "Stock bajo o agotado y productos por vencer",
      "Fiado atrasado y pagos a proveedores que vencen",
      "Restaurantes: al garzón le llega “Listo para servir” cuando la cocina termina",
      "Resumen semanal cada lunes: cuánto vendiste, gastaste y te quedó",
      "Días sin ventas: un recordatorio si pasan 3 días sin anotar",
      "Eliges qué avisos quieres en Configuración, sección Avisos",
    ],
  },
  {
    id: "equipo",
    icon: UsersRound,
    title: "Tu equipo",
    description: "Que otros registren, y tú tengas el control.",
    points: [
      "Invita por correo o por WhatsApp con un enlace",
      "Administrador: casi todo, incluidos reportes y configuración",
      "Empleado: registra ventas, gastos, stock y clientes, sin ver ganancias ni costos",
      "Descuentos y devoluciones con aprobación: el empleado lo pide y tú lo apruebas o rechazas desde tu celular",
      "Meta del mes y comisión para cada persona: cada uno ve en su inicio cuánto lleva",
      "Ventas de cada persona en Reportes, descontando lo que le devolvieron",
      "Cambia el rol o quita el acceso cuando quieras",
      "Si trabajas en más de un negocio, cambias entre ellos en un toque",
    ],
  },
  {
    id: "sucursales",
    icon: Store,
    title: "Sucursales",
    description: "¿Tienes más de un local? Ordénalos todos desde una cuenta.",
    points: [
      "Cada sucursal con sus propias ventas, gastos, productos y caja",
      "Resumen de todas juntas: ventas de hoy, del mes y ganancia",
      "Cuál sucursal vende más, de un vistazo",
      "Cambia de sucursal en un toque",
      "Tu equipo trabaja solo en la sucursal donde lo invitas",
    ],
  },
  {
    id: "seguridad",
    icon: ShieldCheck,
    title: "Seguridad y acceso",
    description: "Tu información, solo para ti.",
    points: [
      "Cada negocio está separado: nadie más ve tus datos",
      "Contraseñas cifradas y recuperación por correo",
      "Funciona en celular, tablet y computador",
      "Tema claro y oscuro",
    ],
  },
]

export const TOOLS: Feature[] = [
  {
    icon: Tag,
    title: "¿A cuánto debería vender?",
    text: "Si un producto te cuesta $10.000 y quieres ganar 30%, te decimos que lo vendas a $14.286.",
  },
  {
    icon: Scale,
    title: "Punto de equilibrio",
    text: "“Necesitas vender 248 unidades este mes para cubrir tus gastos. Desde la 249 empiezas a ganar.”",
  },
  { icon: Target, title: "Meta de ganancia", text: "¿Quieres ganar $1.000.000 este mes? Te decimos cuánto vender cada día para lograrlo." },
  {
    icon: FlaskConical,
    title: "¿Qué pasa si…?",
    text: "Prueba subir precios, contratar a alguien o hacer un descuento antes de arriesgarte.",
  },
]

export const COMING_SOON: Feature[] = []

export const BENEFITS: Feature[] = [
  { icon: Clock, title: "Adiós al Excel", text: "Deja de pelear con planillas. Registrar tu día te toma menos de un minuto." },
  {
    icon: HeartHandshake,
    title: "Sin palabras difíciles",
    text: "En vez de “margen neto 18,4%”, te decimos: por cada $10.000 que vendes, te quedan $1.840.",
  },
  {
    icon: ShieldCheck,
    title: "Tus datos, seguros",
    text: "Cada negocio está separado y protegido. Solo tú y quien autorices pueden verlos.",
  },
]

/** "El cuaderno vs. OrdenSimple" en la portada. Solo cosas que la app hace hoy. */
export const BEFORE_AFTER: { before: string; after: string }[] = [
  {
    before: "Anotas las ventas en un cuaderno… cuando te acuerdas.",
    after: "Registras cada venta en segundos, o escaneando el código del producto.",
  },
  {
    before: "El fiado en hojas sueltas, y nadie tiene claro cuánto debe.",
    after: "Sabes de inmediato cuánto te debe cada cliente y le cobras por WhatsApp.",
  },
  { before: "Cierras, cuentas el dinero y no cuadra.", after: "El cierre de caja te dice si falta o sobra dinero, y cuánto." },
  { before: "Te enteras de que se acabó algo cuando un cliente lo pide.", after: "Te avisa cuando un producto se está acabando." },
  { before: "A fin de mes no sabes si ganaste o perdiste.", after: "Ves tu ganancia del día y del mes, en palabras simples." },
  { before: "El Excel que empezaste y nunca terminaste.", after: "Todo en el celular o el computador, sin planillas." },
]

export type Step = { n: string; title: string; text: string; detail: string }

/** Los pasos de "Empieza en 2 minutos" en la portada, como líneas de una boleta. */
export const RECEIPT_STEPS: { what: string; note: string; time: string }[] = [
  { what: "Crea tu cuenta", note: "Nombre, correo y contraseña. Sin tarjeta.", time: "30 seg" },
  { what: "Tu negocio", note: "Nombre, rubro y moneda. Salta lo que no sepas.", time: "1 min" },
  { what: "Primera venta", note: "Con el botón verde o escaneando el código.", time: "20 seg" },
  { what: "Mira cómo vas", note: "Tu ganancia, en palabras simples.", time: "en segundos" },
]

export const STEPS: Step[] = [
  {
    n: "1",
    title: "Crea tu cuenta gratis",
    text: "Solo tu nombre, correo y una contraseña. Sin tarjeta.",
    detail: "En menos de un minuto tienes tu cuenta. No pedimos datos bancarios ni te cobramos nada para empezar.",
  },
  {
    n: "2",
    title: "Cuéntanos de tu negocio",
    text: "Nombre, rubro y moneda. Puedes saltarte lo que no sepas.",
    detail: "Con 4 preguntas simples dejamos OrdenSimple listo para tu tipo de negocio. Todo se puede cambiar después.",
  },
  {
    n: "3",
    title: "Registra ventas y gastos",
    text: "Con el botón verde, desde el celular o el computador.",
    detail:
      "Cada vez que vendes o pagas algo, lo anotas en segundos. Si tienes productos, también puedes agregarlos con su costo y precio.",
  },
  {
    n: "4",
    title: "Mira cómo te va",
    text: "Te mostramos tu ganancia y si vas bien, con palabras simples.",
    detail: "El panel te dice cuánto vendiste, cuánto gastaste y cuánto te quedó, y te avisa si algo necesita tu atención.",
  },
]

export const TRANSLATIONS: { jargon: string; simple: string }[] = [
  { jargon: "Margen neto: 18,4%", simple: "Por cada $10.000 que vendes, aproximadamente $1.840 quedan como ganancia." },
  {
    jargon: "Punto de equilibrio: 248 unidades",
    simple: "Necesitas vender 248 unidades este mes para cubrir tus gastos. Desde la 249 empiezas a ganar.",
  },
  { jargon: "Margen de contribución unitario: $4.000", simple: "Por cada unidad vendida ganas aproximadamente $4.000." },
  {
    jargon: "Variación de ingresos vs. período anterior: -18%",
    simple: "Estás vendiendo bastante menos que el mes pasado en estas mismas fechas.",
  },
]

export type FaqGroup = { title: string; items: { q: string; a: string }[] }

export const FAQ_GROUPS: FaqGroup[] = [
  {
    title: "Sobre OrdenSimple",
    items: [
      {
        q: "¿Necesito saber de contabilidad?",
        a: "No. OrdenSimple está hecho para personas que nunca han usado un software administrativo. Todo se explica con palabras simples y ejemplos.",
      },
      {
        q: "¿Reemplaza a mi contador o la boleta del SII?",
        a: "No. OrdenSimple te ayuda a entender y ordenar tu negocio día a día, pero no emite boletas ni reemplaza tus obligaciones tributarias.",
      },
      {
        q: "¿Para qué tipo de negocios sirve?",
        a: "Almacenes, minimarkets, restaurantes, cafeterías, tiendas, peluquerías, talleres, servicios profesionales y emprendimientos en general: cualquier negocio que venda y tenga gastos.",
      },
      {
        q: "¿Sirve para un restaurante o un café?",
        a: "Sí. Si marcas el rubro “Restaurante, café o comida”, con el plan Pro tienes comandas por mesa y una pantalla para la cocina: el garzón anota y envía el pedido, la cocina lo marca listo y al cobrar queda como venta. Eliges cuántas mesas tienes en Configuración.",
      },
      {
        q: "¿Sirve si vendo servicios o trabajo con horas, como una peluquería o una consulta?",
        a: "Sí. Si marcas un rubro de servicios (belleza y estética, servicios profesionales, taller), OrdenSimple se adapta: tus productos pasan a ser servicios con su duración y, con el plan Pro, tienes una Agenda por profesional. Recuerdas cada cita por WhatsApp, la cobras con un toque y queda como venta, con la comisión de quien atendió.",
      },
      {
        q: "¿Puedo recibir pedidos por internet?",
        a: "Sí. Con el plan Pro activas tu tienda online en Configuración: una página con tus productos y precios que compartes por WhatsApp o en tus redes. Tus clientes eligen y te mandan el pedido por WhatsApp, y en “Pedidos web” lo registras como venta con un toque. Los pedidos por WhatsApp no tienen comisión. Si quieres que te paguen con tarjeta al pedir, conectas Mercado Pago en Cobros online: Mercado Pago cobra su comisión de siempre y OrdenSimple un 1 % por pago.",
      },
      {
        q: "¿Puedo hacer promociones como 2×1 o happy hour?",
        a: "Sí, con el plan Pro. En Promociones creas un 2×1, un % de descuento en productos o categorías, o un happy hour con días y horas. Se aplican solos al vender, en las comandas y en tu tienda online, y en Reportes ves cuánto descontaste. También puedes crear cupones para la tienda online.",
      },
      {
        q: "¿Puedo imprimir etiquetas con código de barras?",
        a: "Sí, en todos los planes. En Productos, sección Etiquetas, eliges los productos y cuántas etiquetas quieres, con nombre, precio y código. Sirven hojas de stickers A4 en una impresora normal o una impresora de etiquetas. Si un producto no trae código, te creamos uno para que lo vendas escaneando.",
      },
      {
        q: "¿Puedo hacer cotizaciones?",
        a: "Sí, con el plan Pro. En Cotizaciones armas una con tus productos y precios, y se la envías al cliente por WhatsApp con un enlace. Ahí la ve con tu logo, RUT, IVA desglosado y tus condiciones, la descarga en PDF y la acepta con un botón. Te avisamos cuando la abre y cuando responde, y la vendes con un toque.",
      },
      {
        q: "¿Mis clientes pueden ver en qué va su pedido?",
        a: "Sí. Cada pedido de tu tienda online tiene un enlace de seguimiento que le llega al cliente en su mensaje de WhatsApp. Ahí ve si está recibido, en preparación, listo o en camino, y entregado. Tú lo avanzas desde Pedidos web y le avisas por WhatsApp con un toque.",
      },
      {
        q: "¿Sirve para calcular el costo de mis recetas?",
        a: "Sí, gratis. En Recetas anotas tus materiales con su precio (harina, levadura, aceites, cera…) y cada receta con lo que rinde. Te decimos el costo por unidad y el precio sugerido, llevas el stock y el vencimiento de tus materiales, y al vender se descuentan solos.",
      },
      {
        q: "¿Mis clientes me pueden pagar con tarjeta?",
        a: "Sí, en todos los planes. En Cobros online conectas tu cuenta de Mercado Pago y tus clientes te pagan con tarjeta de crédito, débito o saldo de Mercado Pago: en tu tienda online, en tus cotizaciones o con un enlace de pago que mandas por WhatsApp. El dinero llega directo a tu cuenta. No hay costo fijo: Mercado Pago cobra su comisión de siempre y OrdenSimple un 1 % por pago.",
      },
      {
        q: "¿Puedo dar tarjetas de fidelidad a mis clientes?",
        a: "Sí, con el plan Pro. Eliges si das sellos (por ejemplo, 10 compras y un premio) o puntos según lo que compran, y cuál es el premio. Le envías la tarjeta al cliente por WhatsApp, la guarda en la pantalla de inicio de su celular y se le suma sola cada vez que le vendes.",
      },
      {
        q: "¿Puedo imprimir en una impresora de boletas?",
        a: "Sí. La cuenta de las comandas se imprime en impresoras de rollo de 58 u 80 mm: directo por Bluetooth desde Chrome o Edge (Android y computador), o como PDF o imagen del ancho del rollo para la app de tu impresora, ideal en iPhone.",
      },
      {
        q: "¿Me llegan avisos al celular?",
        a: "Sí. En Configuración, sección Avisos, activas “Avisos en este celular o computador” y te llegan aunque tengas la app cerrada: pedidos web, reservas, solicitudes de descuento o devolución de tu equipo, stock bajo, productos por vencer, fiado atrasado y pagos a proveedores. En iPhone, primero agrega OrdenSimple a tu pantalla de inicio.",
      },
      {
        q: "¿Puedo descargar mis reportes?",
        a: "Sí. Con el plan Pro descargas el reporte del período en PDF (listo para imprimir o mandar a tu contador), tus ventas y gastos en PDF o Excel, y el estado de resultados del año.",
      },
      {
        q: "¿Cómo los contacto?",
        a: `Por WhatsApp al ${WHATSAPP.display} o por correo a ${CONTACT_EMAIL}. Te respondemos lo antes posible.`,
      },
      {
        q: "¿Funciona en otros países?",
        a: "Partimos en Chile con pesos chilenos, pero ya puedes usar dólares, euros, soles, pesos argentinos, colombianos y mexicanos.",
      },
    ],
  },
  {
    title: "Cuenta y precios",
    items: [
      {
        q: "¿Es realmente gratis?",
        a: "Sí. El plan Gratis es para siempre y sin tarjeta: anotas tus ventas y gastos, hasta 20 productos, y ves cuánto te quedó cada día y cada mes. También ves tus reportes de este mes y el anterior, y usas las calculadoras de precio, metas y simulador, y llevas tu inventario con alertas de stock, tus recetas con su costo y precio, y tus clientes y el fiado con cobro por WhatsApp. También puedes cobrar con tarjeta enviando enlaces de pago con Mercado Pago (sin costo fijo: 1 % por pago, además de la comisión de Mercado Pago). El cierre de caja, los proveedores y el equipo son del plan Pro.",
      },
      BILLING_ENABLED
        ? {
            q: "¿Cuánto cuestan Pro y Empresa?",
            a: "Pro cuesta $6.990 al mes y Empresa $14.990 al mes. Se pagan con Mercado Pago (tarjeta de crédito o débito), se renuevan solos cada mes y los cancelas cuando quieras desde Configuración: tu plan sigue hasta el final del mes que pagaste.",
          }
        : {
            q: "¿Puedo usar las funciones Pro ahora?",
            a: "Sí, gratis. Durante el lanzamiento, proveedores, reportes, consejos y tu equipo están disponibles para todos. Te avisaremos con 5 días de anticipación antes de empezar a cobrar el plan Pro.",
          },
      ...(BILLING_ENABLED
        ? [
            {
              q: "¿Qué pasa con mis datos si dejo de pagar?",
              a: "Nada se borra. Vuelves al plan Gratis: sigues registrando ventas y gastos, y las funciones Pro quedan en pausa hasta que vuelvas a contratar.",
            },
          ]
        : []),
      { q: "¿Necesito tarjeta de crédito para registrarme?", a: "No. Solo tu nombre, correo y una contraseña." },
      {
        q: "Olvidé mi contraseña, ¿qué hago?",
        a: "En la pantalla de inicio de sesión toca “¿Olvidaste tu contraseña?” y te enviaremos un enlace para crear una nueva.",
      },
    ],
  },
  {
    title: "Uso diario",
    items: [
      {
        q: "¿Puedo usarlo desde el celular?",
        a: "Sí, funciona en cualquier navegador: celular, tablet o computador. No está en App Store ni Google Play, pero puedes agregarla a la pantalla de inicio de tu celular y usarla como una app. Te mostramos cómo en ordensimple.cl/instalar.",
      },
      {
        q: "¿Qué es el Modo Fácil?",
        a: "Una vista simplificada que muestra solo las ventas, gastos y ganancia de hoy, con botones grandes para registrar. Se activa en Configuración.",
      },
      {
        q: "¿Qué pasa si me equivoco al registrar una venta?",
        a: "Puedes corregirla o eliminarla desde el historial de ventas. Si había descontado stock, se ajusta automáticamente.",
      },
      {
        q: "¿Cómo llevo el fiado?",
        a: "Al registrar una venta elige “Fiado” y escribe el nombre del cliente. En Clientes ves cuánto te debe cada uno y registras sus abonos cuando te pagan.",
      },
      {
        q: "¿Qué avisos me llegan por correo?",
        a: "Un resumen cada lunes con cómo te fue la semana, un aviso cuando un producto se está acabando y un recordatorio si pasan 3 días sin anotar ventas. Los activas o desactivas en Configuración.",
      },
      {
        q: "¿Cómo calculan la ganancia?",
        a: "La ganancia aproximada es lo que vendiste menos lo que gastaste en el período. Es simple a propósito, para que siempre sepas de dónde sale el número.",
      },
    ],
  },
  {
    title: "Datos y seguridad",
    items: [
      {
        q: "¿Mis datos están seguros?",
        a: "Cada negocio está aislado: nadie más puede ver tu información. Las contraseñas nunca se guardan en texto plano.",
      },
      {
        q: "¿Quién puede ver la información de mi negocio?",
        a: "Solo tú y las personas que invites. Un empleado puede registrar ventas y gastos sin ver tus ganancias, costos ni reportes.",
      },
      {
        q: "¿Las calculadoras cambian mis datos?",
        a: "No. Las herramientas usan tus números para prellenar los cálculos, pero nunca modifican tus ventas, gastos ni productos.",
      },
    ],
  },
]

export type ComparisonRow = { label: string; values: [string | boolean, string | boolean, string | boolean] }

export const PLAN_COMPARISON: ComparisonRow[] = [
  { label: "Ideal para", values: ["Quien atiende solo", "Pymes con equipo e IVA", "Empresas con varios locales"] },
  { label: "Trabajadores (además de ti)", values: [false, "20", "Sin límite"] },
  { label: "Negocios o sucursales", values: ["1", "Hasta 3", "Hasta 10"] },
  { label: "Productos", values: ["Hasta 20", "Ilimitados", "Ilimitados"] },
  { label: "Ventas y gastos", values: [true, true, true] },
  { label: "Cierre de caja", values: [false, true, true] },
  { label: "Clientes, fiado y cobro por WhatsApp", values: [true, true, true] },
  { label: "Comandas y pantalla de cocina (restaurantes y cafés)", values: [false, true, true] },
  { label: "Tienda online con pedidos por WhatsApp", values: [false, true, true] },
  { label: "Cobros online con Mercado Pago (1 % por pago)", values: ["Enlaces de pago", "Tienda, cotizaciones y enlaces", "Tienda, cotizaciones y enlaces"] },
  { label: "Seguimiento del pedido para tu cliente", values: [false, true, true] },
  { label: "Cotizaciones con enlace para aceptarlas", values: [false, true, true] },
  { label: "Carta con QR por mesa", values: [false, true, true] },
  { label: "Tarjeta de fidelidad con sellos o puntos", values: [false, true, true] },
  { label: "Agenda de citas y reservas online (peluquerías, consultas, talleres)", values: [false, true, true] },
  { label: "Turnos de caja, metas y comisiones del equipo", values: [false, true, true] },
  { label: "Promociones automáticas (2×1, %, happy hour) y cupones", values: [false, true, true] },
  { label: "Fotos de productos", values: [true, true, true] },
  { label: "Etiquetas con código de barras para imprimir", values: [true, true, true] },
  { label: "Inventario y alertas de stock", values: [true, true, true] },
  { label: "Recetas: costo y precio de venta", values: [true, true, true] },
  { label: "Resumen por correo cada lunes", values: [true, true, true] },
  { label: "Calculadoras con tus números", values: [true, true, true] },
  { label: "Reportes", values: ["Este mes y el anterior", "Todo el historial", "Todo el historial"] },
  { label: "Consejos para tu negocio", values: [false, true, true] },
  { label: "Flujo de caja", values: [false, "Con lo que viene", "Con lo que viene"] },
  { label: "Escanear al vender", values: [false, "Continuo (modo caja)", "Continuo (modo caja)"] },
  { label: "Merma y vencidos", values: [false, true, true] },
  { label: "Balance, retiros del dueño y préstamos", values: [false, true, true] },
  { label: "Proveedores y pagos pendientes", values: [false, true, true] },
  { label: "Resultados e IVA (utilidad y F29)", values: [false, true, true] },
  { label: "Descargar reportes en PDF y Excel", values: [false, true, true] },
  { label: "Avisos al celular", values: [true, true, true] },
  { label: "Equipo por sucursal", values: [false, true, true] },
  { label: "Resumen de todas tus sucursales", values: [false, true, true] },
]
