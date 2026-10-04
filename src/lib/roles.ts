import type { Role } from "@/generated/prisma/enums"

export type Permission =
  | "sales:create"
  | "sales:delete"
  | "expenses:create"
  | "expenses:delete"
  | "products:manage"
  | "inventory:manage"
  | "customers:manage"
  | "suppliers:manage"
  | "reports:view"
  | "settings:manage"
  | "members:manage"
  | "business:delete"

const PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: [
    "sales:create",
    "sales:delete",
    "expenses:create",
    "expenses:delete",
    "products:manage",
    "inventory:manage",
    "customers:manage",
    "suppliers:manage",
    "reports:view",
    "settings:manage",
    "members:manage",
    "business:delete",
  ],
  ADMIN: [
    "sales:create",
    "sales:delete",
    "expenses:create",
    "expenses:delete",
    "products:manage",
    "inventory:manage",
    "customers:manage",
    "suppliers:manage",
    "reports:view",
    "settings:manage",
  ],
  EMPLOYEE: ["sales:create", "expenses:create", "inventory:manage", "customers:manage"],
}

export const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Dueño",
  ADMIN: "Administrador",
  EMPLOYEE: "Empleado",
}

export function can(role: Role, permission: Permission) {
  return PERMISSIONS[role].includes(permission)
}
