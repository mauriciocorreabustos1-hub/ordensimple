import "server-only"
import { cache } from "react"
import { after } from "next/server"
import { db } from "@/lib/db"
import { toDateKey } from "@/lib/dates"

/** Funciones cuyo uso se anota (no dejan registro propio en la base de datos). */
export const TRACKED_FEATURES = {
  "flujo-caja": "Ver flujo de caja",
  resultados: "Ver Resultados e IVA",
  reportes: "Ver reportes",
  caja: "Abrir cierre de caja",
  escaneo: "Escanear al vender",
  consultar: "Consultar producto",
} as const
export type TrackedFeature = keyof typeof TRACKED_FEATURES

/** Anota que un negocio usó una función hoy (una vez por pedido; se guarda después de responder). */
export const trackFeature = cache((businessId: string, timezone: string, feature: TrackedFeature) => {
  after(async () => {
    const day = toDateKey(new Date(), timezone)
    await db.featureUsage
      .upsert({
        where: { businessId_feature_day: { businessId, feature, day } },
        update: { count: { increment: 1 } },
        create: { businessId, feature, day },
      })
      .catch(() => {})
  })
})
