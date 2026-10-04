"use server"

import { randomBytes } from "node:crypto"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { getAppUrl } from "@/lib/app-url"
import { db } from "@/lib/db"
import { sendEmail } from "@/lib/email"
import { invitationEmail } from "@/lib/email-templates"
import { memberLimit, PLANS } from "@/lib/plans"
import { ROLE_LABEL } from "@/lib/roles"
import { assertCan, requireBusiness, requireUser } from "@/server/session"
import { toActionError, validationError, type ActionResult } from "@/server/actions/result"

const INVITATION_DAYS = 7
const teamRole = z.enum(["ADMIN", "EMPLOYEE"])

const inviteSchema = z.object({
  email: z.email("Escribe un correo válido").trim().toLowerCase().max(200),
  role: teamRole,
})

function invitationUrl(token: string) {
  return `${getAppUrl()}/invitacion/${token}`
}

/** Invita a una persona por correo. Devuelve el enlace para compartirlo también por WhatsApp. */
export async function inviteMember(input: z.input<typeof inviteSchema>): Promise<ActionResult<{ url: string }>> {
  const ctx = await requireBusiness()
  const parsed = inviteSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const { email, role } = parsed.data

  try {
    assertCan(ctx, "members:manage")
    const now = new Date()

    const [members, pending, alreadyMember] = await Promise.all([
      db.businessMember.count({ where: { businessId: ctx.businessId } }),
      db.invitation.count({ where: { businessId: ctx.businessId, acceptedAt: null, expiresAt: { gt: now } } }),
      db.businessMember.findFirst({ where: { businessId: ctx.businessId, user: { email } }, select: { id: true } }),
    ])
    if (alreadyMember) return { ok: false, message: "Esa persona ya es parte de tu negocio." }

    // Si ya tenía una invitación pendiente, se reemplaza (no cuenta dos veces).
    const previous = await db.invitation.findFirst({
      where: { businessId: ctx.businessId, email, acceptedAt: null, expiresAt: { gt: now } },
      select: { id: true },
    })
    const limit = memberLimit(ctx.business.plan)
    if (members + pending - (previous ? 1 : 0) >= limit) {
      return {
        ok: false,
        message:
          limit <= 1
            ? `El plan ${PLANS[ctx.business.plan].name} es para una sola persona. Con Pro puedes sumar a tu equipo.`
            : `Tu plan permite hasta ${limit} personas en el negocio (contando invitaciones pendientes).`,
      }
    }

    const token = randomBytes(24).toString("base64url")
    await db.$transaction(async (tx) => {
      if (previous) await tx.invitation.delete({ where: { id: previous.id } })
      await tx.invitation.create({
        data: {
          businessId: ctx.businessId,
          email,
          role,
          token,
          invitedById: ctx.user.id,
          expiresAt: new Date(now.getTime() + INVITATION_DAYS * 86_400_000),
        },
      })
    })

    const url = invitationUrl(token)
    const mail = invitationEmail({
      inviterName: ctx.user.name,
      businessName: ctx.business.name,
      roleLabel: ROLE_LABEL[role],
      url,
    })
    await sendEmail({ to: email, ...mail }).catch((e) => console.error("[team] correo de invitación", e))

    revalidatePath("/dashboard/configuracion")
    return { ok: true, data: { url }, message: `Invitación enviada a ${email}` }
  } catch (error) {
    return toActionError(error)
  }
}

export async function cancelInvitation(id: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  try {
    assertCan(ctx, "members:manage")
    await db.invitation.deleteMany({ where: { id, businessId: ctx.businessId, acceptedAt: null } })
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
    const member = await db.businessMember.findFirst({ where: { id: memberId, businessId: ctx.businessId } })
    if (!member) return { ok: false, message: "No encontramos a esa persona." }
    if (member.role === "OWNER") return { ok: false, message: "No se puede cambiar el rol del dueño." }
    await db.businessMember.update({ where: { id: member.id }, data: { role: parsedRole.data } })
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
    const member = await db.businessMember.findFirst({ where: { id: memberId, businessId: ctx.businessId } })
    if (!member) return { ok: false, message: "No encontramos a esa persona." }
    if (member.role === "OWNER") return { ok: false, message: "No se puede quitar al dueño del negocio." }
    await db.$transaction([
      db.businessMember.delete({ where: { id: member.id } }),
      // Si lo tenía abierto, la próxima vez entra a otro negocio suyo.
      db.user.updateMany({ where: { id: member.userId, activeBusinessId: ctx.businessId }, data: { activeBusinessId: null } }),
    ])
    revalidatePath("/dashboard/configuracion")
    return { ok: true, message: "Ya no tiene acceso a tu negocio" }
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

  await db.$transaction(async (tx) => {
    await tx.businessMember.upsert({
      where: { businessId_userId: { businessId: invitation.businessId, userId: user.id } },
      create: { businessId: invitation.businessId, userId: user.id, role: invitation.role },
      update: {},
    })
    await tx.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } })
    await tx.user.update({ where: { id: user.id }, data: { activeBusinessId: invitation.businessId } })
  })
  redirect("/dashboard")
}
