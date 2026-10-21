"use server"

import { after } from "next/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import type { AppointmentStatus } from "@/generated/prisma/enums"
import { db } from "@/lib/db"
import { clockOf, hhmm } from "@/lib/agenda"
import { formatDate, zonedTimeToUtc } from "@/lib/dates"
import { canUseFeature } from "@/lib/plans"
import { canApproveDiscounts } from "@/lib/roles"
import { appointmentSchema, idSchema, paymentMethod as paymentMethodSchema, type AppointmentInput } from "@/lib/validations"
import { sendPush } from "@/server/push"
import { applyStock, buildLines, FIADO_PRO, fiadoBlocked, lineData, resolveCustomer, type Tx } from "@/server/sale-core"
import { assertCan, requireBusiness, type BusinessContext } from "@/server/session"
import { toActionError, validationError, type ActionResult } from "@/server/actions/result"

const PRO_ONLY = "La Agenda es parte del plan Pro."
const CHANGED = "Esta cita cambió (otra persona la cobró o la editó). Recarga la página."
/** Las citas canceladas o en que el cliente no vino no ocupan la hora. */
const FREE: AppointmentStatus[] = ["CANCELLED", "NO_SHOW"]

function revalidate() {
  revalidatePath("/dashboard/agenda")
  revalidatePath("/dashboard")
}

function blocked(ctx: BusinessContext) {
  return canUseFeature(ctx.business.plan, "agenda") ? null : PRO_ONLY
}

/** Una persona a la vez agenda en el negocio: así dos citas no toman la misma hora por llegar juntas. */
async function lockAgenda(tx: Tx, businessId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"agenda:" + businessId}))`
}

/** Revisa la cita y la deja lista para guardar (horas en UTC, servicio y profesional del negocio). */
async function prepare(ctx: BusinessContext, input: AppointmentInput) {
  const parsed = appointmentSchema.safeParse(input)
  if (!parsed.success) return { error: validationError(parsed.error) }
  const d = parsed.data
  const [y, m, day] = d.date.split("-").map(Number)
  const [hh, mm] = d.time.split(":").map(Number)
  const startAt = zonedTimeToUtc(y, m, day, ctx.timezone, hh, mm)
  const endAt = new Date(startAt.getTime() + d.durationMin * 60_000)

  if (d.staffId) {
    const member = await db.businessMember.findFirst({ where: { businessId: ctx.businessId, userId: d.staffId }, select: { id: true } })
    if (!member) return { error: { ok: false, message: "Esa persona no es parte de tu equipo." } as ActionResult<never> }
  }
  const product = d.productId
    ? await db.product.findFirst({ where: { id: d.productId, businessId: ctx.businessId }, select: { id: true, price: true } })
    : null
  if (d.productId && !product) return { error: { ok: false, message: "Ese servicio ya no existe. Recarga la página." } as ActionResult<never> }
  // Los empleados con "solo productos guardados" no inventan servicios ni bajan el precio (eso pasa por un descuento al cobrar).
  if (!canApproveDiscounts(ctx.role) && ctx.settings.employeesProductsOnly) {
    if (!product) return { error: { ok: false, message: "Elige un servicio de tu lista." } as ActionResult<never> }
    if (d.price < product.price) return { error: { ok: false, message: "No puedes agendar con un precio menor al de la lista." } as ActionResult<never> }
  }
  return { data: { ...d, productId: product?.id ?? null, startAt, endAt } }
}

/** Si el profesional ya tiene otra cita a esa hora, dice con quién. */
async function clash(tx: Tx, businessId: string, staffId: string | undefined, startAt: Date, endAt: Date, except?: string) {
  if (!staffId) return null
  const other = await tx.appointment.findFirst({
    where: {
      businessId,
      staffId,
      status: { notIn: FREE },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
      ...(except ? { id: { not: except } } : {}),
    },
    select: { customerName: true, startAt: true, endAt: true, staff: { select: { name: true } } },
  })
  return other
}

function clashMessage(other: { customerName: string; startAt: Date; endAt: Date; staff: { name: string } | null }, tz: string) {
  const who = other.staff?.name.split(" ")[0] ?? "Esa persona"
  const at = (d: Date) => {
    const c = clockOf(d, tz)
    return hhmm(c.hour * 60 + c.minute)
  }
  return `${who} ya tiene una cita de ${at(other.startAt)} a ${at(other.endAt)} (${other.customerName}). Elige otra hora u otra persona.`
}

export async function createAppointment(input: AppointmentInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireBusiness()
  try {
    assertCan(ctx, "sales:create")
    const reason = blocked(ctx)
    if (reason) return { ok: false, message: reason }
    const p = await prepare(ctx, input)
    if (p.error) return p.error
    const d = p.data
    const result = await db.$transaction(async (tx) => {
      await lockAgenda(tx, ctx.businessId)
      const other = await clash(tx, ctx.businessId, d.staffId, d.startAt, d.endAt)
      if (other) return { other }
      const customerId = await resolveCustomer(tx, ctx.businessId, d.customerName)
      if (customerId && d.customerPhone) await tx.customer.updateMany({ where: { id: customerId, phone: null }, data: { phone: d.customerPhone } })
      const a = await tx.appointment.create({
        data: {
          businessId: ctx.businessId,
          customerId,
          customerName: d.customerName,
          customerPhone: d.customerPhone ?? null,
          productId: d.productId,
          serviceName: d.serviceName,
          price: d.price,
          staffId: d.staffId ?? null,
          startAt: d.startAt,
          endAt: d.endAt,
          note: d.note ?? null,
          createdById: ctx.user.id,
        },
        select: { id: true },
      })
      return { id: a.id }
    })
    if ("other" in result && result.other) return { ok: false, message: clashMessage(result.other, ctx.timezone) }
    // Aviso al celular de quien atiende, si la agendó otra persona.
    if (d.staffId && d.staffId !== ctx.user.id) {
      const staffId = d.staffId
      const tz = ctx.timezone
      after(() =>
        sendPush([staffId], {
          title: `📅 Nueva cita: ${d.customerName}`,
          body: `${formatDate(d.startAt, tz, { weekday: "long", day: "numeric", month: "short" })} a las ${hhmm(clockOf(d.startAt, tz).hour * 60 + clockOf(d.startAt, tz).minute)} · ${d.serviceName}`,
          url: `/dashboard/agenda?dia=${d.date}`,
          tag: `cita-${"id" in result ? result.id : ""}`,
        }),
      )
    }
    revalidate()
    return { ok: true, message: "Cita agendada", data: { id: "id" in result ? result.id! : "" } }
  } catch (error) {
    return toActionError(error)
  }
}

export async function updateAppointment(id: string, input: AppointmentInput): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Cita no encontrada" }
  try {
    assertCan(ctx, "sales:create")
    const reason = blocked(ctx)
    if (reason) return { ok: false, message: reason }
    const p = await prepare(ctx, input)
    if (p.error) return p.error
    const d = p.data
    const result = await db.$transaction(async (tx) => {
      await lockAgenda(tx, ctx.businessId)
      const current = await tx.appointment.findFirst({ where: { id, businessId: ctx.businessId }, select: { saleId: true } })
      if (!current) return { message: "Cita no encontrada" }
      if (current.saleId) return { message: "Esta cita ya se cobró: no se puede cambiar." }
      const other = await clash(tx, ctx.businessId, d.staffId, d.startAt, d.endAt, id)
      if (other) return { message: clashMessage(other, ctx.timezone) }
      const customerId = await resolveCustomer(tx, ctx.businessId, d.customerName)
      await tx.appointment.update({
        where: { id },
        data: {
          customerId,
          customerName: d.customerName,
          customerPhone: d.customerPhone ?? null,
          productId: d.productId,
          serviceName: d.serviceName,
          price: d.price,
          staffId: d.staffId ?? null,
          startAt: d.startAt,
          endAt: d.endAt,
          note: d.note ?? null,
        },
      })
      return null
    })
    if (result) return { ok: false, message: result.message }
  } catch (error) {
    return toActionError(error)
  }
  revalidate()
  return { ok: true, message: "Cita actualizada" }
}

const statusSchema = z.enum(["SCHEDULED", "CONFIRMED", "ARRIVED", "NO_SHOW", "CANCELLED"])
const STATUS_MESSAGE: Record<z.infer<typeof statusSchema>, string> = {
  SCHEDULED: "Cita agendada",
  CONFIRMED: "Cita confirmada",
  ARRIVED: "Llegó el cliente",
  NO_SHOW: "Marcada: no vino",
  CANCELLED: "Cita cancelada",
}

/** Confirmada, llegó, no vino, cancelada… (las cobradas ya no cambian). */
export async function setAppointmentStatus(id: string, status: z.input<typeof statusSchema>): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsed = statusSchema.safeParse(status)
  if (!idSchema.safeParse(id).success || !parsed.success) return { ok: false, message: "Cita no encontrada" }
  try {
    assertCan(ctx, "sales:create")
    const reason = blocked(ctx)
    if (reason) return { ok: false, message: reason }
    const result = await db.$transaction(async (tx) => {
      await lockAgenda(tx, ctx.businessId)
      const a = await tx.appointment.findFirst({
        where: { id, businessId: ctx.businessId, saleId: null },
        select: { staffId: true, startAt: true, endAt: true, status: true },
      })
      if (!a) return CHANGED
      // Si vuelve a ocupar la hora (por ejemplo, se "des-cancela"), no puede chocar con otra.
      if (FREE.includes(a.status) && !FREE.includes(parsed.data)) {
        const other = await clash(tx, ctx.businessId, a.staffId ?? undefined, a.startAt, a.endAt, id)
        if (other) return clashMessage(other, ctx.timezone)
      }
      await tx.appointment.update({ where: { id }, data: { status: parsed.data } })
      return null
    })
    if (result) return { ok: false, message: result }
  } catch (error) {
    return toActionError(error)
  }
  revalidate()
  return { ok: true, message: STATUS_MESSAGE[parsed.data] }
}

/** Anota que se le mandó el recordatorio por WhatsApp (para mostrarlo en la cita). */
export async function markAppointmentReminded(id: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Cita no encontrada" }
  try {
    assertCan(ctx, "sales:create")
    await db.appointment.updateMany({ where: { id, businessId: ctx.businessId }, data: { remindedAt: new Date() } })
  } catch (error) {
    return toActionError(error)
  }
  revalidate()
  return { ok: true }
}

/**
 * Cobra la cita: crea una venta normal (suma a la caja, los reportes y la comisión de quien atendió) y la marca como atendida.
 * La venta queda a nombre de quien atendió, para que su meta y su comisión cuenten.
 */
export async function chargeAppointment(id: string, payment: z.input<typeof paymentMethodSchema>): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const pm = paymentMethodSchema.safeParse(payment)
  if (!idSchema.safeParse(id).success || !pm.success) return { ok: false, message: "Cita no encontrada" }
  try {
    assertCan(ctx, "sales:create")
    const reason = blocked(ctx)
    if (reason) return { ok: false, message: reason }
    if (fiadoBlocked(ctx, pm.data)) return { ok: false, message: FIADO_PRO }
    const a = await db.appointment.findFirst({ where: { id, businessId: ctx.businessId, saleId: null } })
    if (!a) return { ok: false, message: CHANGED }
    if (a.status === "CANCELLED") return { ok: false, message: "Esta cita está cancelada." }
    if (a.price <= 0) return { ok: false, message: "La cita no tiene precio: edítala y ponle el valor del servicio." }
    if (pm.data === "FIADO" && !a.customerId) return { ok: false, message: "Para fiar, la cita debe tener cliente." }
    const lines = await buildLines(ctx, [{ productId: a.productId ?? undefined, description: a.serviceName, quantity: 1, unitPrice: a.price }])
    if (!lines) return { ok: false, message: "El servicio ya no existe. Edita la cita y vuelve a cobrar." }
    // Si quien atendió ya no es del negocio, la venta queda a nombre de quien cobra.
    const seller = a.staffId && (await db.businessMember.findFirst({ where: { businessId: ctx.businessId, userId: a.staffId }, select: { id: true } })) ? a.staffId : ctx.user.id
    await db.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          businessId: ctx.businessId,
          total: a.price,
          paymentMethod: pm.data,
          note: `Cita: ${a.serviceName}`.slice(0, 200),
          customerId: a.customerId,
          createdById: seller,
          items: { create: lines.map(lineData) },
        },
      })
      await applyStock(tx, ctx, sale.id, lines, `Cita (${a.customerName})`.slice(0, 120))
      // Solo si nadie la cobró entretanto.
      const done = await tx.appointment.updateMany({ where: { id, saleId: null }, data: { saleId: sale.id, status: "DONE" } })
      if (done.count !== 1) throw new Error("APPOINTMENT_CHARGED")
    })
  } catch (error) {
    if (error instanceof Error && error.message === "APPOINTMENT_CHARGED") return { ok: false, message: CHANGED }
    return toActionError(error)
  }
  revalidate()
  revalidatePath("/dashboard/ventas")
  return { ok: true, message: "Cita cobrada" }
}
