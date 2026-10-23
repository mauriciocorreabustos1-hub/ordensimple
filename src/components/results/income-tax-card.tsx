import Link from "next/link"
import { Scale } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { incomeTaxRate, percentText, type TaxRegime } from "@/lib/vat"

const REGIME_NAME: Record<TaxRegime, string> = {
  propyme: "Pro Pyme General",
  transparente: "Pro Pyme Transparente",
  general: "Régimen general",
}

/**
 * Impuesto a la renta del año (Chile), estimado con lo registrado: impuesto de primera categoría sobre la utilidad,
 * menos los PPM que ya se pagaron. Se declara en abril del año siguiente (Operación Renta).
 */
export function IncomeTaxCard({
  year,
  isCurrentYear,
  profit,
  ppmPaid,
  regime,
  canManage,
  money,
}: {
  year: number
  isCurrentYear: boolean
  /** Utilidad del año antes de impuestos (sin IVA). */
  profit: number
  /** PPM del año, ya pagados o por pagar en los F29. */
  ppmPaid: number
  /** Régimen según el PPM elegido; null si no se sabe. */
  regime: TaxRegime | null
  canManage: boolean
  money: (n: number) => string
}) {
  const rate = regime ? incomeTaxRate(regime, year) : 0
  const tax = Math.max(0, Math.round(profit * rate))
  const balance = tax - ppmPaid

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="size-5 text-primary" />
          Impuesto a la renta {year} (estimado)
        </CardTitle>
        <CardDescription>
          Se declara en abril de {year + 1} (Operación Renta).{isCurrentYear ? " Calculado con lo que llevas registrado este año." : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {!regime ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed p-4">
            <p className="text-muted-foreground">Para estimarlo necesitamos tu régimen tributario: elige tu tasa de PPM en Configuración, sección Impuestos.</p>
            {canManage ? (
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/configuracion?seccion=impuestos">Elegir mi PPM</Link>
              </Button>
            ) : null}
          </div>
        ) : regime === "transparente" ? (
          <p className="rounded-xl bg-muted/60 p-4 text-muted-foreground">
            En el régimen <strong className="text-foreground">Pro Pyme Transparente</strong> la empresa no paga impuesto de primera categoría: la utilidad del año
            ({money(profit)}) se suma a los ingresos de los dueños en su declaración personal (impuesto global complementario), y ahí se descuentan los PPM
            del año ({money(ppmPaid)}). Cuánto paga cada dueño depende de sus otros ingresos.
          </p>
        ) : (
          <div className="grid gap-6 md:grid-cols-[1fr_1.4fr] md:items-center">
            <div>
              <p className="text-muted-foreground">{balance >= 0 ? "Pagarías en abril (aprox.)" : "Te devolverían en abril (aprox.)"}</p>
              <p className={cn("tabular text-4xl font-semibold tracking-tight", balance < 0 && "text-success")}>{money(Math.abs(balance))}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {REGIME_NAME[regime]}: {percentText(rate)} de la utilidad{regime === "propyme" && year >= 2025 && year <= 2027 ? " (tasa rebajada hasta 2027)" : ""}.
              </p>
            </div>
            <div className="divide-y rounded-xl border px-4">
              <Row label="Utilidad del año" hint="Antes de impuestos" value={money(profit)} />
              <Row label={`Impuesto de primera categoría (${percentText(rate)})`} hint={profit <= 0 ? "Con pérdida no se paga" : undefined} value={money(tax)} />
              <Row label="PPM del año" hint="Lo que adelantas cada mes en el F29" value={`− ${money(ppmPaid)}`} />
              <Row strong label={balance >= 0 ? "Saldo a pagar" : "Saldo a devolver"} value={money(Math.abs(balance))} />
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Es una estimación con tus ventas y gastos registrados, para que no te pille por sorpresa. La declaración real la hace tu contador: considera gastos que
          el SII no acepta, depreciación, pérdidas de años anteriores, créditos y otros ajustes.
        </p>
      </CardContent>
    </Card>
  )
}

function Row({ label, hint, value, strong }: { label: string; hint?: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 py-2.5", strong && "font-semibold")}>
      <div className="min-w-0">
        <p className={strong ? "text-base" : "text-sm"}>{label}</p>
        {hint ? <p className="text-xs font-normal text-muted-foreground">{hint}</p> : null}
      </div>
      <p className={cn("tabular shrink-0", strong ? "text-base" : "text-sm")}>{value}</p>
    </div>
  )
}
