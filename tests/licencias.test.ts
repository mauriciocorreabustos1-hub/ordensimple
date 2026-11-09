// Pruebas de los códigos de activación del Plan Pro permanente y de la entrega por Mercado Libre.
// Usan la base LOCAL (se niegan a correr contra otra) y dejan todo como estaba al terminar.
// Correr con:  npm run test:licencias

import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, before, describe, test } from "node:test"
import { db } from "@/lib/db"
import { CODE_ALPHABET, generateCodes, isValidLicenseFormat, LicenseError, newLicenseCode, normalizeLicenseCode, redeemLicense, voidCode } from "@/server/licenses"
import type { MlClient, MlOrderData } from "@/server/mercadolibre"
import { licenseMessage, processMlOrder, reconcileMlSales, retryMlDeliveries, sendOrderCodes } from "@/server/ml-sales"

const url = process.env.DATABASE_URL ?? ""
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) throw new Error("Estas pruebas solo corren contra la base local (DATABASE_URL en localhost).")

const ITEM = "MLC999000111"
process.env.MERCADOLIBRE_ITEM_IDS = ITEM
const started = new Date()
const tag = randomUUID().slice(0, 8)
const users: string[] = []
const businesses: string[] = []
const orders: string[] = []
const codeIds: string[] = []
let parked: string[] = []

async function owner(name: string, branches = 0) {
  const userId = `prueba-lic-${tag}-${users.length}`
  await db.user.create({ data: { id: userId, name, email: `prueba-licencias-${tag}-${users.length}@ordensimple.test`, emailVerified: true } })
  users.push(userId)
  const ids: string[] = []
  for (let i = 0; i <= branches; i++) {
    const b = await db.business.create({ data: { name: i ? `${name} sucursal ${i}` : name, members: { create: { userId, role: "OWNER" } } } })
    ids.push(b.id)
    businesses.push(b.id)
  }
  return { userId, email: `prueba-licencias-${tag}-${users.length - 1}@ordensimple.test`, businessId: ids[0], branchIds: ids.slice(1) }
}

async function freshCodes(n: number) {
  const codes = await generateCodes(n, { note: `prueba ${tag}` })
  const rows = await db.activationCode.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } })
  codeIds.push(...rows.map((r) => r.id))
  return codes
}

const rejects = (p: Promise<unknown>, text: RegExp) => assert.rejects(p, (e: unknown) => e instanceof LicenseError && text.test(e.message))

before(async () => {
  // Los códigos disponibles que ya hubiera en la base local se apartan, para que la venta simulada use solo los de prueba.
  parked = (await db.activationCode.findMany({ where: { status: "AVAILABLE" }, select: { id: true } })).map((c) => c.id)
  if (parked.length) await db.activationCode.updateMany({ where: { id: { in: parked } }, data: { status: "VOID" } })
})

after(async () => {
  await db.activationCode.deleteMany({ where: { OR: [{ id: { in: codeIds } }, { note: `prueba ${tag}` }] } })
  if (parked.length) await db.activationCode.updateMany({ where: { id: { in: parked } }, data: { status: "AVAILABLE" } })
  await db.mlOrder.deleteMany({ where: { id: { in: orders } } })
  await db.subscription.deleteMany({ where: { businessId: { in: businesses } } })
  await db.business.deleteMany({ where: { id: { in: businesses } } })
  await db.user.deleteMany({ where: { id: { in: users } } })
  await db.licenseLog.deleteMany({ where: { createdAt: { gte: started } } })
  await db.rateLimit.deleteMany({ where: { key: { startsWith: "licencias:aviso" } } })
  await db.$disconnect()
})

describe("generar códigos", () => {
  test("crea códigos únicos con el formato OS-PRO-XXXX-XXXX y sin letras confusas", async () => {
    const codes = await freshCodes(25)
    assert.equal(codes.length, 25)
    assert.equal(new Set(codes).size, 25)
    for (const c of codes) {
      assert.ok(isValidLicenseFormat(c), c)
      assert.doesNotMatch(c.slice(7), /[O0I1L]/)
    }
    const stored = await db.activationCode.findMany({ where: { code: { in: codes } } })
    assert.ok(stored.every((c) => c.status === "AVAILABLE" && c.kind === "pro_permanente" && c.plan === "PRO"))
    assert.ok(!/[O0I1L]/.test(CODE_ALPHABET))
  })

  test("acepta el código escrito sin guiones o en minúsculas", () => {
    const c = newLicenseCode()
    assert.equal(normalizeLicenseCode(c.replace(/-/g, "").toLowerCase()), c)
    assert.equal(normalizeLicenseCode(` ${c.toLowerCase()} `), c)
  })
})

describe("canjear", () => {
  test("código válido: la cuenta y sus sucursales pasan a Pro permanente y el código queda usado", async () => {
    const [code] = await freshCodes(1)
    const o = await owner("Almacén Prueba", 1)
    const r = await redeemLicense({ userId: o.userId, email: o.email, businessId: o.businessId, rawCode: code })
    assert.equal(r.businesses, 2)
    const stored = await db.activationCode.findUniqueOrThrow({ where: { code } })
    assert.equal(stored.status, "USED")
    assert.equal(stored.redeemedByUserId, o.userId)
    assert.equal(stored.businessId, o.businessId)
    assert.ok(stored.redeemedAt)
    for (const id of [o.businessId, ...o.branchIds]) {
      const b = await db.business.findUniqueOrThrow({ where: { id } })
      assert.equal(b.plan, "PRO")
      assert.equal(b.planExpiresAt, null)
      assert.equal(b.licenseCodeId, stored.id)
    }
    // La misma cuenta no puede gastar otro código.
    const [other] = await freshCodes(1)
    await rejects(redeemLicense({ userId: o.userId, email: o.email, businessId: o.businessId, rawCode: other }), /ya tiene el Plan Pro permanente/)
    assert.equal((await db.activationCode.findUniqueOrThrow({ where: { code: other } })).status, "AVAILABLE")
  })

  test("código ya usado", async () => {
    const [code] = await freshCodes(1)
    const a = await owner("Negocio A")
    const b = await owner("Negocio B")
    await redeemLicense({ userId: a.userId, email: a.email, businessId: a.businessId, rawCode: code })
    await rejects(redeemLicense({ userId: b.userId, email: b.email, businessId: b.businessId, rawCode: code }), /ya fue usado/)
    assert.equal((await db.business.findUniqueOrThrow({ where: { id: b.businessId } })).plan, "FREE")
  })

  test("dos canjes del mismo código a la vez: solo uno lo logra", async () => {
    const [code] = await freshCodes(1)
    const a = await owner("Simultáneo A")
    const b = await owner("Simultáneo B")
    const results = await Promise.allSettled([
      redeemLicense({ userId: a.userId, email: a.email, businessId: a.businessId, rawCode: code }),
      redeemLicense({ userId: b.userId, email: b.email, businessId: b.businessId, rawCode: code }),
    ])
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1)
    const pro = await db.business.count({ where: { id: { in: [a.businessId, b.businessId] }, plan: "PRO" } })
    assert.equal(pro, 1)
  })

  test("código anulado", async () => {
    const [code] = await freshCodes(1)
    const row = await db.activationCode.findUniqueOrThrow({ where: { code } })
    await voidCode(row.id, { reason: "prueba" })
    const o = await owner("Negocio C")
    await rejects(redeemLicense({ userId: o.userId, email: o.email, businessId: o.businessId, rawCode: code }), /anulado/)
  })

  test("código inexistente o mal escrito", async () => {
    const o = await owner("Negocio D")
    let missing = newLicenseCode()
    while (await db.activationCode.findUnique({ where: { code: missing } })) missing = newLicenseCode()
    await rejects(redeemLicense({ userId: o.userId, email: o.email, businessId: o.businessId, rawCode: missing }), /no existe/)
    await rejects(redeemLicense({ userId: o.userId, email: o.email, businessId: o.businessId, rawCode: "OS-PRO-1234" }), /no existe/)
  })

  test("si pagaba Pro mensual, se cancela la suscripción; si no se puede cancelar, el código no se gasta", async () => {
    const [code] = await freshCodes(1)
    const o = await owner("Con suscripción")
    await db.subscription.create({ data: { businessId: o.businessId, externalId: `pre-${tag}-1`, status: "authorized", amount: 6990, payerEmail: o.email } })

    await rejects(
      redeemLicense({ userId: o.userId, email: o.email, businessId: o.businessId, rawCode: code, cancelSubscription: async () => { throw new Error("Mercado Pago caído") } }),
      /no pudimos cancelar/i,
    )
    assert.equal((await db.activationCode.findUniqueOrThrow({ where: { code } })).status, "AVAILABLE")
    assert.equal((await db.subscription.findUniqueOrThrow({ where: { externalId: `pre-${tag}-1` } })).status, "authorized")

    const cancelled: string[] = []
    const r = await redeemLicense({ userId: o.userId, email: o.email, businessId: o.businessId, rawCode: code, cancelSubscription: async (id) => cancelled.push(id) })
    assert.deepEqual(cancelled, [`pre-${tag}-1`])
    assert.equal(r.cancelledSubscriptions, 1)
    assert.equal((await db.subscription.findUniqueOrThrow({ where: { externalId: `pre-${tag}-1` } })).status, "cancelled")
    assert.equal((await db.activationCode.findUniqueOrThrow({ where: { code } })).status, "USED")
  })
})

describe("anular", () => {
  test("anular un código canjeado devuelve la cuenta y sus sucursales al plan Gratis", async () => {
    const [code] = await freshCodes(1)
    const o = await owner("Para devolver", 1)
    await redeemLicense({ userId: o.userId, email: o.email, businessId: o.businessId, rawCode: code })
    const row = await db.activationCode.findUniqueOrThrow({ where: { code } })
    const r = await voidCode(row.id, { by: "admin@prueba", reason: "devolución" })
    assert.equal(r.downgraded, 2)
    assert.equal((await db.activationCode.findUniqueOrThrow({ where: { code } })).status, "VOID")
    for (const id of [o.businessId, ...o.branchIds]) {
      const b = await db.business.findUniqueOrThrow({ where: { id } })
      assert.equal(b.plan, "FREE")
      assert.equal(b.licenseCodeId, null)
    }
    await rejects(voidCode(row.id), /ya estaba anulado/)
  })
})

// ─── Mercado Libre simulado ─────────────────────────────────────────────────

const SELLER = "123456789"

function fakeMl(order: MlOrderData, opts: { failSends?: number } = {}) {
  const sent: { packId: string; text: string }[] = []
  let failures = opts.failSends ?? 0
  const client: MlClient = {
    sellerId: async () => SELLER,
    getOrder: async () => structuredClone(order),
    searchOrders: async () => [structuredClone(order)],
    sendMessage: async (packId, text) => {
      await new Promise((r) => setTimeout(r, 5))
      if (failures > 0) {
        failures--
        throw new Error("403 blocked_by_conversation_started_by_seller")
      }
      sent.push({ packId, text })
    },
  }
  return { client, sent, setOrder: (o: Partial<MlOrderData>) => Object.assign(order, o) }
}

function paidOrder(id: string, quantity: number, item = ITEM): MlOrderData {
  orders.push(id)
  return {
    id,
    status: "paid",
    pack_id: null,
    seller: { id: SELLER },
    buyer: { id: 555, nickname: "COMPRADOR_PRUEBA" },
    order_items: [{ item: { id: item }, quantity }],
    payments: [{ status: "approved" }],
  }
}

const noWait = { retryDelaysMs: [0, 0, 0], alert: async () => {} }

describe("venta en Mercado Libre", () => {
  test("una venta de 2 unidades asigna 2 códigos y los envía en un solo mensaje, una sola vez, aunque el aviso llegue repetido", async () => {
    await freshCodes(3)
    const orderId = `9990001${Date.now() % 100000}`
    const ml = fakeMl(paidOrder(orderId, 2))
    // Aviso repetido: dos al mismo tiempo y otro después.
    await Promise.all([processMlOrder(orderId, ml.client, noWait), processMlOrder(orderId, ml.client, noWait)])
    await processMlOrder(orderId, ml.client, noWait)

    const codes = await db.activationCode.findMany({ where: { mlOrderId: orderId }, orderBy: { mlUnit: "asc" } })
    assert.equal(codes.length, 2)
    assert.deepEqual(codes.map((c) => c.mlUnit), [1, 2])
    assert.ok(codes.every((c) => c.status === "RESERVED" && c.sentAt))
    // Mercado Libre deja un solo mensaje del vendedor: los 2 códigos van juntos.
    assert.equal(ml.sent.length, 1)
    assert.equal(ml.sent[0].text, licenseMessage(codes.map((c) => c.code)))
    assert.ok(ml.sent.every((m) => m.packId === orderId))
    // Mensaje: máximo 350 caracteres, solo latin1 (Mercado Libre rechaza otros), sin enlaces.
    for (const m of ml.sent) {
      assert.ok(m.text.length <= 350, `${m.text.length} caracteres`)
      assert.ok([...m.text].every((ch) => ch.charCodeAt(0) <= 0xff), "solo caracteres latin1")
      assert.doesNotMatch(m.text, /https?:|www\.|@/)
    }
    const order = await db.mlOrder.findUniqueOrThrow({ where: { id: orderId } })
    assert.equal(order.units, 2)
    assert.equal(order.pendingUnits, 0)
  })

  test("los mensajes caben en 350 caracteres aunque compren muchas unidades", async () => {
    const one = licenseMessage(newLicenseCode())
    assert.ok(one.length <= 350, `${one.length}`)
    const four = licenseMessage(Array.from({ length: 4 }, newLicenseCode))
    assert.ok(four.length <= 350, `${four.length}`)
  })

  test("si el mensaje falla, el código queda reservado y se envía al reintentar", async () => {
    await freshCodes(1)
    const orderId = `9990002${Date.now() % 100000}`
    const ml = fakeMl(paidOrder(orderId, 1), { failSends: 3 })
    const alerts: string[] = []
    const r = await processMlOrder(orderId, ml.client, { retryDelaysMs: [0, 0, 0], alert: async (s) => void alerts.push(s) })
    assert.equal(r.result, "procesada")
    let code = await db.activationCode.findFirstOrThrow({ where: { mlOrderId: orderId } })
    assert.equal(code.status, "RESERVED")
    assert.equal(code.sentAt, null)
    assert.equal(code.sendAttempts, 3)
    assert.match(code.lastError ?? "", /blocked/)
    assert.ok(alerts.some((a) => /No se pudo enviar/.test(a)))

    await sendOrderCodes(orderId, ml.client, noWait)
    await sendOrderCodes(orderId, ml.client, noWait)
    code = await db.activationCode.findFirstOrThrow({ where: { mlOrderId: orderId } })
    assert.ok(code.sentAt)
    assert.equal(ml.sent.length, 1)
  })

  test("sin códigos disponibles la venta queda esperando y se entrega al generar más", async () => {
    // Se apartan los disponibles que quedaron de las pruebas anteriores.
    const left = (await db.activationCode.findMany({ where: { status: "AVAILABLE" }, select: { id: true } })).map((c) => c.id)
    await db.activationCode.updateMany({ where: { id: { in: left } }, data: { status: "VOID" } })
    const orderId = `9990003${Date.now() % 100000}`
    const ml = fakeMl(paidOrder(orderId, 1))
    const r = await processMlOrder(orderId, ml.client, noWait)
    assert.equal(r.result === "procesada" && r.pendingUnits, 1)
    assert.equal(ml.sent.length, 0)
    await freshCodes(1)
    await processMlOrder(orderId, ml.client, noWait)
    assert.equal(ml.sent.length, 1)
    assert.equal((await db.mlOrder.findUniqueOrThrow({ where: { id: orderId } })).pendingUnits, 0)
  })

  test("no entrega si el pago no está aprobado, si es otra publicación o si la venta no es de la cuenta", async () => {
    await freshCodes(1)
    const pendingId = `9990004${Date.now() % 100000}`
    const pending = fakeMl({ ...paidOrder(pendingId, 1), status: "payment_required", payments: [{ status: "pending" }] })
    assert.equal((await processMlOrder(pendingId, pending.client, noWait)).result, "esperando")
    const otherId = `9990005${Date.now() % 100000}`
    const other = fakeMl(paidOrder(otherId, 1, "MLC000000001"))
    assert.equal((await processMlOrder(otherId, other.client, noWait)).result, "ignorada")
    const foreignId = `9990006${Date.now() % 100000}`
    const foreign = fakeMl({ ...paidOrder(foreignId, 1), seller: { id: "42" } })
    assert.equal((await processMlOrder(foreignId, foreign.client, noWait)).result, "ignorada")
    assert.equal(await db.activationCode.count({ where: { mlOrderId: { in: [pendingId, otherId, foreignId] } } }), 0)
    assert.equal(pending.sent.length + other.sent.length + foreign.sent.length, 0)
  })

  test("la revisión encuentra una venta de la que nunca llegó aviso, y no repite nada al volver a pasar", async () => {
    await freshCodes(1)
    const orderId = `9990008${Date.now() % 100000}`
    const ml = fakeMl(paidOrder(orderId, 1))
    const first = await reconcileMlSales(ml.client, noWait)
    assert.equal(first.recuperadas, 1)
    assert.equal(ml.sent.length, 1)
    const second = await reconcileMlSales(ml.client, noWait)
    assert.equal(second.recuperadas, 0)
    assert.equal(ml.sent.length, 1)
  })

  test("la revisión completa una venta pagada que quedó sin códigos, y marca las devoluciones parciales", async () => {
    await freshCodes(1)
    const orderId = `9990010${Date.now() % 100000}`
    orders.push(orderId)
    // Como si la asignación se hubiera cortado: la venta está registrada y pagada, sin códigos.
    await db.mlOrder.create({ data: { id: orderId, packId: orderId, status: "paid", paid: true, units: 1, pendingUnits: 0 } })
    const ml = fakeMl(paidOrder(orderId, 1))
    await reconcileMlSales(ml.client, noWait)
    assert.equal(ml.sent.length, 1)
    assert.equal(await db.activationCode.count({ where: { mlOrderId: orderId } }), 1)

    ml.setOrder({ status: "partially_refunded" })
    await reconcileMlSales(ml.client, noWait)
    assert.equal((await db.mlOrder.findUniqueOrThrow({ where: { id: orderId } })).reviewReason, "El pago se devolvió en parte")
  })

  test("si Mercado Libre no responde, queda registrado y avisa", async () => {
    await db.mercadoLibreAccount.create({ data: { id: "principal", sellerId: SELLER, accessToken: "x", refreshToken: "x", expiresAt: new Date(Date.now() + 3_600_000) } })
    try {
      const alerts: string[] = []
      const ml = fakeMl(paidOrder(`9990009${Date.now() % 100000}`, 1))
      ml.client.searchOrders = async () => { throw new Error("401 invalid_token") }
      const r = await retryMlDeliveries(ml.client, { ...noWait, alert: async (s) => void alerts.push(s) })
      assert.ok("error" in r)
      assert.equal(alerts.length, 1)
      assert.ok(await db.licenseLog.findFirst({ where: { kind: "conexion_error", createdAt: { gte: started } } }))
    } finally {
      await db.mercadoLibreAccount.delete({ where: { id: "principal" } })
    }
  })

  test("si la venta se cancela o se devuelve, queda para revisar y avisa una sola vez", async () => {
    await freshCodes(1)
    const orderId = `9990007${Date.now() % 100000}`
    const ml = fakeMl(paidOrder(orderId, 1))
    await processMlOrder(orderId, ml.client, noWait)
    const alerts: string[] = []
    ml.setOrder({ status: "cancelled", payments: [{ status: "refunded" }] })
    const opts = { ...noWait, alert: async (s: string) => void alerts.push(s) }
    assert.equal((await processMlOrder(orderId, ml.client, opts)).result, "revisar")
    await processMlOrder(orderId, ml.client, opts)
    const order = await db.mlOrder.findUniqueOrThrow({ where: { id: orderId } })
    assert.equal(order.reviewReason, "La venta se canceló")
    assert.equal(order.reviewedAt, null)
    assert.equal(alerts.length, 1)
    // Al anular su código, el aviso queda resuelto.
    const code = await db.activationCode.findFirstOrThrow({ where: { mlOrderId: orderId } })
    await voidCode(code.id, { reason: "venta cancelada" })
    assert.ok((await db.mlOrder.findUniqueOrThrow({ where: { id: orderId } })).reviewedAt)
  })
})
