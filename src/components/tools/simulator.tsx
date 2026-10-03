"use client"

import * as React from "react"
import {
  BadgePercent,
  Megaphone,
  PackagePlus,
  TrendingDown,
  TrendingUp,
  UserPlus,
  ArrowDownCircle,
  ArrowUpCircle,
  type LucideIcon,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field } from "@/components/app/field"
import { MoneyInput } from "@/components/app/money-input"
import { Explainer } from "@/components/app/explainer"
import { PercentInput } from "@/components/tools/percent-input"
import { profitOf, simulate, type SimulationBase, type SimulationChange } from "@/lib/calculations"
import { formatMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"

type ScenarioId =
  | "priceUp"
  | "priceDown"
  | "salesUp"
  | "salesDown"
  | "supplierUp"
  | "hire"
  | "ads"
  | "discount"

type Params = { pct: number; amount: number; volumePct: number }

const SCENARIOS: {
  id: ScenarioId
  label: string
  question: (p: Params, money: (n: number) => string) => string
  icon: LucideIcon
  toChange: (p: Params) => SimulationChange
}[] = [
  { id: "priceUp", label: "Subir precio", icon: ArrowUpCircle, question: (p) => `¿Qué pasa si subo mis precios ${p.pct}%?`, toChange: (p) => ({ pricePct: p.pct }) },
  { id: "priceDown", label: "Bajar precio", icon: ArrowDownCircle, question: (p) => `¿Qué pasa si bajo mis precios ${p.pct}%?`, toChange: (p) => ({ pricePct: -p.pct }) },
  { id: "salesUp", label: "Vender más", icon: TrendingUp, question: (p) => `¿Qué pasa si vendo ${p.pct}% más?`, toChange: (p) => ({ volumePct: p.pct }) },
  { id: "salesDown", label: "Vender menos", icon: TrendingDown, question: (p) => `¿Qué pasa si vendo ${p.pct}% menos?`, toChange: (p) => ({ volumePct: -p.pct }) },
  { id: "supplierUp", label: "Proveedor sube precios", icon: PackagePlus, question: (p) => `¿Qué pasa si mi proveedor sube sus precios ${p.pct}%?`, toChange: (p) => ({ variableCostPct: p.pct }) },
  { id: "hire", label: "Contratar a alguien", icon: UserPlus, question: (p, m) => `¿Qué pasa si contrato a alguien por ${m(p.amount)} al mes?`, toChange: (p) => ({ extraFixed: p.amount }) },
  { id: "ads", label: "Más publicidad", icon: Megaphone, question: (p, m) => `¿Qué pasa si invierto ${m(p.amount)} en publicidad y vendo ${p.volumePct}% más?`, toChange: (p) => ({ extraFixed: p.amount, volumePct: p.volumePct }) },
  { id: "discount", label: "Hacer un descuento", icon: BadgePercent, question: (p) => `¿Qué pasa si hago ${p.pct}% de descuento y vendo ${p.volumePct}% más?`, toChange: (p) => ({ pricePct: -p.pct, volumePct: p.volumePct }) },
]

export function Simulator({
  currency,
  base: initialBase,
  fromData,
}: {
  currency: string
  base: SimulationBase
  fromData: boolean
}) {
  const money = (n: number) => formatMoney(n, currency)
  const [base, setBase] = React.useState(initialBase)
  const [scenarioId, setScenarioId] = React.useState<ScenarioId>("priceUp")
  const [params, setParams] = React.useState<Params>({ pct: 10, amount: 0, volumePct: 10 })
  const scenario = SCENARIOS.find((s) => s.id === scenarioId)!

  const current = profitOf(base)
  const simulated = simulate(base, scenario.toChange(params))
  const diff = simulated.profit - current.profit
  const usesAmount = scenarioId === "hire" || scenarioId === "ads"
  const usesVolume = scenarioId === "ads" || scenarioId === "discount"
  const usesPct = !usesAmount

  // Para descuentos: cuánto más hay que vender para ganar lo mismo.
  const breakEvenVolume = React.useMemo(() => {
    if (scenarioId !== "discount" || base.sales <= 0) return null
    const priceFactor = 1 - params.pct / 100
    const unitMargin = base.sales * priceFactor - base.variableCosts
    if (unitMargin <= 0) return null
    const needed = (current.profit + base.fixedCosts) / unitMargin - 1
    return Math.max(0, Math.ceil(needed * 100))
  }, [scenarioId, params.pct, base, current.profit])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tu situación actual (un mes)</CardTitle>
          <CardDescription>
            {fromData
              ? "Calculado con lo que registraste en los últimos 30 días. Puedes ajustarlo; nada de esto cambia tus datos reales."
              : "Escribe tus números aproximados de un mes. Nada de esto cambia tus datos reales."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Ventas del mes">
            <MoneyInput value={base.sales} onValueChange={(n) => setBase((b) => ({ ...b, sales: n }))} currency={currency} aria-label="Ventas del mes" />
          </Field>
          <Field label="Costo de lo vendido" hint="Lo que pagaste por la mercadería vendida.">
            <MoneyInput value={base.variableCosts} onValueChange={(n) => setBase((b) => ({ ...b, variableCosts: n }))} currency={currency} aria-label="Costo de lo vendido" />
          </Field>
          <Field label="Gastos fijos" hint="Arriendo, sueldos, cuentas… (sin compras de mercadería).">
            <MoneyInput value={base.fixedCosts} onValueChange={(n) => setBase((b) => ({ ...b, fixedCosts: n }))} currency={currency} aria-label="Gastos fijos" />
          </Field>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <p className="text-sm font-medium">Elige qué quieres probar</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setScenarioId(s.id)}
              aria-pressed={scenarioId === s.id}
              className={cn(
                "flex items-center gap-2 rounded-xl border bg-card px-3 py-3 text-left text-sm font-medium transition-colors hover:border-primary/50",
                scenarioId === s.id && "border-primary bg-accent text-accent-foreground ring-1 ring-primary",
              )}
            >
              <s.icon className="size-4 shrink-0 text-primary" />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{scenario.question(params, money)}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            {usesPct ? (
              <Field label={scenarioId === "discount" ? "Descuento" : "Porcentaje"}>
                <PercentInput value={params.pct} onChange={(pct) => setParams((p) => ({ ...p, pct }))} min={1} max={80} label="Porcentaje" />
              </Field>
            ) : null}
            {usesAmount ? (
              <Field label={scenarioId === "hire" ? "Sueldo mensual (con costos)" : "Inversión mensual en publicidad"}>
                <MoneyInput value={params.amount} onValueChange={(amount) => setParams((p) => ({ ...p, amount }))} currency={currency} aria-label="Monto" />
              </Field>
            ) : null}
            {usesVolume ? (
              <Field label="¿Cuánto más crees que venderías?">
                <PercentInput value={params.volumePct} onChange={(volumePct) => setParams((p) => ({ ...p, volumePct }))} min={0} max={200} label="Aumento de ventas" />
              </Field>
            ) : null}
            {scenarioId === "priceUp" ? (
              <p className="text-xs text-muted-foreground">Suponemos que sigues vendiendo la misma cantidad.</p>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium" />
                  <th className="px-4 py-2 text-right font-medium">Hoy</th>
                  <th className="px-4 py-2 text-right font-medium">Simulado</th>
                </tr>
              </thead>
              <tbody className="tabular">
                <tr className="border-t">
                  <td className="px-4 py-2.5">Ventas</td>
                  <td className="px-4 py-2.5 text-right">{money(current.sales)}</td>
                  <td className="px-4 py-2.5 text-right">{money(simulated.sales)}</td>
                </tr>
                <tr className="border-t">
                  <td className="px-4 py-2.5">Costo de lo vendido</td>
                  <td className="px-4 py-2.5 text-right">{money(current.variableCosts)}</td>
                  <td className="px-4 py-2.5 text-right">{money(simulated.variableCosts)}</td>
                </tr>
                <tr className="border-t">
                  <td className="px-4 py-2.5">Gastos fijos</td>
                  <td className="px-4 py-2.5 text-right">{money(current.fixedCosts)}</td>
                  <td className="px-4 py-2.5 text-right">{money(simulated.fixedCosts)}</td>
                </tr>
                <tr className="border-t bg-muted/30 font-semibold">
                  <td className="px-4 py-3">Ganancia</td>
                  <td className="px-4 py-3 text-right">{money(current.profit)}</td>
                  <td className="px-4 py-3 text-right">{money(simulated.profit)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div
            className={cn(
              "rounded-2xl border p-5",
              diff > 0 && "border-success/30 bg-success/10",
              diff < 0 && "border-danger/30 bg-danger/10",
              diff === 0 && "bg-muted/40",
            )}
          >
            <p className="text-sm text-muted-foreground">Diferencia en tu ganancia</p>
            <p className="tabular text-3xl font-semibold tracking-tight">
              {diff > 0 ? "+" : diff < 0 ? "−" : ""}
              {money(Math.abs(diff))}
              <span className="text-base font-normal text-muted-foreground"> al mes</span>
            </p>
            <p className="mt-1 text-sm text-foreground/80">
              {diff > 0
                ? `Ganarías ${money(diff)} más cada mes.`
                : diff < 0
                  ? `Ganarías ${money(-diff)} menos cada mes.`
                  : "Tu ganancia quedaría igual."}
            </p>
          </div>

          {breakEvenVolume !== null ? (
            <Explainer title="Dato útil">
              Con un descuento de {params.pct}%, necesitas vender al menos {breakEvenVolume}% más solo para ganar lo mismo
              que hoy.
            </Explainer>
          ) : null}
        </div>
      </div>
    </div>
  )
}
