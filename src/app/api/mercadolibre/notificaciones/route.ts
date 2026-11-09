import { after } from "next/server"
import { db } from "@/lib/db"
import { recordError } from "@/server/error-log"
import { logLicense } from "@/server/licenses"
import { MlApiError, mercadoLibre } from "@/server/mercadolibre"
import { processMlOrder } from "@/server/ml-sales"
import { allowAttempt } from "@/server/rate-limit"

// Avisos de Mercado Libre (tema orders_v2). Se configura en Mercado Libre Developers con la URL
// https://www.ordensimple.cl/api/mercadolibre/notificaciones
// Mercado Libre exige responder 200 en menos de medio segundo: se responde al tiro y la venta se procesa después.
// Los avisos no vienen firmados, así que nunca se confía en su contenido: solo se usa el número de la venta, y la
// venta siempre se consulta a la API con la sesión de la cuenta conectada (un aviso falso no puede crear nada).
export const maxDuration = 60

type Notification = { resource?: string; user_id?: number | string; topic?: string; application_id?: number | string; attempts?: number }

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Notification | null
  const orderId = body?.resource?.match(/^\/orders\/(\d{1,20})$/)?.[1]
  const appOk = body && String(body.application_id ?? "") === (process.env.MERCADOLIBRE_CLIENT_ID ?? "-")
  if (!body || body.topic !== "orders_v2" || !orderId || !appOk) return new Response("ok")

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "sin-ip"
  after(async () => {
    try {
      const account = await db.mercadoLibreAccount.findUnique({ where: { id: "principal" }, select: { sellerId: true } })
      if (!account || String(body.user_id ?? "") !== account.sellerId) return
      // Tope por conexión: quien envíe avisos falsos solo llena el suyo, no el de Mercado Libre.
      if (!(await allowAttempt(`ml-avisos:${ip}`, 1_000, 60 * 60_000))) return
      const r = await processMlOrder(orderId, mercadoLibre)
      if (r.result === "ignorada") return
      // Solo se registra lo que Mercado Libre confirmó que es una venta de esta publicación.
      await logLicense(db, { kind: "notificacion", mlOrderId: orderId, detail: `Aviso de Mercado Libre por la venta ${orderId}${body.attempts && body.attempts > 1 ? ` (intento ${body.attempts})` : ""}${r.result !== "procesada" ? `: ${r.reason}` : ""}` })
    } catch (error) {
      // Una venta que no existe o no es de esta cuenta: era un aviso falso.
      if (error instanceof MlApiError && (error.status === 403 || error.status === 404)) return
      const message = error instanceof Error ? error.message : String(error)
      await logLicense(db, { kind: "error", mlOrderId: orderId, detail: `No se pudo procesar la venta ${orderId}: ${message}` }).catch(() => {})
      await recordError({ source: "servidor", message: `Mercado Libre, venta ${orderId}: ${message}`, path: "/api/mercadolibre/notificaciones", stack: error instanceof Error ? error.stack : undefined })
    }
  })
  return new Response("ok")
}
