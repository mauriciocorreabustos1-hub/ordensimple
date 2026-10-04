import {
  BarChart3,
  Boxes,
  Calculator,
  Clock,
  CreditCard,
  FileDown,
  FlaskConical,
  HeartHandshake,
  LayoutDashboard,
  Mail,
  NotebookPen,
  Package,
  Receipt,
  Scale,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Store,
  Tag,
  Target,
  Truck,
  Users,
  UsersRound,
  Vault,
  type LucideIcon,
} from "lucide-react"

// Textos de las páginas públicas. Solo se describe lo que el producto hace hoy;
// lo que viene se marca como "Próximamente".

export type Feature = { icon: LucideIcon; title: string; text: string }

export const HIGHLIGHTS: Feature[] = [
  { icon: ShoppingBag, title: "Ventas en segundos", text: "Anota una venta desde el celular con solo el monto, o con detalle de productos, cliente y forma de pago." },
  { icon: NotebookPen, title: "Fiado sin cuaderno", text: "Anota lo que fías, registra los abonos y sabe al tiro cuánto te debe cada cliente." },
  { icon: Vault, title: "Cierre de caja", text: "Al final del día cuentas el efectivo y te decimos si falta o sobra plata." },
  { icon: Receipt, title: "Gastos ordenados", text: "Arriendo, luz, proveedores, sueldos… todo en categorías para saber en qué se va tu plata." },
  { icon: LayoutDashboard, title: "Tu negocio de un vistazo", text: "Ventas, gastos y ganancia de hoy y del mes, con gráficos simples y comparaciones." },
  { icon: Mail, title: "Avisos por correo", text: "Te avisamos cuando algo se está acabando, si llevas días sin anotar ventas y cada lunes con tu resumen." },
  { icon: Package, title: "Productos e inventario", text: "Costo, precio y stock de cada producto: cuánto ganas por unidad y qué tienes que reponer." },
  { icon: UsersRound, title: "Tu equipo", text: "Invita a tus empleados: registran ventas y gastos sin ver tus ganancias." },
  { icon: Calculator, title: "Calculadoras simples", text: "Precio correcto, punto de equilibrio, metas y simulaciones, explicadas en palabras simples." },
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
      "Historial con filtros por fecha: hoy, 7 días, este mes o el que elijas",
      "El stock se descuenta solo al vender un producto",
    ],
  },
  {
    id: "gastos",
    icon: Receipt,
    title: "Gastos",
    description: "Sabe exactamente en qué se va tu plata cada mes.",
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
      "Escribe cuánto contaste y te decimos si falta o sobra plata",
      "Historial de cierres de los últimos días",
      "Comparte el cierre del día por WhatsApp",
    ],
  },
  {
    id: "productos",
    icon: Package,
    title: "Productos",
    description: "Tu catálogo con lo que te cuesta y lo que ganas en cada uno.",
    points: [
      "Costo, precio, categoría y código (SKU)",
      "Ganancia por unidad y margen, explicados con ejemplos",
      "Aviso si un producto te deja pérdida",
      "Stock actual, stock mínimo y productos agotados",
      "Valor de tu inventario: lo que pagaste y lo que vale a precio de venta",
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
      "Descarga tus ventas y gastos en Excel",
      "Consejos automáticos calculados con tus números reales",
    ],
  },
  {
    id: "avisos",
    icon: Mail,
    title: "Avisos por correo",
    description: "Tú atiende el negocio: nosotros vigilamos los números.",
    points: [
      "Resumen semanal cada lunes: cuánto vendiste, gastaste y te quedó",
      "Stock bajo: qué productos se están acabando o se agotaron",
      "Días sin ventas: un recordatorio si pasan 3 días sin anotar",
      "Actívalos o desactívalos cuando quieras en Configuración",
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
      "Cambia el rol o quita el acceso cuando quieras",
      "Si trabajas en más de un negocio, cambias entre ellos en un toque",
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
  { icon: Tag, title: "¿A cuánto debería vender?", text: "Si un producto te cuesta $10.000 y quieres ganar 30%, te decimos que lo vendas a $14.286." },
  { icon: Scale, title: "Punto de equilibrio", text: "“Necesitas vender 248 unidades este mes para cubrir tus gastos. Desde la 249 empiezas a ganar.”" },
  { icon: Target, title: "Meta de ganancia", text: "¿Quieres ganar $1.000.000 este mes? Te decimos cuánto vender cada día para lograrlo." },
  { icon: FlaskConical, title: "¿Qué pasa si…?", text: "Prueba subir precios, contratar a alguien o hacer un descuento antes de arriesgarte." },
]

export const COMING_SOON: Feature[] = [
  { icon: CreditCard, title: "Pagar Pro y Empresa", text: "Pago mensual con tarjeta y boleta electrónica. Por ahora Pro es gratis." },
  { icon: Store, title: "Sucursales", text: "Varios locales en una sola cuenta." },
  { icon: FileDown, title: "Reportes en PDF", text: "Resúmenes listos para imprimir o enviar." },
  { icon: Smartphone, title: "App instalable", text: "Ícono en tu celular y funciona con mala señal." },
]

export const BENEFITS: Feature[] = [
  { icon: Clock, title: "Adiós al Excel", text: "Deja de pelear con planillas. Registrar tu día te toma menos de un minuto." },
  { icon: HeartHandshake, title: "Sin palabras difíciles", text: "En vez de “margen neto 18,4%”, te decimos: por cada $10.000 que vendes, te quedan $1.840." },
  { icon: ShieldCheck, title: "Tus datos, seguros", text: "Cada negocio está separado y protegido. Solo tú y quien autorices pueden verlos." },
]

export type Step = { n: string; title: string; text: string; detail: string }

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
    detail: "Cada vez que vendes o pagas algo, lo anotas en segundos. Si tienes productos, también puedes agregarlos con su costo y precio.",
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
  { jargon: "Punto de equilibrio: 248 unidades", simple: "Necesitas vender 248 unidades este mes para cubrir tus gastos. Desde la 249 empiezas a ganar." },
  { jargon: "Margen de contribución unitario: $4.000", simple: "Por cada unidad vendida ganas aproximadamente $4.000." },
  { jargon: "Variación de ingresos vs. período anterior: -18%", simple: "Estás vendiendo bastante menos que el mes pasado en estas mismas fechas." },
]

export type FaqGroup = { title: string; items: { q: string; a: string }[] }

export const FAQ_GROUPS: FaqGroup[] = [
  {
    title: "Sobre OrdenSimple",
    items: [
      { q: "¿Necesito saber de contabilidad?", a: "No. OrdenSimple está hecho para personas que nunca han usado un software administrativo. Todo se explica con palabras simples y ejemplos." },
      { q: "¿Reemplaza a mi contador o la boleta del SII?", a: "No. OrdenSimple te ayuda a entender y ordenar tu negocio día a día, pero no emite boletas ni reemplaza tus obligaciones tributarias." },
      { q: "¿Para qué tipo de negocios sirve?", a: "Almacenes, minimarkets, restaurantes, cafeterías, tiendas, peluquerías, talleres, servicios profesionales y emprendimientos en general: cualquier negocio que venda y tenga gastos." },
      { q: "¿Funciona en otros países?", a: "Partimos en Chile con pesos chilenos, pero ya puedes usar dólares, euros, soles, pesos argentinos, colombianos y mexicanos." },
    ],
  },
  {
    title: "Cuenta y precios",
    items: [
      { q: "¿Es realmente gratis?", a: "Sí. El plan Gratis incluye ventas, gastos, hasta 50 productos, dashboard y calculadoras, sin costo y sin tarjeta." },
      { q: "¿Puedo usar las funciones Pro ahora?", a: "Sí, gratis. Durante el lanzamiento, inventario, clientes y fiado, proveedores, reportes, consejos y tu equipo están disponibles para todos. Te avisaremos con 30 días de anticipación antes de empezar a cobrar el plan Pro." },
      { q: "¿Necesito tarjeta de crédito para registrarme?", a: "No. Solo tu nombre, correo y una contraseña." },
      { q: "Olvidé mi contraseña, ¿qué hago?", a: "En la pantalla de inicio de sesión toca “¿Olvidaste tu contraseña?” y te enviaremos un enlace para crear una nueva." },
    ],
  },
  {
    title: "Uso diario",
    items: [
      { q: "¿Puedo usarlo desde el celular?", a: "Sí, funciona en cualquier navegador: celular, tablet o computador. Pronto podrás instalarlo como app en tu pantalla de inicio." },
      { q: "¿Qué es el Modo Fácil?", a: "Una vista simplificada que muestra solo las ventas, gastos y ganancia de hoy, con botones grandes para registrar. Se activa en Configuración." },
      { q: "¿Qué pasa si me equivoco al registrar una venta?", a: "Puedes corregirla o eliminarla desde el historial de ventas. Si había descontado stock, se ajusta automáticamente." },
      { q: "¿Cómo llevo el fiado?", a: "Al registrar una venta elige “Fiado” y escribe el nombre del cliente. En Clientes ves cuánto te debe cada uno y registras sus abonos cuando te pagan." },
      { q: "¿Qué avisos me llegan por correo?", a: "Un resumen cada lunes con cómo te fue la semana, un aviso cuando un producto se está acabando y un recordatorio si pasan 3 días sin anotar ventas. Los activas o desactivas en Configuración." },
      { q: "¿Cómo calculan la ganancia?", a: "La ganancia aproximada es lo que vendiste menos lo que gastaste en el período. Es simple a propósito, para que siempre sepas de dónde sale el número." },
    ],
  },
  {
    title: "Datos y seguridad",
    items: [
      { q: "¿Mis datos están seguros?", a: "Cada negocio está aislado: nadie más puede ver tu información. Las contraseñas nunca se guardan en texto plano." },
      { q: "¿Quién puede ver la información de mi negocio?", a: "Solo tú y las personas que invites. Un empleado puede registrar ventas y gastos sin ver tus ganancias, costos ni reportes." },
      { q: "¿Las calculadoras cambian mis datos?", a: "No. Las herramientas usan tus números para prellenar los cálculos, pero nunca modifican tus ventas, gastos ni productos." },
    ],
  },
]

export type ComparisonRow = { label: string; values: [string | boolean, string | boolean, string | boolean] }

export const PLAN_COMPARISON: ComparisonRow[] = [
  { label: "Negocios", values: ["1", "Hasta 3", "Hasta 10"] },
  { label: "Productos", values: ["Hasta 50", "Ilimitados", "Ilimitados"] },
  { label: "Usuarios", values: ["1", "Hasta 3", "Hasta 50"] },
  { label: "Ventas y gastos", values: [true, true, true] },
  { label: "Panel de inicio", values: [true, true, true] },
  { label: "Calculadoras", values: [true, true, true] },
  { label: "Inventario completo", values: [false, true, true] },
  { label: "Clientes y proveedores", values: [false, true, true] },
  { label: "Reportes", values: [false, true, true] },
  { label: "Consejos automáticos", values: [false, true, true] },
  { label: "Roles y permisos avanzados", values: [false, false, true] },
  { label: "Múltiples sucursales", values: [false, false, true] },
]
