import "server-only"
import { randomInt } from "node:crypto"
import type { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { cancelPreapproval } from "@/lib/mercadopago"
import { effectivePlan, PLANS } from "@/lib/plans"

// Códigos de activación del Plan Pro permanente (se venden en Mercado Libre o se entregan a mano).
// Formato OS-PRO-XXXX-XXXX con letras y números que no se confunden (sin O, 0, I, 1 ni L):
// 31 caracteres en 8 posiciones = unas 850 mil millones de combinaciones.

export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
const CODE_RE = /^OS-PRO-[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{4}$/

type Client = Prisma.TransactionClient | typeof db

export class LicenseError extends Error {}

export function newLicenseCode() {
  const part = () => Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("")
  return `OS-PRO-${part()}-${part()}`
}

/** Deja el código como se guarda: mayúsculas, sin espacios y con sus guiones (aunque la persona no los escriba). */
export function normalizeLicenseCode(raw: string) {
  const plain = raw.toUpperCase().replace(/[^A-Z0-9]/g, "")
  if (plain.startsWith("OSPRO") && plain.length === 13) return `OS-PRO-${plain.slice(5, 9)}-${plain.slice(9)}`
  return raw.trim().toUpperCase().replace(/\s+/g, "")
}

/** ¿Lo que escribió la persona parece un código de activación (y no un cupón de descuento)? */
export function looksLikeLicenseCode(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").startsWith("OSPRO")
}

export function isValidLicenseFormat(code: string) {
  return CODE_RE.test(code)
}

export async function logLicense(
  client: Client,
  entry: { kind: string; detail: string; codeId?: string | null; code?: string | null; mlOrderId?: string | null },
) {
  await client.licenseLog.create({
    data: { kind: entry.kind, detail: entry.detail.slice(0, 1000), codeId: entry.codeId ?? null, code: entry.code ?? null, mlOrderId: entry.mlOrderId ?? null },
  })
}

/** Crea `count` códigos nuevos (si alguno choca con uno existente, se genera otro). */
export async function generateCodes(count: number, opts: { note?: string | null; createdBy?: string | null } = {}) {
  const created: string[] = []
  for (let round = 0; created.length < count && round < 5; round++) {
    const codes = Array.from({ length: count - created.length }, newLicenseCode).filter((c) => !created.includes(c))
    const existing = new Set((await db.activationCode.findMany({ where: { code: { in: codes } }, select: { code: true } })).map((c) => c.code))
    const fresh = [...new Set(codes)].filter((c) => !existing.has(c))
    const r = await db.activationCode.createMany({
      data: fresh.map((code) => ({ code, note: opts.note || null, createdBy: opts.createdBy ?? null })),
      skipDuplicates: true,
    })
    created.push(...fresh.slice(0, r.count))
  }
  await logLicense(db, { kind: "generados", detail: `${created.length} ${created.length === 1 ? "código nuevo" : "códigos nuevos"}${opts.createdBy ? ` (${opts.createdBy})` : ""}` })
  return created
}

export async function availableCount() {
  return db.activationCode.count({ where: { status: "AVAILABLE" } })
}

const LIVE_SUBSCRIPTION = ["authorized", "paused", "pending"]

/**
 * Canjea un código de activación: la persona (dueña) y todos sus negocios y sucursales (hasta las 3 de Pro) quedan
 * en Pro sin vencimiento. Si pagaba Pro mes a mes, primero se cancela ese cobro; si no se puede cancelar, el código
 * no se gasta (así nunca queda pagando y con la licencia a la vez).
 */
export async function redeemLicense(input: {
  userId: string
  email: string
  businessId: string
  rawCode: string
  /** Para las pruebas; por defecto cancela en Mercado Pago. */
  cancelSubscription?: (externalId: string) => Promise<unknown>
}) {
  const code = normalizeLicenseCode(input.rawCode)
  const cancel = input.cancelSubscription ?? cancelPreapproval
  if (!isValidLicenseFormat(code)) throw new LicenseError("Ese código no existe. Revisa que esté escrito tal como te llegó.")

  const found = await db.activationCode.findUnique({ where: { code } })
  if (!found) throw new LicenseError("Ese código no existe. Revisa que esté escrito tal como te llegó.")
  if (found.status === "USED") throw new LicenseError("Ese código ya fue usado.")
  if (found.status === "VOID") throw new LicenseError("Ese código fue anulado y ya no sirve.")

  const owned = await db.businessMember.findMany({
    where: { userId: input.userId, role: "OWNER" },
    select: { business: { select: { id: true, name: true, plan: true, planExpiresAt: true, licenseCodeId: true, createdAt: true } } },
  })
  const current = owned.find((o) => o.business.id === input.businessId)?.business
  if (!current) throw new LicenseError("Solo el dueño de la cuenta puede canjear este código.")
  if (current.licenseCodeId && current.plan === "PRO" && !current.planExpiresAt) throw new LicenseError("Tu cuenta ya tiene el Plan Pro permanente.")
  if (owned.some((o) => effectivePlan(o.business) === "BUSINESS")) {
    throw new LicenseError(`Tu cuenta tiene el plan ${PLANS.BUSINESS.name}, que ya incluye todo lo de Pro. El código no se usó.`)
  }

  // El negocio donde se canjea primero, y después los demás (los más antiguos), hasta el máximo de Pro.
  const targets = [current, ...owned.map((o) => o.business).filter((b) => b.id !== current.id).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())]
    .slice(0, PLANS.PRO.maxBusinesses)
    .map((b) => b.id)

  // Se aparta el código por un minuto: si dos personas lo canjean a la vez, a la segunda no se le cancela nada.
  const leaseAt = new Date()
  const lease = await db.activationCode.updateMany({
    where: { id: found.id, status: { in: ["AVAILABLE", "RESERVED"] }, OR: [{ sendingUntil: null }, { sendingUntil: { lt: leaseAt } }] },
    data: { sendingUntil: new Date(leaseAt.getTime() + 60_000) },
  })
  if (lease.count !== 1) throw new LicenseError("Ese código ya se está usando en este momento. Intenta de nuevo en un minuto.")
  const release = () => db.activationCode.updateMany({ where: { id: found.id, status: { in: ["AVAILABLE", "RESERVED"] } }, data: { sendingUntil: null } })

  // Cobro mensual: se cancela antes de gastar el código. Si falla, al reintentar solo quedan las que faltan.
  const subs = await db.subscription.findMany({ where: { businessId: { in: targets }, status: { in: LIVE_SUBSCRIPTION } }, select: { id: true, externalId: true } })
  for (const s of subs) {
    try {
      await cancel(s.externalId)
    } catch (error) {
      console.error("[licencias] no se pudo cancelar la suscripción", s.externalId, error)
      await release()
      throw new LicenseError("No pudimos cancelar tu suscripción mensual en Mercado Pago, así que el código no se usó. Intenta de nuevo en unos minutos.")
    }
    await db.subscription.update({ where: { id: s.id }, data: { status: "cancelled", giftPausedUntil: null } })
  }

  const now = new Date()
  await db
    .$transaction(async (tx) => {
    // Solo si sigue sin usar: si dos personas canjean el mismo código a la vez, solo una lo logra.
    const claimed = await tx.activationCode.updateMany({
      where: { id: found.id, status: { in: ["AVAILABLE", "RESERVED"] } },
      data: { status: "USED", redeemedAt: now, redeemedByUserId: input.userId, redeemedByEmail: input.email, businessId: current.id, sendingUntil: null },
    })
    if (claimed.count !== 1) throw new LicenseError("Ese código ya fue usado.")
    await tx.business.updateMany({ where: { id: { in: targets } }, data: { plan: "PRO", planExpiresAt: null, licenseCodeId: found.id } })
    await logLicense(tx, {
      kind: "canje",
      codeId: found.id,
      code: found.code,
      mlOrderId: found.mlOrderId,
      detail: `${input.email} lo canjeó en ${current.name}${targets.length > 1 ? ` y ${targets.length - 1} ${targets.length === 2 ? "sucursal más" : "sucursales más"}` : ""}${subs.length ? " (se canceló su suscripción mensual)" : ""}`,
    })
    })
    .catch(async (error) => {
      await release()
      throw error
    })
  return { businesses: targets.length, cancelledSubscriptions: subs.length }
}

/** Anula un código. Si ya estaba canjeado, esos negocios vuelven al plan Gratis (para devoluciones). Sus datos no se borran. */
export async function voidCode(codeId: string, opts: { by?: string | null; reason?: string | null } = {}) {
  return db.$transaction(async (tx) => {
    const code = await tx.activationCode.findUnique({ where: { id: codeId } })
    if (!code) throw new LicenseError("No encontramos ese código.")
    if (code.status === "VOID") throw new LicenseError("Ese código ya estaba anulado.")
    const reason = opts.reason?.trim()
    await tx.activationCode.update({
      where: { id: code.id },
      data: { status: "VOID", voidedAt: new Date(), sendingUntil: null, ...(reason ? { note: code.note ? `${code.note} · ${reason}` : reason } : {}) },
    })
    const downgraded =
      code.status === "USED"
        ? (await tx.business.updateMany({ where: { licenseCodeId: code.id }, data: { plan: "FREE", planExpiresAt: null, licenseCodeId: null } })).count
        : 0
    // Si venía de una venta con algo que revisar (cancelada o devuelta), queda resuelto.
    if (code.mlOrderId) await tx.mlOrder.updateMany({ where: { id: code.mlOrderId, reviewReason: { not: null } }, data: { reviewedAt: new Date() } })
    await logLicense(tx, {
      kind: "anulado",
      codeId: code.id,
      code: code.code,
      mlOrderId: code.mlOrderId,
      detail: `Anulado${opts.by ? ` por ${opts.by}` : ""}${reason ? `: ${reason}` : ""}${downgraded ? `. ${downgraded} ${downgraded === 1 ? "negocio volvió" : "negocios volvieron"} al plan Gratis` : ""}`,
    })
    return { downgraded, wasUsed: code.status === "USED" }
  })
}

/** Entrega a mano (por ejemplo, copiado y enviado por chat): queda reservado y con fecha de envío. */
export async function markDelivered(codeId: string, opts: { by?: string | null; orderId?: string | null; note?: string | null } = {}) {
  const code = await db.activationCode.findUnique({ where: { id: codeId } })
  if (!code) throw new LicenseError("No encontramos ese código.")
  if (code.status === "USED" || code.status === "VOID") throw new LicenseError("Ese código ya fue usado o anulado.")
  const note = opts.note?.trim()
  await db.activationCode.update({
    where: { id: code.id },
    data: {
      status: "RESERVED",
      reservedAt: code.reservedAt ?? new Date(),
      sentAt: new Date(),
      sendingUntil: null,
      lastError: null,
      ...(opts.orderId && !code.mlOrderId ? { mlOrderId: opts.orderId, mlUnit: null } : {}),
      ...(note ? { note: code.note ? `${code.note} · ${note}` : note } : {}),
    },
  })
  await logLicense(db, { kind: "enviado", codeId: code.id, code: code.code, mlOrderId: code.mlOrderId ?? opts.orderId, detail: `Marcado como entregado a mano${opts.by ? ` por ${opts.by}` : ""}` })
}
