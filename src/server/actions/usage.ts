"use server"

import { TRACKED_FEATURES, trackFeature, type TrackedFeature } from "@/server/feature-usage"
import { requireBusiness } from "@/server/session"

/** Desde el navegador: anota el uso de una función que pasa solo en la pantalla (escanear, consultar). */
export async function noteFeatureUse(feature: string) {
  if (!(feature in TRACKED_FEATURES)) return
  const ctx = await requireBusiness()
  trackFeature(ctx.businessId, ctx.timezone, feature as TrackedFeature)
}
