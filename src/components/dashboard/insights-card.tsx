import Link from "next/link"
import { AlertTriangle, ChevronRight, Info, Lightbulb, TrendingUp } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Insight } from "@/server/queries/insights"
import { cn } from "@/lib/utils"

const TONE = {
  good: { icon: TrendingUp, cls: "text-success" },
  warning: { icon: AlertTriangle, cls: "text-warning" },
  info: { icon: Info, cls: "text-primary" },
} as const

export function InsightsCard({ insights, limit }: { insights: Insight[]; limit?: number }) {
  const shown = limit ? insights.slice(0, limit) : insights
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="size-4 text-primary" />
          Consejos para tu negocio
        </CardTitle>
        <CardDescription>Calculados con tus números de los últimos 30 días.</CardDescription>
      </CardHeader>
      <CardContent>
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no hay suficientes datos para darte consejos. Sigue registrando ventas y gastos.
          </p>
        ) : (
          // Una hoja de cuaderno: cada consejo escrito sobre los renglones, con su ícono en el margen.
          <ul className="notebook-lines">
            {shown.map((tip) => {
              const t = TONE[tip.tone]
              const content = (
                <>
                  <span className={cn("flex h-7 w-8 shrink-0 items-center justify-center", t.cls)}>
                    <t.icon className="size-4" />
                  </span>
                  <span className="flex-1 text-sm leading-7 text-pretty">{tip.text}</span>
                  {tip.href ? <ChevronRight className="mt-1.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" /> : null}
                </>
              )
              return (
                <li key={tip.id}>
                  {tip.href ? (
                    <Link href={tip.href} className="group flex items-start gap-4 py-3.5 pr-1 transition-colors hover:bg-primary/[0.04]">
                      {content}
                    </Link>
                  ) : (
                    <div className="flex items-start gap-4 py-3.5 pr-1">{content}</div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
