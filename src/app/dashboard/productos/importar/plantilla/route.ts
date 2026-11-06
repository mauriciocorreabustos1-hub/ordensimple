import { IMPORT_COLUMNS } from "@/lib/product-import"
import { getCurrency } from "@/lib/currency"
import { can } from "@/lib/roles"
import { writeXlsx } from "@/server/spreadsheet"
import { requireBusiness } from "@/server/session"

/** Plantilla de Excel para importar productos: los encabezados, una fila de ejemplo marcada y una hoja de instrucciones. */
export async function GET() {
  const ctx = await requireBusiness()
  if (!can(ctx.role, "products:manage")) return new Response("No tienes permiso para importar productos.", { status: 403 })
  const decimals = getCurrency(ctx.currency).decimals
  const example = IMPORT_COLUMNS.map((c) => (c.key === "name" ? `EJEMPLO (borra esta fila): ${c.example}` : typeof c.example === "number" && decimals && (c.key === "price" || c.key === "cost") ? c.example / 100 : c.example))
  const file = writeXlsx([
    {
      name: "Productos",
      rows: [IMPORT_COLUMNS.map((c) => c.label), example],
      widths: IMPORT_COLUMNS.map((c) => c.width),
      textColumns: IMPORT_COLUMNS.flatMap((c, i) => ("text" in c && c.text ? [i] : [])),
    },
    {
      name: "Instrucciones",
      widths: [22, 90],
      rows: [
        ["Columna", "Cómo llenarla"],
        ["Nombre", "Obligatorio. Cómo lo ves en tu negocio, por ejemplo Coca-Cola 1,5 L."],
        ["Código de barras", "Opcional. El número que aparece bajo las barras. La columna ya tiene formato de texto para no perder los ceros de adelante."],
        ["SKU", "Opcional. Tu código interno, si usas uno."],
        ["Categoría", "Opcional. Si no existe, se crea."],
        ["Precio de venta", `Obligatorio. El precio final al cliente en ${ctx.currency}, con IVA incluido si lo cobras. Solo el número, sin $ ni puntos.`],
        ["Precio de costo", "Opcional. Lo que te cuesta cada unidad."],
        ["Stock inicial", "Opcional. Cuántas unidades tienes hoy. Si lo dejas vacío, el producto se crea sin control de stock."],
        ["Stock mínimo", "Opcional. Te avisamos cuando queden menos."],
        ["", ""],
        ["Fila de ejemplo", "La fila que empieza con EJEMPLO no se importa. Puedes borrarla o dejarla."],
        ["Productos que ya tienes", "Se reconocen por su código de barras o SKU. Antes de importar eliges si se omiten o se actualizan."],
      ],
    },
  ])
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-productos-ordensimple.xlsx"',
      "Cache-Control": "no-store",
    },
  })
}
