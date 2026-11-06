import { z } from "zod"

/** Importación de productos desde Excel o CSV: lo que comparten la revisión (servidor), la pantalla y el guardado. */

export const IMPORT_MAX_BYTES = 2 * 1024 * 1024
export const IMPORT_MAX_ROWS = 5000
/** Productos que se guardan por cada envío al servidor. */
export const IMPORT_BATCH = 100

/** Columnas de la plantilla, en orden. Los montos van en la moneda del negocio (precio final, con IVA si lo cobras). */
export const IMPORT_COLUMNS = [
  { key: "name", label: "Nombre", example: "Coca-Cola 1,5 L", width: 32, required: true },
  { key: "code", label: "Código de barras", example: "7801234567890", width: 20, text: true },
  { key: "sku", label: "SKU", example: "BEB-001", width: 14, text: true },
  { key: "category", label: "Categoría", example: "Bebidas", width: 18 },
  { key: "price", label: "Precio de venta", example: 1990, width: 16, required: true },
  { key: "cost", label: "Precio de costo", example: 1200, width: 16 },
  { key: "stock", label: "Stock inicial", example: 50, width: 13 },
  { key: "minStock", label: "Stock mínimo", example: 10, width: 13 },
] as const

export type ImportKey = (typeof IMPORT_COLUMNS)[number]["key"]
export const COLUMN_LABEL = Object.fromEntries(IMPORT_COLUMNS.map((c) => [c.key, c.label])) as Record<ImportKey, string>

/** Los datos de una fila ya revisados. Los montos van en la unidad menor de la moneda (como en el resto del sistema). */
export const importRowSchema = z.object({
  name: z.string().trim().min(2).max(100),
  codes: z.array(z.string().trim().min(1).max(120)).max(2),
  categoryName: z.string().trim().min(1).max(40).optional(),
  price: z.number().int().min(1).max(2_000_000_000),
  cost: z.number().int().min(0).max(2_000_000_000).optional(),
  stock: z.number().int().min(0).max(10_000_000).optional(),
  minStock: z.number().int().min(0).max(10_000_000).optional(),
})
export type ImportRowData = z.infer<typeof importRowSchema>

export type ImportIssue = { column: string; message: string }

/**
 * nuevo: se crea · existe: ya está en el negocio (se omite o se actualiza) · error: algo no cuadra · repetido: otra fila del
 * archivo es el mismo producto · limite: supera los productos del plan · ejemplo: la fila de ejemplo de la plantilla.
 */
export type ImportStatus = "nuevo" | "existe" | "error" | "repetido" | "limite" | "ejemplo"

export type ExistingProduct = { id: string; name: string; price: number; stock: number; trackStock: boolean; by: "codigo" | "nombre" }

export type PreviewRow = {
  /** Número de fila en el archivo (como lo ve la persona en Excel). */
  row: number
  data: ImportRowData | null
  /** Lo que venía escrito, para mostrarlo aunque tenga errores. */
  raw: { name: string; codes: string; price: string }
  status: ImportStatus
  issues: ImportIssue[]
  existing?: ExistingProduct
  duplicateOf?: number
}

export type ImportPreview = {
  fileName: string
  rows: PreviewRow[]
  emptyRows: number
  ignoredColumns: string[]
  limit: number | null
  current: number
}

export const importBatchSchema = z.object({
  rows: z
    .array(z.object({ row: z.number().int().min(1).max(IMPORT_MAX_ROWS + 10), data: importRowSchema }))
    .min(1)
    .max(IMPORT_BATCH),
  updateExisting: z.boolean(),
  updateStock: z.boolean(),
})
export type ImportBatchInput = z.input<typeof importBatchSchema>

export type ImportResult = { row: number; result: "creado" | "actualizado" | "omitido" | "error"; message?: string; name: string }

/** Valor de celda seguro para un CSV que se abre en Excel: lo que empieza con =, +, - o @ no se toma como fórmula. */
export function csvCell(value: string | number | null | undefined) {
  const s = value === null || value === undefined ? "" : String(value)
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}
