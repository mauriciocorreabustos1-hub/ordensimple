import "server-only"
import { cache } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { after } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { effectivePlan } from "@/lib/plans"
import { can, type Permission } from "@/lib/roles"

export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() })
})

/** Anota que la persona está usando la app (para el panel de administración). Como máximo cada 5 minutos. */
const touchActivity = cache((userId: string) => {
  after(async () => {
    const now = new Date()
    await db.user
      .updateMany({
        where: { id: userId, OR: [{ lastActiveAt: null }, { lastActiveAt: { lt: new Date(now.getTime() - 5 * 60_000) } }] },
        data: { lastActiveAt: now },
      })
      .catch(() => {})
  })
})

export async function requireUser() {
  const session = await getSession()
  if (!session) redirect("/login")
  touchActivity(session.user.id)
  return session.user
}

/** Negocio activo del usuario con su rol, o null si aún no tiene ninguno. */
export const getActiveMembership = cache(async (userId: string, activeBusinessId?: string | null) => {
  const include = { business: { include: { settings: true } } } as const
  if (activeBusinessId) {
    const m = await db.businessMember.findUnique({
      where: { businessId_userId: { businessId: activeBusinessId, userId } },
      include,
    })
    if (m) return m
  }
  return db.businessMember.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include,
  })
})

export type BusinessContext = Awaited<ReturnType<typeof requireBusiness>>

/**
 * Punto de entrada para toda página o acción del dashboard.
 * Garantiza sesión válida y membresía en el negocio. El businessId nunca viene del cliente.
 */
export async function requireBusiness() {
  const user = await requireUser()
  const membership = await getActiveMembership(user.id, user.activeBusinessId as string | null | undefined)
  if (!membership || !membership.business.onboardingCompleted) redirect("/onboarding")
  const { role } = membership
  // Si el plan venció, todo el sistema lo trata como Gratis (ctx.business.plan ya es el plan vigente).
  const business = { ...membership.business, plan: effectivePlan(membership.business) }
  const settings = business.settings ?? {
    easyMode: false,
    lowStockAlerts: true,
    expiryAlerts: true,
    fiadoDays: 15,
    fiadoReminders: true,
    fiadoReminderKey: null,
    lastFiadoReminderAt: null,
    bookingEnabled: true,
    bookingHours: null,
    bookingSlotMin: 30,
    bookingMinNoticeMin: 60,
    bookingMaxDays: 30,
    noSalesReminder: true,
    weeklySummary: false,
    defaultPayment: "CASH" as const,
    chargesVat: true,
    vatDueDay: 20,
    ppmRate: 0.00125,
    cardFeeDebit: 0,
    cardFeeCredit: 0,
    tableCount: 6,
    tableExtras: ["Para llevar", "Delivery"],
    employeesProductsOnly: true,
    loyaltyEnabled: false,
    ownerSalary: null,
    openingCash: null,
    openingCashAt: null,
  }
  return {
    user,
    role,
    /** Meta del mes y comisión de quien está usando la app (las fija el dueño en Reportes). */
    member: { id: membership.id, monthlyGoal: membership.monthlyGoal, commissionRate: membership.commissionRate },
    business,
    settings,
    businessId: business.id,
    currency: business.currency,
    timezone: business.timezone,
  }
}

export class PermissionError extends Error {
  constructor() {
    super("No tienes permiso para hacer esto. Pídele acceso al dueño del negocio.")
  }
}

/** Para páginas: quien no tiene el permiso vuelve al inicio (el menú ya no le muestra la sección). */
export function requirePermission(ctx: BusinessContext, permission: Permission) {
  if (!can(ctx.role, permission)) redirect("/dashboard")
}

export function assertCan(ctx: BusinessContext, permission: Permission) {
  if (!can(ctx.role, permission)) throw new PermissionError()
}
