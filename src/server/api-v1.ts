import "server-only"
import { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import {
  API_PLAN,
  apiError,
  bearerKey,
  hashApiKey,
  ID,
  isApiKeyFormat,
  pageMeta,
  parseId,
  parseListQuery,
  QUOTE_STATE,
  quoteNumberLabel,
  quoteStatusesFor,
  saleNumber,
  ORDER_STATES,
  type ListQuery,
  type OrderState,
} from "@/lib/api-v1"
import { allowAttempt, isRateLimited } from "@/server/rate-limit"

// Servidor de la API v1: autenticación, límites y lectura de datos de UN negocio (el dueño de la clave).

const PER_MINUTE = 120
const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }

export const jsonResponse = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { ...HEADERS, ...extra } })
export const errorResponse = (status: number, codigo: string, mensaje: string, extra: Record<string, string> = {}) =>
  jsonResponse(apiError(codigo, mensaje), status, extra)

type Account = { businessId: string; keyId: string; currency: string }

/**
 * Valida la clave del encabezado Authorization y aplica el límite de uso. Devuelve el negocio o la respuesta de error.
 * Las claves revocadas o de negocios borrados no sirven. Los intentos con claves falsas también tienen límite por IP.
 */
export async function authenticate(request: Request): Promise<Account | Response> {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "sin-ip"
  const failKey = `api-falla:${ip}`
  if (await isRateLimited(failKey, 30, 10 * 60_000)) {
    return errorResponse(429, "demasiados_intentos", "Demasiados intentos con claves inválidas. Espera 10 minutos.", { "Retry-After": "600" })
  }
  const key = bearerKey(request.headers.get("authorization"))
  const found =
    key && isApiKeyFormat(key)
      ? await db.apiKey.findUnique({
          where: { hash: hashApiKey(key) },
          select: { id: true, businessId: true, revokedAt: true, lastUsedAt: true, business: { select: { currency: true } } },
        })
      : null
  if (!found || found.revokedAt) {
    await allowAttempt(failKey, 30, 10 * 60_000)
    return errorResponse(401, "no_autorizado", key ? "La clave no es válida o fue revocada." : "Falta la clave: envía Authorization: Bearer <clave>.")
  }
  if (!(await allowAttempt(`api:${found.id}`, PER_MINUTE, 60_000))) {
    return errorResponse(429, "limite_de_uso", `Máximo ${PER_MINUTE} peticiones por minuto por clave.`, { "Retry-After": "60" })
  }
  // "Último uso" se guarda como mucho una vez por minuto.
  if (!found.lastUsedAt || Date.now() - found.lastUsedAt.getTime() > 60_000) {
    await db.apiKey.update({ where: { id: found.id }, data: { lastUsedAt: new Date() } })
  }
  return { businessId: found.businessId, keyId: found.id, currency: found.business.currency }
}

/** Envuelve una ruta: autentica, captura errores y nunca filtra detalles internos. */
export function apiRoute<C>(handler: (account: Account, request: Request, ctx: C) => Promise<Response>) {
  return async (request: Request, ctx: C) => {
    try {
      const account = await authenticate(request)
      if (account instanceof Response) return account
      return await handler(account, request, ctx)
    } catch (error) {
      console.error("API v1:", error)
      return errorResponse(500, "error_interno", "Error inesperado. Inténtalo de nuevo en unos segundos.")
    }
  }
}

export function listQuery(request: Request): ListQuery | Response {
  const q = parseListQuery(new URL(request.url).searchParams)
  return "error" in q ? errorResponse(400, "parametro_invalido", q.error) : q
}

const iso = (d: Date) => d.toISOString()
const notFound = (what: string) => errorResponse(404, "no_encontrado", `No existe ${what}.`)

// ─── Cuenta ─────────────────────────────────────────────────────────────────

export async function getAccount(a: Account) {
  const b = await db.business.findUniqueOrThrow({ where: { id: a.businessId }, select: { id: true, name: true, plan: true, planExpiresAt: true, currency: true, timezone: true } })
  const expired = b.planExpiresAt && b.planExpiresAt.getTime() < Date.now()
  return { id: b.id, nombre: b.name, plan: API_PLAN[expired ? "FREE" : b.plan], moneda: b.currency, zona_horaria: b.timezone }
}

// ─── Clientes ───────────────────────────────────────────────────────────────

const customerSelect = { id: true, name: true, email: true, phone: true, createdAt: true, updatedAt: true } as const
type CustomerRow = Prisma.CustomerGetPayload<{ select: typeof customerSelect }>

const customerOut = (c: CustomerRow) => ({
  id: ID.customer(c.id),
  nombre: c.name,
  email: c.email,
  telefono: c.phone,
  empresa: null,
  documento: null,
  ciudad: null,
  creado_en: iso(c.createdAt),
  actualizado_en: iso(c.updatedAt),
})

export async function listCustomers(a: Account, q: ListQuery) {
  const where: Prisma.CustomerWhereInput = { businessId: a.businessId, ...(q.since ? { updatedAt: { gt: q.since } } : {}) }
  const [rows, total] = await Promise.all([
    db.customer.findMany({ where, select: customerSelect, orderBy: [{ updatedAt: "asc" }, { id: "asc" }], skip: (q.page - 1) * q.limit, take: q.limit }),
    db.customer.count({ where }),
  ])
  return { data: rows.map(customerOut), meta: pageMeta(q, total) }
}

export async function getCustomer(a: Account, id: string) {
  const p = parseId(id)
  if (p?.kind === "cli") {
    const c = await db.customer.findFirst({ where: { id: p.raw, businessId: a.businessId }, select: customerSelect })
    return c ? jsonResponse({ data: customerOut(c) }) : notFound(`el cliente ${id}`)
  }
  if (p?.kind === "clc") {
    // Persona de una cotización que no está guardada en Clientes.
    const qt = await db.quote.findFirst({
      where: { id: p.raw, businessId: a.businessId },
      select: { customerName: true, customerEmail: true, customerPhone: true, createdAt: true, updatedAt: true },
    })
    if (!qt) return notFound(`el cliente ${id}`)
    return jsonResponse({
      data: { id, nombre: qt.customerName, email: qt.customerEmail, telefono: qt.customerPhone, empresa: null, documento: null, ciudad: null, creado_en: iso(qt.createdAt), actualizado_en: iso(qt.updatedAt) },
    })
  }
  return notFound(`el cliente ${id}`)
}

// ─── Órdenes (ventas con cliente y cotizaciones) ────────────────────────────

type Item = { producto_id: string | null; nombre: string; cantidad: number; precio_unitario: number; subtotal: number }

const saleSelect = {
  id: true,
  customerId: true,
  total: true,
  discount: true,
  promoDiscount: true,
  note: true,
  createdAt: true,
  updatedAt: true,
  items: { select: { productId: true, description: true, quantity: true, unitPrice: true, subtotal: true }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.SaleSelect
const quoteSelect = {
  id: true,
  number: true,
  customerId: true,
  status: true,
  items: true,
  subtotal: true,
  discount: true,
  total: true,
  note: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.QuoteSelect

function saleOut(s: Prisma.SaleGetPayload<{ select: typeof saleSelect }>, currency: string) {
  const items: Item[] = s.items.map((i) => ({
    producto_id: i.productId ? `prd_${i.productId}` : null,
    nombre: i.description,
    cantidad: i.quantity,
    precio_unitario: i.unitPrice,
    subtotal: i.subtotal,
  }))
  return {
    id: ID.sale(s.id),
    numero: saleNumber(s.id),
    cliente_id: ID.customer(s.customerId!),
    estado: "completada" as OrderState,
    moneda: currency,
    subtotal: items.reduce((t, i) => t + i.subtotal, 0),
    descuento: s.discount + s.promoDiscount,
    total: s.total,
    items,
    notas: s.note ?? "",
    creado_en: iso(s.createdAt),
    actualizado_en: iso(s.updatedAt),
  }
}

function quoteOut(q: Prisma.QuoteGetPayload<{ select: typeof quoteSelect }>, currency: string) {
  const raw = Array.isArray(q.items) ? (q.items as { productId?: string | null; description?: string; quantity?: number; unitPrice?: number }[]) : []
  const items: Item[] = raw.map((i) => {
    const cantidad = Number(i.quantity) || 0
    const precio = Number(i.unitPrice) || 0
    return { producto_id: i.productId ? `prd_${i.productId}` : null, nombre: String(i.description ?? ""), cantidad, precio_unitario: precio, subtotal: Math.round(cantidad * precio) }
  })
  return {
    id: ID.quote(q.id),
    numero: quoteNumberLabel(q.number),
    cliente_id: q.customerId ? ID.customer(q.customerId) : ID.quoteCustomer(q.id),
    estado: QUOTE_STATE[q.status],
    moneda: currency,
    subtotal: q.subtotal,
    descuento: q.discount,
    total: q.total,
    items,
    notas: q.note ?? "",
    creado_en: iso(q.createdAt),
    actualizado_en: iso(q.updatedAt),
  }
}

export async function listOrders(a: Account, q: ListQuery, filters: URLSearchParams): Promise<Response> {
  const estado = filters.get("estado")
  if (estado && !(ORDER_STATES as readonly string[]).includes(estado)) {
    return errorResponse(400, "parametro_invalido", `estado debe ser uno de: ${ORDER_STATES.join(", ")}.`)
  }
  const clienteRaw = filters.get("cliente_id")
  const cliente = clienteRaw ? parseId(clienteRaw) : null
  if (clienteRaw && (!cliente || (cliente.kind !== "cli" && cliente.kind !== "clc"))) return jsonResponse({ data: [], meta: pageMeta(q, 0) })

  const b = a.businessId
  const since = q.since ? Prisma.sql`AND "updatedAt" > ${q.since}` : Prisma.empty
  // Ventas: solo con cliente, sin devoluciones y sin las que salieron de una cotización (esa ya aparece como completada).
  const wantSales = (!estado || estado === "completada") && (!cliente || cliente.kind === "cli")
  const saleCustomer = cliente?.kind === "cli" ? Prisma.sql`AND "customerId" = ${cliente.raw}` : Prisma.empty
  const sales = Prisma.sql`
    SELECT 'v' AS kind, s.id, s."updatedAt" FROM sale s
    WHERE s."businessId" = ${b} AND s."customerId" IS NOT NULL AND s."returnOfId" IS NULL ${since} ${saleCustomer}
      AND NOT EXISTS (SELECT 1 FROM quote q WHERE q."businessId" = ${b} AND q."saleId" = s.id)`
  const statuses = estado ? quoteStatusesFor(estado as OrderState) : null
  const quoteStatus = statuses ? Prisma.sql`AND status::text IN (${Prisma.join(statuses)})` : Prisma.empty
  const quoteCustomer =
    cliente?.kind === "cli" ? Prisma.sql`AND "customerId" = ${cliente.raw}` : cliente?.kind === "clc" ? Prisma.sql`AND id = ${cliente.raw} AND "customerId" IS NULL` : Prisma.empty
  const quotes = Prisma.sql`SELECT 'c' AS kind, id, "updatedAt" FROM quote WHERE "businessId" = ${b} ${since} ${quoteStatus} ${quoteCustomer}`
  const union = wantSales ? Prisma.sql`${sales} UNION ALL ${quotes}` : quotes

  const [page, count] = await Promise.all([
    db.$queryRaw<{ kind: "v" | "c"; id: string }[]>`SELECT kind, id FROM (${union}) t ORDER BY "updatedAt" ASC, id ASC LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`,
    db.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint AS n FROM (${union}) t`,
  ])
  const saleIds = page.filter((r) => r.kind === "v").map((r) => r.id)
  const quoteIds = page.filter((r) => r.kind === "c").map((r) => r.id)
  const [saleRows, quoteRows] = await Promise.all([
    saleIds.length ? db.sale.findMany({ where: { id: { in: saleIds }, businessId: b }, select: saleSelect }) : [],
    quoteIds.length ? db.quote.findMany({ where: { id: { in: quoteIds }, businessId: b }, select: quoteSelect }) : [],
  ])
  const sMap = new Map(saleRows.map((s) => [s.id, s]))
  const qMap = new Map(quoteRows.map((x) => [x.id, x]))
  const data = page.flatMap((r) => {
    if (r.kind === "v") {
      const s = sMap.get(r.id)
      return s ? [saleOut(s, a.currency)] : []
    }
    const x = qMap.get(r.id)
    return x ? [quoteOut(x, a.currency)] : []
  })
  return jsonResponse({ data, meta: pageMeta(q, Number(count[0]?.n ?? 0)) })
}

export async function getOrder(a: Account, id: string) {
  const p = parseId(id)
  if (p?.kind === "ven") {
    const s = await db.sale.findFirst({ where: { id: p.raw, businessId: a.businessId, customerId: { not: null }, returnOfId: null }, select: saleSelect })
    return s ? jsonResponse({ data: saleOut(s, a.currency) }) : notFound(`la orden ${id}`)
  }
  if (p?.kind === "cot") {
    const x = await db.quote.findFirst({ where: { id: p.raw, businessId: a.businessId }, select: quoteSelect })
    return x ? jsonResponse({ data: quoteOut(x, a.currency) }) : notFound(`la orden ${id}`)
  }
  return notFound(`la orden ${id}`)
}

// ─── Productos ──────────────────────────────────────────────────────────────

const productSelect = { id: true, sku: true, name: true, isService: true, price: true, active: true, updatedAt: true } as const
const productOut = (p: Prisma.ProductGetPayload<{ select: typeof productSelect }>, currency: string) => ({
  id: `prd_${p.id}`,
  sku: p.sku ?? "",
  nombre: p.name,
  tipo: p.isService ? "servicio" : "producto",
  precio: p.price,
  moneda: currency,
  activo: p.active,
  actualizado_en: iso(p.updatedAt),
})

export async function listProducts(a: Account, q: ListQuery) {
  const where: Prisma.ProductWhereInput = { businessId: a.businessId, ...(q.since ? { updatedAt: { gt: q.since } } : {}) }
  const [rows, total] = await Promise.all([
    db.product.findMany({ where, select: productSelect, orderBy: [{ updatedAt: "asc" }, { id: "asc" }], skip: (q.page - 1) * q.limit, take: q.limit }),
    db.product.count({ where }),
  ])
  return { data: rows.map((p) => productOut(p, a.currency)), meta: pageMeta(q, total) }
}

export async function getProduct(a: Account, id: string) {
  const p = parseId(id)
  const row = p?.kind === "prd" ? await db.product.findFirst({ where: { id: p.raw, businessId: a.businessId }, select: productSelect }) : null
  return row ? jsonResponse({ data: productOut(row, a.currency) }) : notFound(`el producto ${id}`)
}
