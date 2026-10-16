// Qué tipo de negocio es, según los rubros que marcó al registrarse (o en Configuración).

export const FOOD_BUSINESS_TYPE = "Restaurante, café o comida"

// Rubros escritos a mano en "Otro" que también son de comida.
const FOOD_WORDS = /restaur|caf[eé]|comida|cocina|sangu|s[aá]ndwich|complet|pizz|sushi|empanad|hamburg|food|fuente de soda|picada|bar\b|pub\b|cervecer|helader|pasteler|panader|amasander|delivery|colaci|almuerz|parrill|basad|marisquer|cevich/i

/** Restaurantes, cafés, sangucherías, carros de comida…: a ellos se les muestran las comandas. */
export function isFoodBusiness(type: string | null | undefined) {
  if (!type) return false
  return type.includes(FOOD_BUSINESS_TYPE) || FOOD_WORDS.test(type)
}
