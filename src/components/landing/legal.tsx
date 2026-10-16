import { Container } from "@/components/landing/sections"

/** Estructura común para documentos legales: título, fecha y secciones numeradas. */
export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string
  updated: string
  intro: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Container className="max-w-3xl py-14 md:py-20">
      <header className="space-y-3 border-b pb-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="text-sm text-muted-foreground">Última actualización: {updated}</p>
        <div className="text-muted-foreground">{intro}</div>
      </header>
      <div className="space-y-10 pt-8">{children}</div>
    </Container>
  )
}

export function LegalSection({ n, title, id, children }: { n: number; title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">
        {n}. {title}
      </h2>
      <div className="space-y-3 leading-relaxed text-foreground/85 [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  )
}
