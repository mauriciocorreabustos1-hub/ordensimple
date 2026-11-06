import "server-only"
import { db } from "@/lib/db"
import { getCurrency } from "@/lib/currency"
import { productLimit } from "@/lib/plans"
import { cleanCodes } from "@/lib/barcodes"
import {
  COLUMN_LABEL,
  IMPORT_COLUMNS,
  IMPORT_MAX_ROWS,
  importRowSchema,
  type ExistingProduct,
  type ImportIssue,
  type ImportKey,
  type ImportPreview,
  type ImportRowData,
  type PreviewRow,
} from "@/lib/product-import"
import { SpreadsheetError, type Sheet } from "@/server/spreadsheet"
import type { BusinessContext } from "@/server/session"

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[*:()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

/** Nombres de columna que se aceptan (así sirve una planilla propia, no solo la plantilla). */
const ALIASES: Record<ImportKey, string[]> = {
  name: ["nombre", "producto", "nombre del producto", "nombre producto", "articulo", "item"],
  code: ["codigo de barras", "codigo barras", "codigo", "barcode", "ean", "ean13", "cod barras"],
  sku: ["sku", "codigo interno", "cod interno", "referencia"],
  category: ["categoria", "rubro", "familia", "grupo"],
  price: ["precio de venta", "precio venta", "precio", "valor", "precio final", "pvp"],
  cost: ["precio de costo", "precio costo", "costo", "costo unitario", "precio compra", "precio de compra"],
  stock: ["stock inicial", "stock", "cantidad", "existencias", "inventario"],
  minStock: ["stock minimo", "minimo", "stock min", "alerta de stock"],
}
const LOOKUP = new Map(Object.entries(ALIASES).flatMap(([key, names]) => names.map((n) => [n, key as ImportKey])))
/** Columnas que se reconocen pero OrdenSimple no guarda (para avisarlo en vez de perder el dato en silencio). */
const KNOWN_UNUSED = new Set(["descripcion", "detalle", "observaciones", "notas", "marca", "proveedor", "unidad"])

/**
 * Número escrito por una persona: "1.990", "1990", "$ 1.990", "12,50", "1,234.56". Los puntos y comas de miles se
 * reconocen; con una moneda sin decimales (pesos chilenos), "1.990" y "1,990" son mil novecientos noventa.
 */
export function parseAmount(raw: string, decimals: number): number | null {
  let s = raw.replace(/[\s$€]|CLP|USD|PEN|ARS|COP|MXN/gi, "")
  if (!s) return null
  if (!/^-?[\d.,]+$/.test(s)) return NaN
  const lastDot = s.lastIndexOf(".")
  const lastComma = s.lastIndexOf(",")
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = lastDot > lastComma ? "." : ","
    s = s.replace(dec === "." ? /,/g : /\./g, "").replace(dec, ".")
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? "." : ","
    const parts = s.split(sep)
    const thousands = parts.length > 2 || (parts[1]?.length === 3 && (decimals === 0 || sep === "."))
    // Un número que vino de una celda numérica de Excel siempre trae punto decimal ("12.5"): se respeta.
    s = thousands && !(sep === "." && parts.length === 2 && decimals > 0) ? parts.join("") : parts.join(".")
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

type Columns = Partial<Record<ImportKey, number>>

function mapHeader(header: string[]) {
  const cols: Columns = {}
  const ignored: string[] = []
  header.forEach((h, i) => {
    const n = norm(h)
    if (!n) return
    const key = LOOKUP.get(n)
    if (key && cols[key] === undefined) cols[key] = i
    else if (key || KNOWN_UNUSED.has(n) || n) ignored.push(h.trim())
  })
  return { cols, ignored }
}

/** Revisa cada fila (sin tocar la base de datos): formato, montos, códigos. */
function parseRows(sheet: Sheet, currency: string) {
  const headerIndex = sheet.findIndex((r) => r.some((c) => c.trim()))
  if (headerIndex < 0) throw new SpreadsheetError("El archivo está vacío.")
  const { cols, ignored } = mapHeader(sheet[headerIndex])
  const missing = IMPORT_COLUMNS.filter((c) => "required" in c && c.required && cols[c.key] === undefined).map((c) => c.label)
  if (missing.length) {
    const found = sheet[headerIndex].map((h) => h.trim()).filter(Boolean)
    throw new SpreadsheetError(
      `Faltan las columnas ${missing.join(" y ")}. La primera fila del archivo debe tener los nombres de las columnas` +
        (found.length ? ` (encontramos: ${found.slice(0, 8).join(", ")}).` : ".") +
        " Descarga la plantilla para ver cómo va.",
    )
  }
  const decimals = getCurrency(currency).decimals
  const toMinor = (n: number) => Math.round(n * 10 ** decimals)
  const rows: PreviewRow[] = []
  let emptyRows = 0
  const body = sheet.slice(headerIndex + 1)
  if (body.length > IMPORT_MAX_ROWS) throw new SpreadsheetError(`El archivo tiene ${body.length} filas y el máximo es ${IMPORT_MAX_ROWS}. Divídelo en varios archivos.`)

  body.forEach((cells, i) => {
    const rowNumber = headerIndex + i + 2
    const get = (k: ImportKey) => (cols[k] === undefined ? "" : (cells[cols[k]!] ?? "").replace(/\s+/g, " ").trim())
    if (!cells.some((c) => c && c.trim())) {
      emptyRows++
      return
    }
    const issues: ImportIssue[] = []
    const issue = (k: ImportKey, message: string) => issues.push({ column: COLUMN_LABEL[k], message })

    const name = get("name")
    if (!name) issue("name", "Falta el nombre.")
    else if (name.length < 2) issue("name", "El nombre es muy corto.")
    else if (name.length > 100) issue("name", "El nombre tiene más de 100 letras.")
    else if (/^[=+@]/.test(name)) issue("name", "El nombre no puede empezar con =, + o @.")

    const codes: string[] = []
    for (const k of ["code", "sku"] as const) {
      const v = get(k)
      if (!v) continue
      if (/^\d+([.,]\d+)?e\+?\d+$/i.test(v)) issue(k, "El código quedó como número científico (por ejemplo 7,8E+12). Da formato de texto a la columna y vuelve a escribirlo.")
      else if (v.length > 120) issue(k, "El código es demasiado largo.")
      else if (/^[=+@]/.test(v)) issue(k, "El código no puede empezar con =, + o @.")
      else codes.push(v)
    }

    const categoryName = get("category") || undefined
    if (categoryName && categoryName.length > 40) issue("category", "La categoría tiene más de 40 letras.")

    const money = (k: "price" | "cost", required: boolean) => {
      const raw = get(k)
      if (!raw) {
        if (required) issue(k, "Falta el precio.")
        return undefined
      }
      const n = parseAmount(raw, decimals)
      if (n === null || Number.isNaN(n)) return void issue(k, `"${raw}" no es un monto. Escribe solo el número, por ejemplo 1990.`)
      if (n < 0) return void issue(k, "No puede ser negativo.")
      if (required && n === 0) return void issue(k, "El precio debe ser mayor a 0.")
      if (n > 2_000_000_000 / 10 ** decimals) return void issue(k, "El monto es demasiado alto.")
      return toMinor(n)
    }
    const qty = (k: "stock" | "minStock") => {
      const raw = get(k)
      if (!raw) return undefined
      const n = parseAmount(raw, 0)
      if (n === null || Number.isNaN(n)) return void issue(k, `"${raw}" no es una cantidad.`)
      if (n < 0) return void issue(k, "No puede ser negativo.")
      if (!Number.isInteger(n)) return void issue(k, "Usa números enteros.")
      if (n > 10_000_000) return void issue(k, "La cantidad es demasiado alta.")
      return n
    }
    const price = money("price", true)
    const cost = money("cost", false)
    const stock = qty("stock")
    const minStock = qty("minStock")

    const raw = { name, codes: [get("code"), get("sku")].filter(Boolean).join(" · "), price: get("price") }
    const example = norm(name).startsWith("ejemplo")
    if (issues.length || price === undefined) {
      rows.push({ row: rowNumber, data: null, raw, status: example ? "ejemplo" : "error", issues })
      return
    }
    const data = importRowSchema.parse({ name, codes: cleanCodes(codes), categoryName, price, cost, stock, minStock })
    rows.push({ row: rowNumber, data, raw, status: example ? "ejemplo" : "nuevo", issues })
  })
  return { rows, emptyRows, ignored }
}

/** Productos del negocio que ya tienen estos códigos (en el principal o en los adicionales) o, sin código, el mismo nombre. */
export async function findExisting(client: Pick<typeof db, "product" | "productBarcode">, businessId: string, rows: { codes: string[]; name: string }[]) {
  const codes = [...new Set(rows.flatMap((r) => r.codes))]
  const names = [...new Set(rows.filter((r) => !r.codes.length).map((r) => r.name))]
  const select = { id: true, name: true, price: true, stock: true, trackStock: true, sku: true } as const
  const [bySku, byBarcode, byName] = await Promise.all([
    codes.length ? client.product.findMany({ where: { businessId, sku: { in: codes, mode: "insensitive" } }, select }) : [],
    codes.length
      ? client.productBarcode.findMany({ where: { businessId, code: { in: codes, mode: "insensitive" } }, select: { code: true, product: { select } } })
      : [],
    names.length ? client.product.findMany({ where: { businessId, name: { in: names, mode: "insensitive" } }, select }) : [],
  ])
  const code = new Map<string, (typeof bySku)[number]>()
  for (const p of bySku) if (p.sku) code.set(p.sku.toLowerCase(), p)
  for (const b of byBarcode) code.set(b.code.toLowerCase(), b.product)
  const name = new Map(byName.map((p) => [p.name.toLowerCase(), p]))
  /** El producto que corresponde a la fila; error si sus códigos son de dos productos distintos. */
  return (r: { codes: string[]; name: string }): { product?: ExistingProduct; conflict?: string } => {
    if (r.codes.length) {
      const found = r.codes.map((c) => code.get(c.toLowerCase())).filter((p) => p !== undefined)
      const ids = new Set(found.map((p) => p.id))
      if (ids.size > 1) return { conflict: `Sus códigos están en dos productos distintos: "${found[0].name}" y "${found.find((p) => p.id !== found[0].id)!.name}".` }
      const p = found[0]
      return p ? { product: { id: p.id, name: p.name, price: p.price, stock: p.stock, trackStock: p.trackStock, by: "codigo" } } : {}
    }
    const p = name.get(r.name.toLowerCase())
    return p ? { product: { id: p.id, name: p.name, price: p.price, stock: p.stock, trackStock: p.trackStock, by: "nombre" } } : {}
  }
}

/** Revisión completa antes de importar: no guarda nada. */
export async function buildPreview(ctx: BusinessContext, sheet: Sheet, fileName: string): Promise<ImportPreview> {
  const { rows, emptyRows, ignored } = parseRows(sheet, ctx.currency)

  // Repetidos dentro del mismo archivo: el mismo código, o el mismo nombre cuando ninguna de las dos filas tiene código.
  const seenCode = new Map<string, number>()
  const seenName = new Map<string, number>()
  for (const r of rows) {
    if (!r.data || r.status === "ejemplo") continue
    const keys = r.data.codes.map((c) => c.toLowerCase())
    const first = keys.map((k) => seenCode.get(k)).find((n) => n !== undefined) ?? (keys.length ? undefined : seenName.get(r.data.name.toLowerCase()))
    if (first !== undefined) {
      r.status = "repetido"
      r.duplicateOf = first
      continue
    }
    keys.forEach((k) => seenCode.set(k, r.row))
    if (!keys.length) seenName.set(r.data.name.toLowerCase(), r.row)
  }

  const candidates = rows.filter((r) => r.data && r.status === "nuevo")
  const match = await findExisting(db, ctx.businessId, candidates.map((r) => r.data!))
  for (const r of candidates) {
    const m = match(r.data!)
    if (m.conflict) {
      r.status = "error"
      r.issues.push({ column: COLUMN_LABEL.code, message: m.conflict })
    } else if (m.product) {
      r.status = "existe"
      r.existing = m.product
    }
  }

  // Límite del plan: los nuevos que no caben quedan marcados (en el orden del archivo).
  const limit = productLimit(ctx.business.plan, ctx.business.extraProducts)
  const current = await db.product.count({ where: { businessId: ctx.businessId } })
  if (limit !== null) {
    let room = Math.max(0, limit - current)
    for (const r of rows) {
      if (r.status !== "nuevo") continue
      if (room > 0) room--
      else r.status = "limite"
    }
  }
  return { fileName, rows, emptyRows, ignoredColumns: ignored, limit, current }
}

export type { ImportRowData }
