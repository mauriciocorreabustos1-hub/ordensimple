import {
  BarChart3,
  Boxes,
  Calculator,
  Home,
  Package,
  Receipt,
  Settings,
  ShoppingBag,
  Truck,
  Users,
  Vault,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  soon?: boolean
  pro?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Inicio", icon: Home },
  { href: "/dashboard/ventas", label: "Ventas", icon: ShoppingBag },
  { href: "/dashboard/gastos", label: "Gastos", icon: Receipt },
  { href: "/dashboard/caja", label: "Cierre de caja", icon: Vault },
  { href: "/dashboard/productos", label: "Productos", icon: Package },
  { href: "/dashboard/inventario", label: "Inventario", icon: Boxes, pro: true },
  { href: "/dashboard/clientes", label: "Clientes", icon: Users, pro: true },
  { href: "/dashboard/proveedores", label: "Proveedores", icon: Truck, pro: true },
  { href: "/dashboard/herramientas", label: "Herramientas", icon: Calculator },
  { href: "/dashboard/reportes", label: "Reportes", icon: BarChart3, pro: true },
  { href: "/dashboard/configuracion", label: "Configuración", icon: Settings },
]

export function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard"
  return pathname === href || pathname.startsWith(`${href}/`)
}
