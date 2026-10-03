import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, FlaskConical, Scale, Tag, Target } from "lucide-react"
import { PageHeader } from "@/components/app/page-header"

export const metadata: Metadata = { title: "Herramientas" }

const TOOLS = [
  {
    href: "/dashboard/herramientas/precio",
    title: "¿A cuánto debería vender?",
    description: "Calcula el precio justo para ganar lo que quieres en cada venta.",
    icon: Tag,
  },
  {
    href: "/dashboard/herramientas/punto-equilibrio",
    title: "¿Cuánto necesito vender para no perder?",
    description: "Descubre cuántas unidades cubren todos tus gastos del mes.",
    icon: Scale,
  },
  {
    href: "/dashboard/herramientas/meta",
    title: "¿Cuánto quieres ganar?",
    description: "Convierte tu meta de ganancia en ventas por mes, semana y día.",
    icon: Target,
  },
  {
    href: "/dashboard/herramientas/simulador",
    title: "¿Qué pasa si...?",
    description: "Prueba subir precios, contratar o hacer descuentos sin tocar tus datos.",
    icon: FlaskConical,
  },
]

export default function ToolsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Herramientas" description="Calculadoras simples para tomar mejores decisiones. No modifican tus datos." />
      <div className="grid gap-3 sm:grid-cols-2">
        {TOOLS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="group flex gap-4 rounded-2xl border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-accent/40"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <t.icon className="size-5" />
            </span>
            <span className="flex-1 space-y-1">
              <span className="block font-semibold">{t.title}</span>
              <span className="block text-sm text-muted-foreground">{t.description}</span>
            </span>
            <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </div>
  )
}
