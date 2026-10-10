"use server"

import { redirect } from "next/navigation"
import { BILLING_ENABLED, checkoutPath, parsePlanChoice } from "@/lib/plans"
import { db } from "@/lib/db"
import { COUNTRIES, DEFAULT_EXPENSE_CATEGORIES } from "@/lib/constants"
import { onboardingSchema, type OnboardingInput } from "@/lib/validations"
import { requireUser } from "@/server/session"
import { recordReferral } from "@/server/referrals"
import { toActionError, validationError, type ActionResult } from "@/server/actions/result"

export async function completeOnboarding(input: OnboardingInput, planChoice?: string): Promise<ActionResult> {
  // Si eligió Pro o Empresa en precios, al terminar va directo a pagarlo.
  const choice = BILLING_ENABLED ? parsePlanChoice(planChoice) : null
  const finish = (): never => (choice ? redirect(checkoutPath(choice)) : redirectToDashboard())
  const user = await requireUser()
  const parsed = onboardingSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const data = parsed.data
  const timezone = COUNTRIES.find((c) => c.code === data.country)?.timezone ?? "America/Santiago"

  const existing = await db.businessMember.findFirst({
    where: { userId: user.id, role: "OWNER" },
    include: { business: true },
    orderBy: { createdAt: "asc" },
  })

  // Plan gratis: un negocio. Si ya terminó el onboarding, no se crea otro.
  if (existing?.business.onboardingCompleted) return finish()

  let businessId: string
  try {
    const businessData = {
      name: data.name,
      type: data.type ?? null,
      country: data.country,
      currency: data.currency,
      timezone,
      hasProducts: data.hasProducts ?? null,
      hasEmployees: data.hasEmployees ?? null,
      managesInventory: data.managesInventory ?? null,
      monthlyRevenueRange: data.monthlyRevenueRange ?? null,
      onboardingCompleted: true,
    }

    businessId = await db.$transaction(async (tx) => {
      const business = existing
        ? await tx.business.update({ where: { id: existing.businessId }, data: businessData })
        : await tx.business.create({
            data: {
              ...businessData,
              members: { create: { userId: user.id, role: "OWNER" } },
            },
          })

      await tx.businessSettings.upsert({
        where: { businessId: business.id },
        create: { businessId: business.id },
        update: {},
      })

      await tx.expenseCategory.createMany({
        data: DEFAULT_EXPENSE_CATEGORIES.map((c) => ({
          businessId: business.id,
          name: c.name,
          icon: c.icon,
          isDefault: true,
          isVariable: c.isVariable ?? false,
        })),
        skipDuplicates: true,
      })

      await tx.user.update({ where: { id: user.id }, data: { activeBusinessId: business.id } })
      return business.id
    })
  } catch (error) {
    return toActionError(error)
  }
  // "Invita a un amigo": si llegó con un enlace, recibe sus días de regalo.
  await recordReferral({ userId: user.id, businessId })

  return finish()
}

function redirectToDashboard(): never {
  redirect("/dashboard?bienvenida=1")
}
