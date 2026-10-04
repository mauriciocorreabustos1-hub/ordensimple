"use server"

import { randomBytes } from "node:crypto"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { getAppUrl } from "@/lib/app-url"
import { db } from "@/lib/db"
import { sendEmail } from "@/lib/email"
import { invitationEmail } from "@/lib/email-templates"
import { effectivePlan, memberLimit, PLANS } from "@/lib/plans"
import { ROLE_LABEL } from "@/lib/roles"
import { assertCan, requireBusiness, requireUser } from "@/server/session"
import { toActionError, validationError, type ActionResult } from "@/server/actions/result"

const INVITATION_DAYS = 7
const teamRole = z.enum(["ADMIN", "EMPLOYEE"])

const inviteSchema = z.object({
  email: z.email("Escribe un correo válido").trim().toLowerCase().max(200),
  role: teamRole,
  /** Sucursales a las que podrá entrar. Si no se indican, solo la sucursal actual. */
  businessIds: z.array(z.string().min(1)).max(20).optional(),
})

function invitationUrl(token: string) {
  return `${getAppUrl()}/invitacion/${token}`
}

/** Sucursales de las que la persona es dueña (solo en esas puede invitar o dar acceso). */
async function ownedBusinesses(userId: string) {
  const owned = await db.businessMember.findMany({
    where: { userId, role: "OWNER" },
    select: { business: { select: { id: true, name: true, plan: true, planExpiresAt: true } } },
    orderBy: { createdAt: "asc" },
  })
  return owned.map((o) => o.business)
}

/**
 * Invita a una persona eligiendo a qué sucursales podrá entrar. Se crea una invitación por sucursal,
 * todas con el mismo lote: con un solo enlace (y un solo correo) entra a todas.
 */
export async function inviteMember(input: z.input<typeof inviteSchema>): Promise<ActionResult<{ url: string }>> {
  const ctx = await requireBusiness()
  const parsed = inviteSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const { email, role } = parsed.data

  try {
    assertCan(ctx, "members:manage")
    const now = new Date()
    const owned = await ownedBusinesses(ctx.user.id)
    const wanted = new Set(parsed.data.businessIds?.length ? parsed.data.businessIds : [ctx.businessId])
    const targets = owned.filter((b) => wanted.has(b.id))
    if (targets.length === 0 || targets.length !== wanted.size) {
      return { ok: false, message: "Elige al menos una sucursal tuya." }
    }

    for (const b of targets) {
      const [members, pending, alreadyMember, previous] = await Promise.all([
        db.businessMember.count({ where: { businessId: b.id } }),
        db.invitation.count({ where: { businessId: b.id, acceptedAt: null, expiresAt: { gt: now } } }),
        db.businessMember.findFirst({ where: { businessId: b.id, user: { email } }, select: { id: true } }),
        db.invitation.findFirst({ where: { businessId: b.id, email, acceptedAt: null, expiresAt: { gt: now } }, select: { id: true } }),
      ])
      if (alreadyMember) return { ok: false, message: `Esa persona ya tiene acceso a ${b.name}.` }
      const limit = memberLimit(effectivePlan(b))
      if (members + pending - (previous ? 1 : 0) >= limit) {
        return {
          ok: false,
          message:
            limit <= 1
              ? `El plan ${PLANS[effectivePlan(b)].name} es para una sola persona. Con Pro puedes sumar a tu equipo.`
              : `En ${b.name} tu plan permite hasta ${limit - 1} trabajadores (contando invitaciones pendientes).`,
        }
      }
    }

    const batchId = randomBytes(12).toString("base64url")
    const tokens: string[] = []
    await db.$transaction(async (tx) => {
      // Si ya tenía invitaciones pendientes en esas sucursales, se reemplazan.
      await tx.invitation.deleteMany({
        where: { email, acceptedAt: null, businessId: { in: targets.map((b) => b.id) } },
      })
      for (const b of targets) {
        const token = randomBytes(24).toString("base64url")
        tokens.push(token)
        await tx.invitation.create({
          data: {
            businessId: b.id,
            email,
            role,
            token,
            batchId,
            invitedById: ctx.user.id,
            expiresAt: new Date(now.getTime() + INVITATION_DAYS * 86_400_000),
          },
        })
      }
    })

    const url = invitationUrl(tokens[0])
    const mail = invitationEmail({
      inviterName: ctx.user.name,
      businessName: targets.map((b) => b.name).join(", "),
      roleLabel: ROLE_LABEL[role],
      url,
    })
    await sendEmail({ to: email, ...mail }).catch((e) => console.error("[team] correo de invitación", e))

    revalidatePath("/dashboard/configuracion")
    return {
      ok: true,
      data: { url },
      message: targets.length > 1 ? `Invitación enviada a ${email} para ${targets.length} sucursales` : `Invitación enviada a ${email}`,
    }
  } catch (error) {
    return toActionError(error)
  }
}

const branchesSchema = z.object({
  userId: z.string().min(1),
  businessIds: z.array(z.string().min(1)).max(20),
})

/**
 * El dueño decide a qué sucursales puede entrar una persona de su equipo.
 * Se agregan los accesos marcados (con el mismo rol que ya tiene) y se quitan los desmarcados.
 */
export async function setMemberBranches(input: z.input<typeof branchesSchema>): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsed = branchesSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: "Datos inválidos." }
  const { userId, businessIds } = parsed.data

  try {
    assertCan(ctx, "members:manage")
    if (userId === ctx.user.id) return { ok: false, message: "No puedes cambiar tus propias sucursales." }
    const owned = await ownedBusinesses(ctx.user.id)
    const ownedIds = new Set(owned.map((b) => b.id))
    if (businessIds.some((id) => !ownedIds.has(id))) return { ok: false, message: "Solo puedes dar acceso a tus sucursales." }

    const current = await db.businessMember.findMany({
      where: { userId, businessId: { in: [...ownedIds] } },
      select: { id: true, businessId: true, role: true },
    })
    if (current.length === 0) return { ok: false, message: "Esa persona no es parte de tu equipo." }
    if (current.some((m) => m.role === "OWNER")) return { ok: false, message: "No se pueden cambiar las sucursales de un dueño." }
    if (businessIds.length === 0) return { ok: false, message: "Marca al menos una sucursal. Para quitarle todo el acceso usa “Quitar del negocio”." }

    const role = current.find((m) => m.businessId === ctx.businessId)?.role ?? current[0].role
    const toAdd = businessIds.filter((id) => !current.some((m) => m.businessId === id))
    const toRemove = current.filter((m) => !businessIds.includes(m.businessId))

    for (const id of toAdd) {
      const b = owned.find((x) => x.id === id)!
      const members = await db.businessMember.count({ where: { businessId: id } })
      const limit = memberLimit(effectivePlan(b))
      if (members >= limit) return { ok: false, message: `${b.name} ya tiene el máximo de trabajadores de tu plan.` }
    }

    await db.$transaction([
      ...toAdd.map((businessId) => db.businessMember.create({ data: { businessId, userId, role } })),
      db.businessMember.deleteMany({ where: { id: { in: toRemove.map((m) => m.id) } } }),
      // Si tenía abierta una sucursal que se le quitó, entrará a otra de las suyas.
      db.user.updateMany({ where: { id: userId, activeBusinessId: { in: toRemove.map((m) => m.businessId) } }, data: { activeBusinessId: null } }),
    ])

    revalidatePath("/dashboard/configuracion")
    revalidatePath("/dashboard/sucursales")
    return { ok: true, message: "Sucursales actualizadas" }
  } catch (error) {
    return toActionError(error)
  }
}

export async function cancelInvitation(id: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  try {
    assertCan(ctx, "members:manage")
    const ownedIds = (await ownedBusinesses(ctx.user.id)).map((b) => b.id)
    await db.invitation.deleteMany({ where: { id, businessId: { in: ownedIds }, acceptedAt: null } })
    revalidatePath("/dashboard/configuracion")
    return { ok: true, message: "Invitación cancelada" }
  } catch (error) {
    return toActionError(error)
  }
}

export async function changeMemberRole(memberId: string, role: z.input<typeof teamRole>): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsedRole = teamRole.safeParse(role)
  if (!parsedRole.success) return { ok: false, message: "Rol no válido." }
  try {
    assertCan(ctx, "members:manage")
    const ownedIds = (await ownedBusinesses(ctx.user.id)).map((b) => b.id)
    const member = await db.businessMember.findFirst({ where: { id: memberId, businessId: { in: ownedIds } } })
    if (!member) return { ok: false, message: "No encontramos a esa persona." }
    if (member.role === "OWNER") return { ok: false, message: "No se puede cambiar el rol del dueño." }
    // El rol es el mismo en todas las sucursales del dueño a las que entra.
    await db.businessMember.updateMany({
      where: { userId: member.userId, businessId: { in: ownedIds }, role: { not: "OWNER" } },
      data: { role: parsedRole.data },
    })
    revalidatePath("/dashboard/configuracion")
    return { ok: true, message: `Ahora es ${ROLE_LABEL[parsedRole.data]}` }
  } catch (error) {
    return toActionError(error)
  }
}

export async function removeMember(memberId: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  try {
    assertCan(ctx, "members:manage")
    const ownedIds = (await ownedBusinesses(ctx.user.id)).map((b) => b.id)
    const member = await db.businessMember.findFirst({ where: { id: memberId, businessId: { in: ownedIds } } })
    if (!member) return { ok: false, message: "No encontramos a esa persona." }
    if (member.role === "OWNER") return { ok: false, message: "No se puede quitar al dueño del negocio." }
    // Se quita de todas las sucursales del dueño (para quitar solo de algunas está "Cambiar sucursales").
    await db.$transaction([
      db.businessMember.deleteMany({ where: { userId: member.userId, businessId: { in: ownedIds }, role: { not: "OWNER" } } }),
      // Si tenía abierta una de esas sucursales, la próxima vez entra a otro negocio suyo.
      db.user.updateMany({ where: { id: member.userId, activeBusinessId: { in: ownedIds } }, data: { activeBusinessId: null } }),
    ])
    revalidatePath("/dashboard/configuracion")
    return { ok: true, message: "Ya no tiene acceso a tus sucursales" }
  } catch (error) {
    return toActionError(error)
  }
}

/** Un administrador o empleado deja el negocio en el que está. */
export async function leaveBusiness(): Promise<ActionResult> {
  const ctx = await requireBusiness()
  if (ctx.role === "OWNER") return { ok: false, message: "El dueño no puede salir de su propio negocio." }
  await db.$transaction([
    db.businessMember.deleteMany({ where: { businessId: ctx.businessId, userId: ctx.user.id } }),
    db.user.update({ where: { id: ctx.user.id }, data: { activeBusinessId: null } }),
  ])
  redirect("/dashboard")
}

/** Cambia el negocio que se muestra (para quien pertenece a más de uno). */
export async function switchBusiness(businessId: string): Promise<ActionResult> {
  const user = await requireUser()
  const member = await db.businessMember.findUnique({
    where: { businessId_userId: { businessId, userId: user.id } },
    select: { business: { select: { name: true } } },
  })
  if (!member) return { ok: false, message: "No tienes acceso a ese negocio." }
  await db.user.update({ where: { id: user.id }, data: { activeBusinessId: businessId } })
  revalidatePath("/dashboard", "layout")
  return { ok: true, message: `Estás en ${member.business.name}` }
}

/** Botón "Unirme" de la página /invitacion/[token]. */
export async function acceptInvitation(token: string): Promise<ActionResult> {
  const user = await requireUser()
  const invitation = await db.invitation.findUnique({ where: { token } })
  if (!invitation || invitation.acceptedAt || invitation.expiresAt <= new Date()) {
    return { ok: false, message: "Esta invitación ya no es válida. Pide una nueva." }
  }
  if (invitation.email !== user.email.toLowerCase()) {
    return { ok: false, message: `Esta invitación es para ${invitation.email}. Entra con ese correo.` }
  }

  // Las invitaciones enviadas juntas (varias sucursales) se aceptan todas con este enlace.
  const batch = invitation.batchId
    ? await db.invitation.findMany({
        where: { batchId: invitation.batchId, email: invitation.email, acceptedAt: null, expiresAt: { gt: new Date() } },
      })
    : [invitation]

  await db.$transaction(async (tx) => {
    for (const inv of batch) {
      await tx.businessMember.upsert({
        where: { businessId_userId: { businessId: inv.businessId, userId: user.id } },
        create: { businessId: inv.businessId, userId: user.id, role: inv.role },
        update: {},
      })
      await tx.invitation.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } })
    }
    await tx.user.update({ where: { id: user.id }, data: { activeBusinessId: invitation.businessId } })
  })
  redirect("/dashboard")
}
