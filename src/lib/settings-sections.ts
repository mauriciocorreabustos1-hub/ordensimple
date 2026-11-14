import { Bell, Globe, Landmark, Printer, Store, UserRound, Users, type LucideIcon } from "lucide-react"

/** Categorías de Configuración (cada una muestra solo sus ajustes). */
export type SettingsSection = "negocio" | "tienda" | "impuestos" | "impresoras" | "avisos" | "equipo" | "cuenta"

export const SETTINGS_SECTIONS: { id: SettingsSection; label: string; hint: string; icon: LucideIcon }[] = [
  { id: "negocio", label: "Tu negocio", hint: "Datos, logo y apariencia", icon: Store },
  { id: "tienda", label: "Tienda online", hint: "Pedidos por WhatsApp", icon: Globe },
  { id: "impuestos", label: "Impuestos y gastos", hint: "IVA, máquina de tarjetas y categorías", icon: Landmark },
  { id: "impresoras", label: "Impresoras", hint: "Boletas, cuentas y comandas", icon: Printer },
  { id: "avisos", label: "Avisos", hint: "Qué te avisamos por correo", icon: Bell },
  { id: "equipo", label: "Equipo", hint: "Usuarios y permisos", icon: Users },
  { id: "cuenta", label: "Tu cuenta", hint: "Plan, seguridad y datos", icon: UserRound },
]

export const settingsHref = (id: SettingsSection) => (id === "negocio" ? "/dashboard/configuracion" : `/dashboard/configuracion?seccion=${id}`)
