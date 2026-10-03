"use server"

import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { COUNTRIES, DEFAULT_EXPENSE_CATEGORIES } from "@/lib/constants"
import { onboardingSchema, type OnboardingInput } from "@/lib/validations"
import { requireUser } from "@/server/session"
import { toActionError, validationError, type ActionResult } from "@/server/actions/result"

export async function completeOnboarding(input: OnboardingInput): Promise<ActionResult> {
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
  if (existing?.business.onboardingCompleted) redirectToDashboard()

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

    await db.$transaction(async (tx) => {
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
    })
  } catch (error) {
    return toActionError(error)
  }

  redirectToDashboard()
}

function redirectToDashboard(): never {
  redirect("/dashboard?bienvenida=1")
}
