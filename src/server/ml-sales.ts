import "server-only"
import { db } from "@/lib/db"
import { sendEmail } from "@/lib/email"
import { availableCount, logLicense } from "@/server/licenses"
import { licenseItemIds, type MlClient } from "@/server/mercadolibre"
import { allowAttempt } from "@/server/rate-limit"

// Venta del Pro permanente en Mercado Libre: se consulta la orden (nunca se confía en el aviso), se asigna un código
// por unidad pagada y se le envía al comprador por la mensajería de la venta. Todo se puede repetir sin riesgo:
// cada unidad tiene un solo código (regla única en la base) y cada código se envía una sola vez.

/** Texto del mensaje (máximo 350 caracteres, sin enlaces ni datos de contacto, solo caracteres latinos). */
export function licenseMessage(codes: string | string[]) {
  const list = typeof codes === "string" ? [codes] : codes
  if (list.length === 1) {
    return `¡Gracias por tu compra! Tu código de activación del Plan Pro permanente de OrdenSimple es: ${list[0]}
Para activarlo: crea tu cuenta gratis en OrdenSimple, entra a Planes, Canjear código e ingresa el código. Si tienes dudas, escríbenos por este chat.`
  }
  return `¡Gracias por tu compra! Tus códigos de activación del Plan Pro permanente de OrdenSimple son: ${list.join(", ")}
Para activarlos: crea tu cuenta gratis en OrdenSimple, entra a Planes, Canjear código e ingresa un código por cuenta. Si tienes dudas, escríbenos por este chat.`
}

/** Pocos códigos disponibles: aviso por correo cuando quedan menos de 5. */
const LOW_STOCK = 5

type Options = {
  /** Esperas entre reintentos del mensaje (en las pruebas, 0). */
  retryDelaysMs?: number[]
  /** Correo a los administradores (en las pruebas se reemplaza). */
  alert?: (subject: string, text: string) => Promise<void>
}

function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean)
}

async function alertAdmins(subject: string, text: string) {
  const to = adminEmails()
  for (const email of to) await sendEmail({ to: email, subject, text }).catch((e) => console.error("[mercadolibre] correo de aviso", e))
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Avisa si quedan pocos códigos (como máximo un correo cada 12 horas por cada caso). */
export async function checkCodeStock(alert: Options["alert"] = alertAdmins) {
  const left = await availableCount()
  if (left === 0) {
    if (await allowAttempt("licencias:aviso-sin-codigos", 1, 12 * 3_600_000)) {
      await alert("No quedan códigos del Pro permanente", "Se acabaron los códigos de activación disponibles. Genera más en el panel de administración, sección Códigos. Las ventas que lleguen mientras tanto quedan pendientes y se entregan solas al generar códigos.")
    }
  } else if (left < LOW_STOCK) {
    if (await allowAttempt("licencias:aviso-pocos-codigos", 1, 12 * 3_600_000)) {
      await alert(`Quedan ${left} códigos del Pro permanente`, `Quedan ${plural(left, "código disponible", "códigos disponibles")}. Genera más en el panel de administración, sección Códigos.`)
    }
  }
  return left
}

/** Qué revisar de una venta: cancelada, pago devuelto o reclamo. */
function reviewReasonOf(order: { status: string; payments?: { status: string }[]; mediations?: unknown[] }) {
  if (order.status === "cancelled" || order.status === "invalid") return "La venta se canceló"
  if (order.payments?.some((p) => p.status === "refunded" || p.status === "charged_back")) return "El pago se devolvió"
  if (order.mediations?.length) return "El comprador abrió un reclamo"
  return null
}

/**
 * Procesa una venta (al llegar el aviso de Mercado Libre o al reintentar). Devuelve lo que hizo, para el registro.
 */
export async function processMlOrder(orderId: string, client: MlClient, opts: Options = {}) {
  const alert = opts.alert ?? alertAdmins
  const [order, sellerId] = await Promise.all([client.getOrder(orderId), client.sellerId()])
  if (String(order.seller?.id ?? "") !== String(sellerId)) return { result: "ignorada" as const, reason: "La venta no es de la cuenta conectada" }

  const items = licenseItemIds()
  const units = order.order_items.filter((i) => items.includes(String(i.item.id).toUpperCase())).reduce((n, i) => n + i.quantity, 0)
  if (!units) return { result: "ignorada" as const, reason: "No es la publicación del Pro permanente" }

  const id = String(order.id)
  const review = reviewReasonOf(order)
  const paid = order.status === "paid" && Boolean(order.payments?.some((p) => p.status === "approved")) && !review
  const previous = await db.mlOrder.findUnique({ where: { id } })
  const base = {
    packId: String(order.pack_id ?? order.id),
    buyerId: order.buyer?.id ? String(order.buyer.id) : null,
    buyerNick: order.buyer?.nickname ?? null,
    status: order.status,
    paid,
    units,
  }
  const newReview = review && review !== previous?.reviewReason
  await db.mlOrder.upsert({
    where: { id },
    create: { id, ...base, reviewReason: review },
    update: { ...base, ...(newReview ? { reviewReason: review, reviewedAt: null } : {}) },
  })

  if (review) {
    if (newReview) {
      const codes = await db.activationCode.findMany({ where: { mlOrderId: id, status: { not: "VOID" } }, select: { code: true, status: true } })
      await logLicense(db, { kind: "revisar", mlOrderId: id, detail: `${review}${codes.length ? `. Códigos de esta venta: ${codes.map((c) => c.code).join(", ")}` : ". No tenía códigos asignados"}` })
      if (codes.length) {
        await alert(
          `Venta ${id} de Mercado Libre: ${review.toLowerCase()}`,
          `${review} (venta ${id}${base.buyerNick ? `, comprador ${base.buyerNick}` : ""}). Tenía ${plural(codes.length, "código", "códigos")}: ${codes.map((c) => `${c.code} (${c.status === "USED" ? "ya canjeado" : "sin canjear"})`).join(", ")}. Revísalo en el panel de administración, sección Códigos, para anularlo.`,
        )
      }
    }
    return { result: "revisar" as const, reason: review }
  }
  if (!paid) return { result: "esperando" as const, reason: "El pago todavía no está aprobado" }

  // Un código por unidad. El candado por venta evita que dos avisos simultáneos asignen a la vez.
  const assigned = await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ml-orden:${id}`}))`
      const have = await tx.activationCode.findMany({ where: { mlOrderId: id, mlUnit: { not: null } }, select: { mlUnit: true } })
      const taken = new Set(have.map((c) => c.mlUnit))
      const added: { id: string; code: string }[] = []
      for (let unit = 1; unit <= units; unit++) {
        if (taken.has(unit)) continue
        const rows = await tx.$queryRaw<{ id: string; code: string }[]>`
          UPDATE "activation_code" SET "status" = 'RESERVED'::"ActivationCodeStatus", "reservedAt" = now(), "mlOrderId" = ${id}, "mlUnit" = ${unit}
          WHERE "id" = (SELECT "id" FROM "activation_code" WHERE "status" = 'AVAILABLE'::"ActivationCodeStatus" ORDER BY "createdAt", "id" LIMIT 1 FOR UPDATE SKIP LOCKED)
          RETURNING "id", "code"`
        if (!rows[0]) break
        added.push(rows[0])
        taken.add(unit)
        await logLicense(tx, { kind: "asignado", codeId: rows[0].id, code: rows[0].code, mlOrderId: id, detail: `Asignado a la venta ${id}, unidad ${unit} de ${units}` })
      }
      const pendingUnits = units - taken.size
      await tx.mlOrder.update({ where: { id }, data: { pendingUnits } })
      return { added, pendingUnits }
    },
    { timeout: 30_000, maxWait: 30_000 },
  )

  if (assigned.pendingUnits > 0) {
    await logLicense(db, { kind: "sin_codigos", mlOrderId: id, detail: `Faltan ${plural(assigned.pendingUnits, "código", "códigos")} para la venta ${id}: no quedan disponibles` })
  }
  await checkCodeStock(alert)
  const sent = await sendOrderCodes(id, client, opts)
  return { result: "procesada" as const, assigned: assigned.added.length, pendingUnits: assigned.pendingUnits, ...sent }
}

/** Envía por mensaje los códigos de una venta que todavía no se enviaron. Cada código se envía una sola vez. */
export async function sendOrderCodes(orderId: string, client: MlClient, opts: Options = {}) {
  const delays = opts.retryDelaysMs ?? [0, 2_000, 5_000]
  const alert = opts.alert ?? alertAdmins
  const order = await db.mlOrder.findUnique({ where: { id: orderId } })
  // Venta cancelada, devuelta o con reclamo: nunca se envía, aunque el aviso ya se haya marcado como revisado.
  if (!order || order.reviewReason || !order.paid) return { sent: 0, failed: 0 }
  const pending = await db.activationCode.findMany({ where: { mlOrderId: orderId, status: "RESERVED", sentAt: null }, orderBy: { mlUnit: "asc" } })
  // Se "toman" los códigos por 2 minutos: si llega otro aviso de la misma venta mientras tanto, no los vuelve a enviar.
  const leased: typeof pending = []
  for (const code of pending) {
    const now = new Date()
    const lease = await db.activationCode.updateMany({
      where: { id: code.id, status: "RESERVED", sentAt: null, OR: [{ sendingUntil: null }, { sendingUntil: { lt: now } }] },
      data: { sendingUntil: new Date(now.getTime() + 120_000) },
    })
    if (lease.count === 1) leased.push(code)
  }
  let sent = 0
  let failed = 0
  // Mercado Libre deja al vendedor un solo mensaje hasta que el comprador responda: todos los códigos van juntos.
  for (const group of messageGroups(leased.map((c) => c.code))) {
    const codes = leased.filter((c) => group.includes(c.code))
    let lastError = ""
    let ok = false
    let tries = 0
    for (const delay of delays) {
      if (delay) await wait(delay)
      tries++
      try {
        await client.sendMessage(order.packId, licenseMessage(group))
        ok = true
        break
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
      }
    }
    for (const code of codes) {
      if (ok) {
        sent++
        await db.activationCode.update({ where: { id: code.id }, data: { sentAt: new Date(), sendingUntil: null, lastError: null, sendAttempts: { increment: tries } } })
        await logLicense(db, { kind: "enviado", codeId: code.id, code: code.code, mlOrderId: orderId, detail: `Enviado al comprador${order.buyerNick ? ` ${order.buyerNick}` : ""} por la mensajería de la venta` })
      } else {
        failed++
        await db.activationCode.update({ where: { id: code.id }, data: { sendingUntil: null, lastError: lastError.slice(0, 500), sendAttempts: { increment: tries } } })
        await logLicense(db, { kind: "envio_fallido", codeId: code.id, code: code.code, mlOrderId: orderId, detail: `No se pudo enviar (${tries} intentos): ${lastError}` })
      }
    }
    // Un correo al primer fallo; después queda en el panel y se reintenta en la tarea diaria.
    if (!ok && codes.every((c) => c.sendAttempts === 0)) {
      await alert(
        `No se pudo enviar ${codes.length === 1 ? "un código" : "los códigos"} de la venta ${orderId}`,
        `${codes.length === 1 ? `El código ${codes[0].code} quedó reservado` : `Los códigos ${group.join(", ")} quedaron reservados`} para la venta ${orderId}${order.buyerNick ? ` (comprador ${order.buyerNick})` : ""}, pero Mercado Libre no aceptó el mensaje: ${lastError}. Se reintentará en la tarea diaria. También puedes enviarlo a mano por el chat de la venta y marcarlo como enviado en el panel de administración, sección Códigos.`,
      )
    }
  }
  return { sent, failed }
}

/** Reparte los códigos en mensajes de 350 caracteres como máximo (normalmente, uno solo). */
function messageGroups(codes: string[]) {
  const groups: string[][] = []
  for (const code of codes) {
    const last = groups.at(-1)
    if (last && licenseMessage([...last, code]).length <= 350) last.push(code)
    else groups.push([code])
  }
  return groups
}

/**
 * Tarea diaria: entrega las ventas que quedaron sin código (no quedaban) y reintenta los mensajes que fallaron.
 * Además mantiene viva la sesión de Mercado Libre (la renovación dura 6 meses si se usa).
 */
export async function retryMlDeliveries(client: MlClient, opts: Options = {}) {
  const account = await db.mercadoLibreAccount.findUnique({ where: { id: "principal" }, select: { id: true } })
  if (!account) return { skipped: "Mercado Libre no está conectado" }
  await client.sellerId()
  let processed = 0
  let sent = 0
  const waiting = await db.mlOrder.findMany({ where: { pendingUnits: { gt: 0 }, reviewReason: null }, select: { id: true }, take: 50 })
  for (const o of waiting) {
    await processMlOrder(o.id, client, opts)
    processed++
  }
  const unsent = await db.activationCode.findMany({
    where: { status: "RESERVED", sentAt: null, mlOrderId: { not: null }, sendAttempts: { lt: 30 } },
    select: { mlOrderId: true },
    distinct: ["mlOrderId"],
    take: 50,
  })
  for (const c of unsent) sent += (await sendOrderCodes(c.mlOrderId!, client, opts)).sent
  return { processed, sent }
}
