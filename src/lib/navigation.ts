import {
  ArrowLeftRight,
  BadgePercent,
  BarChart3,
  Crown,
  CreditCard,
  FileText,
  Stamp,
  Boxes,
  Calculator,
  CalendarDays,
  ChefHat,
  ClipboardList,
  Gift,
  Globe,
  Home,
  IdCard,
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
  BookOpen,
} from "lucide-react"
import type { Role } from "@/generated/prisma/enums"
import { can, type Permission } from "@/lib/roles"

/** Grupos del menú, en el orden en que aparecen: como los separadores de un archivador. */
export const NAV_GROUPS = ["Vender", "Plata", "Catálogo", "Personas", "Números", "Tu cuenta"] as const
export type NavGroup = (typeof NAV_GROUPS)[number]

export type NavItem = {
  group: NavGroup
  href: string
  label: string
  icon: LucideIcon
  soon?: boolean
  pro?: boolean
  /** Solo para negocios de comida (restaurantes, cafés…). */
  food?: boolean
  /** Solo para negocios de servicios (peluquerías, consultas, talleres…). */
  services?: boolean
  /** Solo para negocios que elaboran con receta (comida, jabones, velas, cosmética…). */
  recipes?: boolean
  /** Se oculta en negocios que solo venden servicios (no manejan stock). */
  stock?: boolean
  /** Si se indica, solo se muestra a quien tenga este permiso. */
  permission?: Permission
}

export const NAV_ITEMS: NavItem[] = [
  { group: "Vender", href: "/dashboard", label: "Inicio", icon: Home },
  { group: "Vender", href: "/dashboard/agenda", label: "Agenda", icon: CalendarDays, pro: true, services: true },
  { group: "Vender", href: "/dashboard/ventas", label: "Ventas", icon: ShoppingBag },
  { group: "Vender", href: "/dashboard/comandas", label: "Comandas", icon: ClipboardList, pro: true, food: true },
  { group: "Vender", href: "/dashboard/cocina", label: "Cocina", icon: ChefHat, pro: true, food: true },
  { group: "Vender", href: "/dashboard/pedidos", label: "Pedidos web", icon: Globe, pro: true },
  { group: "Vender", href: "/dashboard/cotizaciones", label: "Cotizaciones", icon: FileText, pro: true },
  { group: "Personas", href: "/dashboard/fidelidad", label: "Fidelidad", icon: Stamp, pro: true },
  { group: "Vender", href: "/dashboard/cobros", label: "Cobros online", icon: CreditCard },
  { group: "Plata", href: "/dashboard/gastos", label: "Gastos", icon: Receipt },
  { group: "Plata", href: "/dashboard/caja", label: "Cierre de caja", icon: Vault, pro: true },
  { group: "Plata", href: "/dashboard/flujo-caja", label: "Flujo de caja", icon: ArrowLeftRight, pro: true, permission: "finances:view" },
  { group: "Plata", href: "/dashboard/balance", label: "Balance y retiros", icon: Scale, pro: true, permission: "finances:view" },
  { group: "Catálogo", href: "/dashboard/servicios", label: "Servicios", icon: Scissors, permission: "products:manage", services: true },
  { group: "Catálogo", href: "/dashboard/productos", label: "Productos", icon: Package, permission: "products:manage" },
  // Gratis; en el menú de los negocios que elaboran con receta (para los demás está en Herramientas).
  { group: "Catálogo", href: "/dashboard/recetas", label: "Recetas", icon: BookOpen, permission: "products:manage", recipes: true },
  { group: "Catálogo", href: "/dashboard/inventario", label: "Inventario", icon: Boxes, stock: true },
  { group: "Catálogo", href: "/dashboard/promociones", label: "Promociones", icon: BadgePercent, pro: true, permission: "products:manage" },
  { group: "Personas", href: "/dashboard/clientes", label: "Clientes", icon: Users },
  { group: "Personas", href: "/dashboard/proveedores", label: "Proveedores", icon: Truck, pro: true, permission: "suppliers:manage" },
  { group: "Números", href: "/dashboard/herramientas", label: "Herramientas", icon: Calculator, permission: "finances:view" },
  { group: "Números", href: "/dashboard/reportes", label: "Reportes", icon: BarChart3, permission: "reports:view" },
  { group: "Números", href: "/dashboard/resultados", label: "Resultados e IVA", icon: Landmark, pro: true, permission: "reports:view" },
  { group: "Números", href: "/dashboard/sucursales", label: "Sucursales", icon: Store, permission: "finances:view" },
  { group: "Tu cuenta", href: "/dashboard/tarjeta", label: "Tarjeta digital", icon: IdCard },
  { group: "Tu cuenta", href: "/dashboard/invitar", label: "Invita y gana", icon: Gift },
  { group: "Tu cuenta", href: "/dashboard/plan", label: "Tu plan", icon: Crown, permission: "settings:manage" },
  { group: "Tu cuenta", href: "/dashboard/configuracion", label: "Configuración", icon: Settings },
]

export type NavProfile = { food?: boolean; services?: boolean; servicesOnly?: boolean; recipes?: boolean }

/** Los ítems ordenados por grupo, para el menú lateral. */
export function groupNav(items: NavItem[]) {
  return NAV_GROUPS.map((group) => ({ group, items: items.filter((i) => i.group === group) })).filter((g) => g.items.length)
}

/** Menú según el rol (a los empleados no se les muestra lo que no pueden usar) y el rubro del negocio. */
export function navItemsFor(role: Role, { food = false, services = false, servicesOnly = false, recipes = false }: NavProfile = {}) {
  return NAV_ITEMS.filter(
    (item) =>
      (!item.permission || can(role, item.permission)) && (!item.food || food) && (!item.services || services) && (!item.recipes || recipes) && (!item.stock || !servicesOnly),
  )
}

export function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard"
  return pathname === href || pathname.startsWith(`${href}/`)
}
