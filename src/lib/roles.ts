import type { Role } from "@/generated/prisma/enums"

export type Permission =
  | "sales:create"
  | "sales:edit"
  | "sales:delete"
  | "expenses:create"
  | "expenses:edit"
  | "expenses:delete"
  | "products:manage"
  | "inventory:manage"
  | "customers:manage"
  | "suppliers:manage"
  | "reports:view"
  /** Ver ganancias, costos, márgenes y calculadoras. Los empleados no lo tienen. */
  | "finances:view"
  | "settings:manage"
  | "members:manage"
  | "business:delete"

const PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: [
    "sales:create",
    "sales:edit",
    "sales:delete",
    "expenses:create",
    "expenses:edit",
    "expenses:delete",
    "products:manage",
    "inventory:manage",
    "customers:manage",
    "suppliers:manage",
    "reports:view",
    "finances:view",
    "settings:manage",
    "members:manage",
    "business:delete",
  ],
  ADMIN: [
    "sales:create",
    "sales:edit",
    "sales:delete",
    "expenses:create",
    "expenses:edit",
    "expenses:delete",
    "products:manage",
    "inventory:manage",
    "customers:manage",
    "suppliers:manage",
    "reports:view",
    "finances:view",
    "settings:manage",
  ],
  EMPLOYEE: ["sales:create", "expenses:create", "inventory:manage", "customers:manage"],
}

export const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Dueño",
  ADMIN: "Administrador",
  EMPLOYEE: "Empleado",
}

/** El dueño y los administradores aprueban (o aplican directamente) los descuentos; los empleados los piden. */
export function canApproveDiscounts(role: Role) {
  return can(role, "sales:edit")
}

export function can(role: Role, permission: Permission) {
  return PERMISSIONS[role].includes(permission)
}
