import Link from "next/link"
import { ArrowRight, BookOpen, Calculator, NotebookPen, PiggyBank, Vault } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Container, CtaSection } from "@/components/landing/sections"
import { getAppUrl } from "@/lib/app-url"
import { SignupLink } from "@/components/landing/signup-link"

export const GUIDES = [
  {
    href: "/guias/como-llevar-el-fiado",
    title: "Cómo llevar el fiado sin perder dinero",
    description: "Reglas simples para fiar, anotar y cobrar sin discusiones.",
    icon: NotebookPen,
  },
  {
    href: "/guias/como-hacer-el-cierre-de-caja",
    title: "Cómo hacer el cierre de caja paso a paso",
    description: "La cuenta para saber si falta o sobra dinero al final del día.",
    icon: Vault,
  },
  {
    href: "/guias/como-calcular-la-ganancia-de-tu-negocio",
    title: "Cómo calcular la ganancia de tu negocio",
    description: "Vender mucho no es lo mismo que ganar mucho: aprende a sacar la cuenta.",
    icon: PiggyBank,
  },
] as const

export function GuideList({ current }: { current?: string }) {
  const items = GUIDES.filter((g) => g.href !== current)
  return (
    <div className="grid gap-3">
      {items.map((g) => (
        <Link
          key={g.href}
          href={g.href}
          className="group flex items-start gap-3 rounded-2xl border bg-card p-4 transition-colors hover:border-primary/40"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <g.icon className="size-5" />
          </span>
          <span className="min-w-0 space-y-1">
            <span className="flex items-center gap-1 font-semibold group-hover:text-primary">
              {g.title}
              <ArrowRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
            </span>
            <span className="block text-sm text-muted-foreground">{g.description}</span>
          </span>
        </Link>
      ))}
    </div>
  )
}

/** Página de guía: artículo con secciones, llamado a probar OrdenSimple y otras guías. */
export function GuidePage({
  href,
  title,
  description,
  updated,
  readingMinutes,
  children,
}: {
  href: string
  title: string
  description: string
  updated: string
  readingMinutes: number
  children: React.ReactNode
}) {
  const url = `${getAppUrl()}${href}`
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    inLanguage: "es-CL",
    mainEntityOfPage: url,
    author: { "@type": "Organization", name: "OrdenSimple", url: getAppUrl() },
    publisher: { "@type": "Organization", name: "OrdenSimple", logo: { "@type": "ImageObject", url: `${getAppUrl()}/pwa-icon/512` } },
  }
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Container className="max-w-3xl py-14 md:py-20">
        <header className="space-y-4 border-b pb-8">
          <Link href="/guias" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            <BookOpen className="size-4" />
            Guías para tu negocio
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h1>
          <p className="text-lg text-pretty text-muted-foreground">{description}</p>
          <p className="text-sm text-muted-foreground">
            Actualizado el {updated}. Se lee en {readingMinutes} minutos.
          </p>
        </header>

        <div className="space-y-10 pt-8">{children}</div>

        <div className="mt-12 flex flex-col items-start gap-4 rounded-3xl border bg-primary/5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="flex items-center gap-2 font-semibold">
              <Calculator className="size-5 text-primary" />
              Hazlo en tu celular, sin cuaderno
            </p>
            <p className="text-sm text-muted-foreground">OrdenSimple hace estas cuentas por ti. Gratis para empezar.</p>
          </div>
          <Button asChild size="lg" className="h-11 shrink-0 px-5 max-sm:w-full">
            <SignupLink>
              Crear cuenta gratis
              <ArrowRight />
            </SignupLink>
          </Button>
        </div>

        <section className="mt-12 space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Otras guías</h2>
          <GuideList current={href} />
        </section>
      </Container>
      <CtaSection />
    </>
  )
}
