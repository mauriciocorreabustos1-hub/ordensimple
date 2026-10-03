import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { Check, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/app/page-header"

export function ComingSoon({
  title,
  description,
  icon: Icon,
  features,
}: {
  title: string
  description: string
  icon: LucideIcon
  features: string[]
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <div className="flex flex-col items-center gap-5 rounded-2xl border border-dashed px-6 py-12 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="size-6" />
        </span>
        <div className="space-y-1">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
            <Sparkles className="size-3" />
            Próximamente · Plan Pro
          </p>
          <p className="text-lg font-semibold">Estamos construyendo esta sección</p>
        </div>
        <ul className="grid gap-2 text-left text-sm">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" />
              {f}
            </li>
          ))}
        </ul>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Volver al inicio</Link>
        </Button>
      </div>
    </div>
  )
}
