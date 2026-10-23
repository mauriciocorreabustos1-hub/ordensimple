// Recetas: medidas, conversión entre ellas y el cálculo del costo y del precio de venta por unidad.
// Lo usan la pantalla (para ver el resultado al tiro) y el servidor (al pasar el precio a un producto).

export const RECIPE_UNITS = ["g", "kg", "ml", "l", "u"] as const
export type RecipeUnit = (typeof RECIPE_UNITS)[number]

export const UNIT_LABEL: Record<RecipeUnit, string> = { g: "g", kg: "kg", ml: "mL", l: "L", u: "unid." }
export const UNIT_NAME: Record<RecipeUnit, string> = { g: "Gramos (g)", kg: "Kilos (kg)", ml: "Mililitros (mL)", l: "Litros (L)", u: "Unidades" }

/** Cada medida en su unidad base: peso en gramos, volumen en mililitros, unidades como unidades. */
const BASE: Record<RecipeUnit, { group: "peso" | "volumen" | "unidad"; factor: number }> = {
  g: { group: "peso", factor: 1 },
  kg: { group: "peso", factor: 1000 },
  ml: { group: "volumen", factor: 1 },
  l: { group: "volumen", factor: 1000 },
  u: { group: "unidad", factor: 1 },
}

export const isRecipeUnit = (u: string): u is RecipeUnit => (RECIPE_UNITS as readonly string[]).includes(u)

/** Medidas con las que se puede anotar un ingrediente de un material (un material en kilos se puede usar en gramos). */
export function compatibleUnits(unit: RecipeUnit): RecipeUnit[] {
  return RECIPE_UNITS.filter((u) => BASE[u].group === BASE[unit].group)
}

/** Pasa una cantidad de una medida a otra del mismo tipo. Null si no se puede (gramos a litros). */
export function convert(quantity: number, from: RecipeUnit, to: RecipeUnit) {
  if (BASE[from].group !== BASE[to].group) return null
  return (quantity * BASE[from].factor) / BASE[to].factor
}

export type MaterialLike = { unit: string; packQty: number; packPrice: number; stock?: number | null }
export type ItemLike = { quantity: number; unit: string; material: MaterialLike }

/** Lo que cuesta usar cierta cantidad de un material, según el precio de su paquete. Null si la medida no corresponde. */
export function itemCost(item: ItemLike) {
  const { material } = item
  if (!isRecipeUnit(material.unit) || !isRecipeUnit(item.unit) || material.packQty <= 0) return null
  const qty = convert(item.quantity, item.unit, material.unit)
  if (qty === null) return null
  return (material.packPrice * qty) / material.packQty
}

/**
 * Costo y precio de una receta. Precio de venta por unidad = costo de los ingredientes × (1 + % adicional)
 * × (1 + % de ganancia) ÷ unidades que rinde.
 */
export function recipeTotals(items: ItemLike[], yieldUnits: number, overheadPct: number, profitPct: number) {
  const ingredients = items.reduce((sum, i) => sum + (itemCost(i) ?? 0), 0)
  const overhead = ingredients * (overheadPct / 100)
  const totalCost = ingredients + overhead
  const units = Math.max(1, yieldUnits)
  const unitCost = totalCost / units
  const unitPrice = unitCost * (1 + profitPct / 100)
  return { ingredients, overhead, totalCost, unitCost, unitPrice, unitProfit: unitPrice - unitCost }
}

/** Cuántas veces se puede hacer la receta con el stock de sus materiales. Null si algún material no lleva stock. */
export function batchesFromStock(items: ItemLike[]) {
  if (!items.length) return null
  let batches = Infinity
  for (const i of items) {
    if (i.material.stock === null || i.material.stock === undefined || !isRecipeUnit(i.unit) || !isRecipeUnit(i.material.unit)) return null
    const need = convert(i.quantity, i.unit, i.material.unit)
    if (need === null || need <= 0) continue
    batches = Math.min(batches, Math.floor(i.material.stock / need + 1e-9))
  }
  return Number.isFinite(batches) ? Math.max(0, batches) : null
}

/** "1,5", "28,5", "1.000" → número (acepta coma decimal). Null si no es un número. */
export function parseQuantity(text: string) {
  const t = text.trim().replace(/\s/g, "")
  if (!t) return null
  // "1.000,5" o "1000,5" → 1000.5; "1.000" → 1000 (punto de miles); "1.5" → 1.5
  const normalized = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, "") : t
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

/** 28.5 → "28,5"; 1000 → "1.000" */
export function formatQuantity(n: number) {
  return n.toLocaleString("es-CL", { maximumFractionDigits: 3 })
}
