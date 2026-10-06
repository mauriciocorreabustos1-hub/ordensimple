import {
  BarChart3,
  Boxes,
  Calculator,
  Home,
  Landmark,
  Package,
  Receipt,
  Settings,
  Store,
  ShoppingBag,
  Truck,
  Users,
  Vault,
  type LucideIcon,
} from "lucide-react"
import type { Role } from "@/generated/prisma/enums"
import { can, type Permission } from "@/lib/roles"

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  soon?: boolean
  pro?: boolean
  /** Si se indica, solo se muestra a quien tenga este permiso. */
  permission?: Permission
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Inicio", icon: Home },
  { href: "/dashboard/ventas", label: "Ventas", icon: ShoppingBag },
  { href: "/dashboard/gastos", label: "Gastos", icon: Receipt },
  { href: "/dashboard/caja", label: "Cierre de caja", icon: Vault },
  { href: "/dashboard/productos", label: "Productos", icon: Package, permission: "products:manage" },
  { href: "/dashboard/inventario", label: "Inventario", icon: Boxes },
  { href: "/dashboard/clientes", label: "Clientes", icon: Users },
  { href: "/dashboard/proveedores", label: "Proveedores", icon: Truck, pro: true, permission: "suppliers:manage" },
  { href: "/dashboard/herramientas", label: "Herramientas", icon: Calculator, permission: "finances:view" },
  { href: "/dashboard/reportes", label: "Reportes", icon: BarChart3, permission: "reports:view" },
  { href: "/dashboard/resultados", label: "Resultados e IVA", icon: Landmark, pro: true, permission: "reports:view" },
  { href: "/dashboard/sucursales", label: "Sucursales", icon: Store, permission: "finances:view" },
  { href: "/dashboard/configuracion", label: "Configuración", icon: Settings },
]

/** Menú según el rol: a los empleados no se les muestra lo que no pueden usar. */
export function navItemsFor(role: Role) {
  return NAV_ITEMS.filter((item) => !item.permission || can(role, item.permission))
}

export function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard"
  return pathname === href || pathname.startsWith(`${href}/`)
}
