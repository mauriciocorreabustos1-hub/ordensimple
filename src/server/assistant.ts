import "server-only"
import { db } from "@/lib/db"
import { formatMoney } from "@/lib/currency"
import { formatDate, startOfDay, zonedParts } from "@/lib/dates"
import { canUseFeature, PLANS } from "@/lib/plans"
import { can } from "@/lib/roles"
import { formatDueDate, ppmAmount, vatDueDate, vatInfo } from "@/lib/vat"
import { isAdminEmail } from "@/server/admin"
import { getDashboardData } from "@/server/queries/dashboard"
import { getDebtors } from "@/server/queries/fiado"
import { getInsights } from "@/server/queries/insights"
import { getInventory } from "@/server/queries/inventory"
import { getYearSummary } from "@/server/queries/results"
import type { requireBusiness } from "@/server/session"

type Ctx = Awaited<ReturnType<typeof requireBusiness>>

/** Modelo de IA (vía Vercel AI Gateway). Rápido y barato: responde dudas y lee números ya calculados. */
export const ASSISTANT_MODEL = process.env.ASSISTANT_MODEL || "anthropic/claude-haiku-4.5"
/** Preguntas por negocio al día. */
export const ASSISTANT_DAILY_LIMIT = Number(process.env.ASSISTANT_DAILY_LIMIT || 40)

/**
 * ¿Ve el asistente? En prueba: solo los administradores de OrdenSimple.
 * Con ASSISTANT_ENABLED=true, todos.
 */
export function assistantEnabledFor(email: string | null | undefined) {
  return process.env.ASSISTANT_ENABLED === "true" || isAdminEmail(email)
}

/** Preguntas que le quedan hoy a un negocio. */
export async function assistantQuestionsLeft(businessId: string, timezone: string) {
  const used = await db.assistantUsage.count({ where: { businessId, createdAt: { gte: startOfDay(new Date(), timezone) } } })
  return Math.max(0, ASSISTANT_DAILY_LIMIT - used)
}

// ─── Lo que sabe de OrdenSimple ────────────────────────────────────────────

const plan = (id: keyof typeof PLANS) => `${PLANS[id].name} (${PLANS[id].priceLabel}${PLANS[id].monthlyPrice ? " al mes" : ""}): ${PLANS[id].highlights.join("; ")}.`

const APP_GUIDE = `
OrdenSimple (ordensimple.cl) es una app chilena para administrar pequeños negocios (almacenes, minimarkets, pymes):
ventas, gastos, fiado, inventario, caja, proveedores, resultados e IVA. Funciona en el celular y en el computador.

Menú y cómo se hace cada cosa:
- Inicio: resumen del día y del mes, "¿Cómo va tu negocio?", lo que te deben (fiado), utilidad, IVA/F29 del mes y consejos.
- Registrar venta: botón verde "+" (abajo en el celular) o "Registrar venta". Pestaña "Con detalle" (por defecto): eliges
  productos o tocas "Escanear productos": la cámara queda abierta y cada producto que pasas se suma solo (bip). Muestra el
  stock que queda. "Venta rápida": solo el monto. Medio de pago: efectivo, débito, crédito, transferencia, otro o fiado
  (para fiar hay que escribir el nombre del cliente).
- Registrar gasto: botón "+" → gasto. Se elige categoría (Arriendo, Luz, Sueldos, Proveedores…). Si el negocio declara
  IVA se marca "Tiene factura con IVA" para descontar su IVA (sueldos, impuestos y honorarios nunca descuentan IVA).
- Productos: crear producto con nombre, costo, precio, stock, mínimo para avisar y fecha de vencimiento. Un producto puede
  tener varios códigos de barras (mismo precio y stock).
- Inventario: stock de cada producto, stock bajo, agotados, valor del inventario, merma y vencidos, lo que no se vende.
  "Consultar producto": escaneas y ves precio, stock, costo, margen y vencimiento. "Registrar movimiento": entrada
  (llegó mercadería), merma (vencido, dañado, robo, consumo propio), salida o ajuste.
- Clientes: lista de clientes, quién debe (fiado), abonos. Botón "Cobrar" abre WhatsApp con un mensaje amable con el monto.
- Cierre de caja: lo vendido en el día por medio de pago, abonos de fiado, gastos; cuadrar el efectivo contado.
- Proveedores (Pro): proveedores, compras y "Pagos pendientes" con aviso por correo el día antes y el día que vence;
  "Pagado" lo anota como gasto (en la fecha de la factura).
- Reportes: ventas y gastos por período, productos más vendidos, descarga en Excel.
- Resultados e IVA (Pro): estado de resultados (ventas sin IVA, costo de venta, utilidad bruta, gastos, utilidad),
  IVA a pagar, PPM y total aproximado del F29, con la fecha de vencimiento (día 20, o 12; se corre si es feriado).
- Sucursales: varios locales, cada uno con su equipo. Equipo: Configuración → Usuarios → "Invitar usuario" (llega un correo;
  el trabajador entra sin crear otro negocio). Rol Empleado: registra ventas, gastos, inventario y clientes; no ve costos ni
  reportes y no puede borrar. Rol Administrador: casi todo.
- Configuración: datos del negocio, IVA (activar/desactivar, día de pago, tasa de PPM), categorías de gastos, avisos por
  correo (resumen semanal los lunes, stock bajo, días sin ventas), modo fácil, tema claro/oscuro, descargar datos.
- Tu plan: ver y cambiar el plan; se paga con tarjeta (sin necesitar cuenta de Mercado Pago) o con cuenta de Mercado Pago;
  se cancela cuando quieras desde ahí. También se puede usar un cupón.
- Herramientas: calculadoras (precio y margen, punto de equilibrio, meta de ganancia, simulador).

Planes:
- ${plan("FREE")}
- ${plan("PRO")}
- ${plan("BUSINESS")}

IVA en Chile (aproximado, la cifra oficial la revisa el contador o el SII): 19% incluido en los precios. IVA a pagar = IVA de las
ventas − IVA de las compras con factura; si sobra, queda a favor para el mes siguiente. El F29 se presenta cada mes (también sin
movimiento) hasta el día 20 si emite documentos electrónicos y declara por internet, si no el 12. El F29 incluye además el PPM
(Pro Pyme General 0,125% de las ventas sin IVA en 2025-2027) y la retención de boletas de honorarios.
`.trim()

// ─── Lo que sabe del negocio (según lo que esa persona puede ver) ──────────

export async function assistantContext(ctx: Ctx) {
  const now = new Date()
  const money = (n: number) => formatMoney(n, ctx.currency)
  const today = zonedParts(now, ctx.timezone)
  const finances = can(ctx.role, "finances:view")
  const plan = ctx.business.plan
  const lines: string[] = [
    `Negocio: ${ctx.business.name}. Plan: ${PLANS[plan].name}. Rol de quien pregunta: ${ctx.role === "OWNER" ? "dueño" : ctx.role === "ADMIN" ? "administrador" : "empleado"}.`,
    `Hoy es ${formatDate(now, ctx.timezone, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.`,
  ]

  const [data, inventory] = await Promise.all([
    getDashboardData(ctx.businessId, ctx.timezone, now),
    canUseFeature(plan, "inventory") ? getInventory(ctx.businessId, ctx.timezone, now) : Promise.resolve(null),
  ])
  lines.push(`Hoy: ventas ${money(data.today.sales)} (${data.today.salesCount} ventas)${finances ? `, gastos ${money(data.today.expenses)}` : ""}.`)

  if (finances) {
    lines.push(
      `Este mes hasta hoy: ventas ${money(data.month.sales)} (${data.month.salesCount} ventas), gastos ${money(data.month.expenses)}, ventas menos gastos ${money(data.month.profit)}.`,
      `Mes pasado hasta el mismo día: ventas ${money(data.prevMonth.sales)}, gastos ${money(data.prevMonth.expenses)}.`,
      `Últimos 30 días: ventas ${money(data.last30.sales)}, gastos ${money(data.last30.expenses)}. 30 días anteriores: ventas ${money(data.prev30.sales)}, gastos ${money(data.prev30.expenses)}.`,
      `Ventas por mes (últimos 6): ${data.months.map((m) => `${m.fullLabel} ${money(m.sales)} (gastos ${money(m.expenses)})`).join("; ")}.`,
    )
  }

  if (canUseFeature(plan, "customers")) {
    const debtors = await getDebtors(ctx.businessId)
    const ids = [...debtors.balances.entries()].filter(([, b]) => b.balance > 0).sort((a, b) => b[1].balance - a[1].balance).slice(0, 8)
    const names = new Map(
      (await db.customer.findMany({ where: { id: { in: ids.map(([id]) => id) } }, select: { id: true, name: true } })).map((c) => [c.id, c.name]),
    )
    lines.push(
      debtors.count
        ? `Fiado: te deben ${money(debtors.total)} entre ${debtors.count} clientes. Los que más deben: ${ids.map(([id, b]) => `${names.get(id) ?? "Cliente"} ${money(b.balance)}${b.lastPayment ? ` (último abono ${formatDate(b.lastPayment, ctx.timezone, { day: "numeric", month: "short" })})` : " (sin abonos)"}`).join("; ")}.`
        : "Fiado: nadie te debe.",
    )
  }

  if (inventory) {
    const list = (items: { name: string; stock: number }[]) => items.slice(0, 10).map((p) => `${p.name} (${p.stock})`).join(", ")
    lines.push(
      `Inventario: ${inventory.items.length} productos con control de stock, ${inventory.units} unidades.${finances ? ` Valor al costo ${money(inventory.value)}.` : ""}`,
      inventory.out.length ? `Agotados: ${list(inventory.out)}.` : "Agotados: ninguno.",
      inventory.low.length ? `Stock bajo (por reponer): ${list(inventory.low)}.` : "Stock bajo: ninguno.",
      inventory.expiring.length ? `Por vencer o vencidos: ${inventory.expiring.slice(0, 8).map((p) => `${p.name} (${formatDate(p.expiresAt, ctx.timezone, { day: "numeric", month: "short" })})`).join(", ")}.` : "",
      inventory.topSellers.length ? `Más vendidos (30 días): ${inventory.topSellers.map((p) => `${p.name} ${p.qty} u.`).join(", ")}.` : "",
      finances && inventory.idle.length ? `Sin ventas en 30 días: ${inventory.idle.slice(0, 6).map((p) => `${p.name} (${money(p.value)} parados)`).join(", ")}.` : "",
      finances && inventory.waste.units ? `Merma del mes: ${inventory.waste.units} unidades, ${money(inventory.waste.cost)} al costo.` : "",
    )
  }

  if (finances && canUseFeature(plan, "tips")) {
    const insights = await getInsights(ctx.businessId, ctx.timezone, ctx.currency, now)
    if (insights.length) lines.push(`Consejos calculados: ${insights.map((i) => i.text).join(" | ")}`)
  }

  const vat = vatInfo(ctx.business.country)
  if (finances && vat && ctx.settings.chargesVat && canUseFeature(plan, "results") && can(ctx.role, "reports:view")) {
    const year = await getYearSummary(ctx.businessId, today.year, today.month, ctx.timezone, vat.rate)
    const m = year.rows[today.month - 1]
    const ppm = ctx.business.country === "CL" ? ppmAmount(m.s.netSales, ctx.settings.ppmRate) : 0
    const due = vatDueDate(today.year, today.month, ctx.settings.vatDueDay, ctx.timezone, ctx.business.country)
    lines.push(
      `Estado de resultados de este mes (sin IVA, aproximado): ventas ${money(m.s.netSales)}, costo de venta ${money(m.s.costOfSales)}, utilidad bruta ${money(m.s.grossProfit)}, gastos ${money(m.s.operatingExpenses + m.s.waste)}, utilidad ${money(m.s.profit)}.`,
      `IVA de este mes (aproximado, puede cambiar hasta fin de mes): IVA ventas ${money(m.s.vat.debit)}, IVA compras con factura ${money(m.s.vat.credit)}, a favor del mes anterior ${money(m.carryIn)}, IVA a pagar ${money(m.vatToPay)}, PPM ${money(ppm)}, total F29 ${money(m.vatToPay + ppm)}. Vence el ${formatDueDate(due, ctx.timezone)}.`,
    )
  } else if (vat && !ctx.settings.chargesVat) {
    lines.push("El negocio tiene el IVA desactivado en Configuración.")
  }

  if (!finances) lines.push("Quien pregunta es empleado: no tiene acceso a ganancias, gastos del negocio, costos ni reportes. No los menciones.")
  return lines.filter(Boolean).join("\n")
}

export function assistantSystemPrompt(context: string) {
  return `Eres el asistente de OrdenSimple. Ayudas a dueños y trabajadores de pequeños negocios en Chile a usar la app y a
entender los números de su negocio.

Cómo respondes:
- En español de Chile, cercano y simple, como le explicarías a un almacenero. Tutea. Frases cortas.
- Respuestas breves: 2 a 6 líneas. Usa listas con "- " solo si ayudan. Puedes destacar con **negrita**. No uses tablas ni títulos.
- Montos en pesos chilenos con punto de miles ($12.500).
- Usa SOLO los datos del negocio que están abajo. Si algo no está, dilo y explica dónde verlo en la app. Nunca inventes cifras,
  nombres de clientes ni productos.
- Para explicar cómo hacer algo, di exactamente qué tocar en el menú de la app.
- No puedes hacer acciones (registrar, borrar, enviar): solo explicas cómo hacerlo.
- Impuestos: da la cifra aproximada de la app y recuerda que la oficial la confirma el contador o el SII. No des asesoría
  legal ni de inversiones.
- Si te preguntan algo que no tiene que ver con el negocio o con OrdenSimple, responde amable en una línea que solo ayudas con eso.
- Si hay un problema técnico o algo que no sabes, sugiere escribir a contacto@ordensimple.cl.

GUÍA DE ORDENSIMPLE
${APP_GUIDE}

DATOS DEL NEGOCIO (ahora)
${context}`
}

/** Para el resumen del inicio: cuántas preguntas se usaron hoy (sin texto). */
export async function recordAssistantUsage(businessId: string, userId: string, usage: { inputTokens?: number; outputTokens?: number }) {
  await db.assistantUsage.create({
    data: { businessId, userId, inputTokens: usage.inputTokens ?? 0, outputTokens: usage.outputTokens ?? 0 },
  })
}

export const ASSISTANT_SUGGESTIONS_OWNER = ["¿Cómo me fue este mes?", "¿Quién me debe más?", "¿Qué tengo que reponer?", "¿Cuánto IVA voy a pagar?"]
export const ASSISTANT_SUGGESTIONS_STAFF = ["¿Cómo registro una venta?", "¿Qué productos están por acabarse?", "¿Cómo anoto un producto vencido?", "¿Cómo cobro un fiado?"]
export const assistantSuggestions = (ctx: Ctx) => (can(ctx.role, "finances:view") ? ASSISTANT_SUGGESTIONS_OWNER : ASSISTANT_SUGGESTIONS_STAFF)
