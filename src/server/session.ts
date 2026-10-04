import "server-only"
import { cache } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { effectivePlan } from "@/lib/plans"
import { can, type Permission } from "@/lib/roles"

export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() })
})

export async function requireUser() {
  const session = await getSession()
  if (!session) redirect("/login")
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
    noSalesReminder: true,
    weeklySummary: false,
    defaultPayment: "CASH" as const,
  }
  return {
    user,
    role,
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

export function assertCan(ctx: BusinessContext, permission: Permission) {
  if (!can(ctx.role, permission)) throw new PermissionError()
}
