import { IMPORT_MAX_BYTES } from "@/lib/product-import"
import { can } from "@/lib/roles"
import { buildPreview } from "@/server/product-import"
import { readCsv, readXlsx, SpreadsheetError } from "@/server/spreadsheet"
import { requireBusiness } from "@/server/session"

/**
 * Revisa el archivo que se quiere importar y devuelve qué pasaría con cada fila. No guarda nada: guardar es otro paso
 * (importProductsBatch), que vuelve a validar todo.
 */
export async function POST(request: Request) {
  const ctx = await requireBusiness()
  if (!can(ctx.role, "products:manage")) return Response.json({ error: "No tienes permiso para importar productos." }, { status: 403 })
  const length = Number(request.headers.get("content-length") ?? 0)
  if (length > IMPORT_MAX_BYTES + 64 * 1024) return Response.json({ error: "El archivo pesa más de 2 MB. Divídelo en varios archivos." }, { status: 413 })

  let file: File | null = null
  try {
    const form = await request.formData()
    const f = form.get("archivo")
    file = f instanceof File ? f : null
  } catch {
    return Response.json({ error: "No pudimos leer el archivo." }, { status: 400 })
  }
  if (!file || file.size === 0) return Response.json({ error: "Elige un archivo." }, { status: 400 })
  if (file.size > IMPORT_MAX_BYTES) return Response.json({ error: "El archivo pesa más de 2 MB. Divídelo en varios archivos." }, { status: 413 })

  const name = file.name.slice(0, 120)
  const ext = name.toLowerCase().split(".").pop()
  const buf = Buffer.from(await file.arrayBuffer())
  try {
    // Se mira el contenido, no solo la extensión: un .xlsx real empieza con "PK" (es un .zip).
    const isZip = buf.length > 4 && buf.readUInt32LE(0) === 0x04034b50
    let sheet
    if (ext === "xlsx" && isZip) sheet = readXlsx(buf)
    else if (ext === "csv" || ext === "txt") {
      if (isZip) throw new SpreadsheetError("El archivo dice ser CSV pero es un Excel. Cámbiale la extensión a .xlsx o guárdalo como CSV.")
      sheet = readCsv(buf)
    } else if (ext === "xls") throw new SpreadsheetError("Ese es el formato antiguo de Excel (.xls). Ábrelo y guárdalo como .xlsx o .csv.")
    else if (ext === "xlsm") throw new SpreadsheetError("Los archivos con macros (.xlsm) no se aceptan. Guárdalo como .xlsx o .csv.")
    else throw new SpreadsheetError("Sube un archivo .xlsx (Excel) o .csv.")
    return Response.json(await buildPreview(ctx, sheet, name))
  } catch (error) {
    if (error instanceof SpreadsheetError) return Response.json({ error: error.message }, { status: 422 })
    console.error(error)
    return Response.json({ error: "No pudimos revisar el archivo. Revisa que sea un Excel o CSV y vuelve a intentarlo." }, { status: 500 })
  }
}
