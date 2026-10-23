// Qué tipo de negocio es, según los rubros que marcó al registrarse (o en Configuración).

export const FOOD_BUSINESS_TYPE = "Restaurante, café o comida"

// Rubros escritos a mano en "Otro" que también son de comida.
const FOOD_WORDS = /restaur|caf[eé]|comida|cocina|sangu|s[aá]ndwich|complet|pizz|sushi|empanad|hamburg|food|fuente de soda|picada|bar\b|pub\b|cervecer|helader|pasteler|panader|amasander|delivery|colaci|almuerz|parrill|basad|marisquer|cevich/i

/** Restaurantes, cafés, sangucherías, carros de comida…: a ellos se les muestran las comandas. */
export function isFoodBusiness(type: string | null | undefined) {
  if (!type) return false
  return type.includes(FOOD_BUSINESS_TYPE) || FOOD_WORDS.test(type)
}

/** Mesas y lugares para abrir comandas: Mesa 1…N y los que el negocio nombró (Barra, Para llevar…). */
export function tableLabels(count: number, extras: string[]) {
  return [...Array.from({ length: count }, (_, i) => `Mesa ${i + 1}`), ...extras]
}

export const EVENTS_BUSINESS_TYPE = "Eventos y celebraciones"
const SERVICE_TYPES = ["Belleza y estética", "Servicios profesionales", "Taller o reparaciones", EVENTS_BUSINESS_TYPE]
// Rubros escritos a mano en "Otro" que trabajan con horas o citas.
const SERVICE_WORDS = /peluquer|barber|est[eé]tic|u[ñn]as|manicur|pedicur|spa\b|masaj|depila|pesta[ñn]|cejas|tatu|maquill|consult|cl[ií]nic|dent|odont|psic[oó]l|kinesi|nutric|fonoaud|terap|m[eé]dic|veterin|abogad|contad|asesor|clases|profesor|tutor|gimnasi|entrenad|yoga|pilates|fot[oó]graf|taller|mec[aá]nic|reparac|servicio t[eé]cnico|lavado de auto|car ?wash|gasfiter|electricist|event|banquete|matrimonio|boda|cumplea[ñn]|fiesta|celebraci|decoraci[oó]n|globos|cotill[oó]n|amplificaci[oó]n|\bdj\b|animaci[oó]n|productora|catering|arriendo de (mesas|sillas|toldos|carpas|juegos|inflables)/i
// Eventos también arrienda o vende cosas (mobiliario, decoración, cotillón): conserva el inventario.
const PRODUCT_TYPES = ["Almacén o minimarket", "Tienda de ropa o accesorios", "Tienda online", "Ferretería o construcción", "Taller o reparaciones", FOOD_BUSINESS_TYPE, EVENTS_BUSINESS_TYPE]

/** Peluquerías, consultas, talleres, clases…: trabajan con citas. A ellos se les muestra la Agenda. */
export function isServiceBusiness(type: string | null | undefined) {
  if (!type) return false
  return SERVICE_TYPES.some((t) => type.includes(t)) || SERVICE_WORDS.test(type)
}

// Rubros escritos a mano que elaboran sus productos con receta (además de los de comida).
const RECIPE_WORDS = /jab[oó]n|\bvelas?\b|cosm[eé]tic|crema|perfum|aromat|artesan|manualidad|resina|bisuter|reposter|chocolat|bomb[oó]n|mermelad|conserva|encurt|licor|destiler|kombucha|sales de ba[ñn]o/i

/** Elabora sus productos con receta (comida, jabones, velas, cosmética, artesanía…): a ellos se les muestra Recetas en el menú. */
export function makesRecipes(type: string | null | undefined) {
  if (!type) return false
  return isFoodBusiness(type) || RECIPE_WORDS.test(type)
}

/**
 * Cómo se adapta la app al rubro: qué se muestra en el menú y cómo se llama lo que vende.
 * Con varios rubros se suman las funciones de todos (un café que también hace eventos ve comandas y agenda).
 */
export function businessProfile(type: string | null | undefined) {
  const food = isFoodBusiness(type)
  const services = isServiceBusiness(type)
  // Solo servicios (sin rubros de venta de productos): no se muestra el inventario.
  const servicesOnly = services && !PRODUCT_TYPES.some((t) => (type ?? "").includes(t))
  return { food, services, servicesOnly, recipes: makesRecipes(type) }
}

export type BusinessProfile = ReturnType<typeof businessProfile>
