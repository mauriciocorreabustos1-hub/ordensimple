import {
  ArrowLeftRight,
  BadgePercent,
  BarChart3,
  Crown,
  Boxes,
  Calculator,
  CalendarDays,
  ChefHat,
  ClipboardList,
  Gift,
  Globe,
  Home,
  Landmark,
  Package,
  Receipt,
  Scale,
  Scissors,
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
  /** Solo para negocios de comida (restaurantes, cafés…). */
  food?: boolean
  /** Solo para negocios de servicios (peluquerías, consultas, talleres…). */
  services?: boolean
  /** Se oculta en negocios que solo venden servicios (no manejan stock). */
  stock?: boolean
  /** Si se indica, solo se muestra a quien tenga este permiso. */
  permission?: Permission
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Inicio", icon: Home },
  { href: "/dashboard/agenda", label: "Agenda", icon: CalendarDays, pro: true, services: true },
  { href: "/dashboard/ventas", label: "Ventas", icon: ShoppingBag },
  { href: "/dashboard/comandas", label: "Comandas", icon: ClipboardList, pro: true, food: true },
  { href: "/dashboard/cocina", label: "Cocina", icon: ChefHat, pro: true, food: true },
  { href: "/dashboard/pedidos", label: "Pedidos web", icon: Globe, pro: true },
  { href: "/dashboard/gastos", label: "Gastos", icon: Receipt },
  { href: "/dashboard/caja", label: "Cierre de caja", icon: Vault, pro: true },
  { href: "/dashboard/flujo-caja", label: "Flujo de caja", icon: ArrowLeftRight, pro: true, permission: "finances:view" },
  { href: "/dashboard/balance", label: "Balance y retiros", icon: Scale, pro: true, permission: "finances:view" },
  { href: "/dashboard/servicios", label: "Servicios", icon: Scissors, permission: "products:manage", services: true },
  { href: "/dashboard/productos", label: "Productos", icon: Package, permission: "products:manage" },
  { href: "/dashboard/inventario", label: "Inventario", icon: Boxes, pro: true, stock: true },
  { href: "/dashboard/promociones", label: "Promociones", icon: BadgePercent, pro: true, permission: "products:manage" },
  { href: "/dashboard/clientes", label: "Clientes", icon: Users },
  { href: "/dashboard/proveedores", label: "Proveedores", icon: Truck, pro: true, permission: "suppliers:manage" },
  { href: "/dashboard/herramientas", label: "Herramientas", icon: Calculator, permission: "finances:view" },
  { href: "/dashboard/reportes", label: "Reportes", icon: BarChart3, permission: "reports:view" },
  { href: "/dashboard/resultados", label: "Resultados e IVA", icon: Landmark, pro: true, permission: "reports:view" },
  { href: "/dashboard/sucursales", label: "Sucursales", icon: Store, permission: "finances:view" },
  { href: "/dashboard/invitar", label: "Invita y gana", icon: Gift },
  { href: "/dashboard/plan", label: "Tu plan", icon: Crown, permission: "settings:manage" },
  { href: "/dashboard/configuracion", label: "Configuración", icon: Settings },
]

export type NavProfile = { food?: boolean; services?: boolean; servicesOnly?: boolean }

/** Menú según el rol (a los empleados no se les muestra lo que no pueden usar) y el rubro del negocio. */
export function navItemsFor(role: Role, { food = false, services = false, servicesOnly = false }: NavProfile = {}) {
  return NAV_ITEMS.filter(
    (item) =>
      (!item.permission || can(role, item.permission)) && (!item.food || food) && (!item.services || services) && (!item.stock || !servicesOnly),
  )
}

export function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard"
  return pathname === href || pathname.startsWith(`${href}/`)
}
