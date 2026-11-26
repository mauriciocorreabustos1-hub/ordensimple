"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { canUseFeature } from "@/lib/plans"
import { customerSchema, idSchema, supplierSchema, type CustomerInput, type SupplierInput } from "@/lib/validations"
import { assertCan, requireBusiness } from "@/server/session"
import { toActionError, validationError, type ActionResult } from "@/server/actions/result"
import { notifyIntegrations } from "@/server/webhooks"
import { ID } from "@/lib/api-v1"

// ─── Clientes ───────────────────────────────────────────────────────────────

export async function saveCustomer(id: string | null, input: CustomerInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireBusiness()
  const parsed = customerSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const data = {
    name: parsed.data.name,
    phone: parsed.data.phone ?? null,
    email: parsed.data.email ?? null,
    notes: parsed.data.notes ?? null,
  }

  try {
    assertCan(ctx, "customers:manage")
    if (!canUseFeature(ctx.business.plan, "customers")) return { ok: false, message: "Clientes es parte del plan Pro." }

    let customerId: string
    if (id) {
      const parsedId = idSchema.safeParse(id)
      if (!parsedId.success) return { ok: false, message: "Cliente no encontrado." }
      const { count } = await db.customer.updateMany({ where: { id: parsedId.data, businessId: ctx.businessId }, data })
      if (count === 0) return { ok: false, message: "Cliente no encontrado." }
      customerId = parsedId.data
    } else {
      customerId = (await db.customer.create({ data: { ...data, businessId: ctx.businessId } })).id
    }
    revalidatePath("/dashboard", "layout")
    notifyIntegrations(ctx.businessId, id ? "cliente.actualizado" : "cliente.creado", ID.customer(customerId))
    return { ok: true, message: id ? "Cliente actualizado" : "Cliente creado", data: { id: customerId } }
  } catch (error) {
    return toActionError(error)
  }
}

export async function deleteCustomer(id: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return { ok: false, message: "Cliente no encontrado." }

  try {
    assertCan(ctx, "customers:manage")
    // Las ventas se conservan; solo pierden el vínculo con el cliente.
    const { count } = await db.customer.deleteMany({ where: { id: parsedId.data, businessId: ctx.businessId } })
    if (count === 0) return { ok: false, message: "Cliente no encontrado." }
  } catch (error) {
    return toActionError(error)
  }
  revalidatePath("/dashboard", "layout")
  return { ok: true, message: "Cliente eliminado" }
}

// ─── Proveedores ────────────────────────────────────────────────────────────

export async function saveSupplier(id: string | null, input: SupplierInput): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsed = supplierSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const data = {
    name: parsed.data.name,
    phone: parsed.data.phone ?? null,
    email: parsed.data.email ?? null,
    products: parsed.data.products ?? null,
    deliveryCost: parsed.data.deliveryCost ?? null,
    notes: parsed.data.notes ?? null,
  }

  try {
    assertCan(ctx, "suppliers:manage")
    if (!canUseFeature(ctx.business.plan, "suppliers")) return { ok: false, message: "Proveedores es parte del plan Pro." }

    if (id) {
      const parsedId = idSchema.safeParse(id)
      if (!parsedId.success) return { ok: false, message: "Proveedor no encontrado." }
      const { count } = await db.supplier.updateMany({ where: { id: parsedId.data, businessId: ctx.businessId }, data })
      if (count === 0) return { ok: false, message: "Proveedor no encontrado." }
    } else {
      await db.supplier.create({ data: { ...data, businessId: ctx.businessId } })
    }
  } catch (error) {
    return toActionError(error)
  }
  revalidatePath("/dashboard", "layout")
  return { ok: true, message: id ? "Proveedor actualizado" : "Proveedor creado" }
}

export async function deleteSupplier(id: string): Promise<ActionResult> {
  const ctx = await requireBusiness()
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) return { ok: false, message: "Proveedor no encontrado." }

  try {
    assertCan(ctx, "suppliers:manage")
    // Los gastos se conservan; solo pierden el vínculo con el proveedor.
    const { count } = await db.supplier.deleteMany({ where: { id: parsedId.data, businessId: ctx.businessId } })
    if (count === 0) return { ok: false, message: "Proveedor no encontrado." }
  } catch (error) {
    return toActionError(error)
  }
  revalidatePath("/dashboard", "layout")
  return { ok: true, message: "Proveedor eliminado" }
}
