import Link from "next/link"
import { AlertTriangle, ChevronRight, Info, Lightbulb, TrendingUp } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Insight } from "@/server/queries/insights"
import { cn } from "@/lib/utils"

const TONE = {
  good: { icon: TrendingUp, cls: "text-success bg-success/10" },
  warning: { icon: AlertTriangle, cls: "text-warning bg-warning/15" },
  info: { icon: Info, cls: "text-chart-3 bg-chart-3/10" },
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
          <ul className="grid gap-2">
            {shown.map((tip) => {
              const t = TONE[tip.tone]
              const content = (
                <>
                  <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", t.cls)}>
                    <t.icon className="size-4" />
                  </span>
                  <span className="flex-1 text-sm">{tip.text}</span>
                  {tip.href ? <ChevronRight className="size-4 shrink-0 text-muted-foreground" /> : null}
                </>
              )
              return (
                <li key={tip.id}>
                  {tip.href ? (
                    <Link href={tip.href} className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/50">
                      {content}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 rounded-xl border p-3">{content}</div>
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
