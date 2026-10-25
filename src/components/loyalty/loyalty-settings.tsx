"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { ChoiceChips } from "@/components/app/choice-chips"
import { Field } from "@/components/app/field"
import { MoneyInput } from "@/components/app/money-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { formatMoney } from "@/lib/currency"
import { ruleText, units, type LoyaltyConfig, type LoyaltyModeValue } from "@/lib/loyalty"
import { saveLoyaltySettings } from "@/server/actions/loyalty"

/** Cómo ganan los clientes (sellos o puntos), cuántos se necesitan y cuál es el premio. */
export function LoyaltySettingsForm({ cfg, enabled, currency, onDone }: { cfg: LoyaltyConfig; enabled: boolean; currency: string; onDone: () => void }) {
  const money = (n: number) => formatMoney(n, currency)
  // Si estaba apagada, guardar la vuelve a activar.
  const [on, setOn] = React.useState(true)
  const [mode, setMode] = React.useState<LoyaltyModeValue>(cfg.mode)
  const [goal, setGoal] = React.useState(String(cfg.goal))
  const [reward, setReward] = React.useState(cfg.reward ?? "")
  const [minPurchase, setMinPurchase] = React.useState(cfg.minPurchase)
  const [pointValue, setPointValue] = React.useState(cfg.pointValue)
  const [pending, startTransition] = React.useTransition()
  const preview: LoyaltyConfig = { mode, goal: Number(goal) || 0, reward, minPurchase, pointValue }

  function switchMode(next: LoyaltyModeValue) {
    setMode(next)
    // Metas típicas de cada forma, si no las habían cambiado.
    if (next === "POINTS" && goal === "10") setGoal("100")
    if (next === "STAMPS" && goal === "100") setGoal("10")
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const r = await saveLoyaltySettings({ enabled: on, mode, goal: Number(goal) || 0, reward, minPurchase, pointValue })
      if (!r.ok) return void toast.error(r.message)
      toast.success(r.message)
      onDone()
    })
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <ChoiceChips
        name="Cómo ganan tus clientes"
        value={mode}
        onChange={switchMode}
        options={[
          { value: "STAMPS", label: "Sellos", description: "Un sello por compra. Ej.: 10 cafés y el siguiente gratis." },
          { value: "POINTS", label: "Puntos", description: "Según cuánto compran. Ej.: 1 punto por cada $1.000." },
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {mode === "STAMPS" ? (
          <Field label="Compra mínima para un sello" htmlFor="ls-min" hint="Déjalo en $0 para que cualquier compra sume.">
            <MoneyInput id="ls-min" value={minPurchase} onValueChange={setMinPurchase} currency={currency} />
          </Field>
        ) : (
          <Field label="Un punto por cada" htmlFor="ls-point">
            <MoneyInput id="ls-point" value={pointValue} onValueChange={setPointValue} currency={currency} />
          </Field>
        )}
        <Field label={mode === "STAMPS" ? "Sellos para el premio" : "Puntos para el premio"} htmlFor="ls-goal">
          <Input id="ls-goal" inputMode="numeric" value={goal} onChange={(e) => setGoal(e.target.value.replace(/\D/g, "").slice(0, 6))} className="h-10" />
        </Field>
      </div>
      <Field label="Premio" htmlFor="ls-reward" hint="En palabras simples: así lo ve tu cliente en su tarjeta.">
        <Input id="ls-reward" value={reward} onChange={(e) => setReward(e.target.value)} maxLength={80} className="h-10" placeholder="Ej.: un café gratis" />
      </Field>
      {Number(goal) > 0 ? (
        <p className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
          {ruleText(preview, money)}. Con {units(mode, Number(goal))}, {reward.trim() || "el premio"}.
        </p>
      ) : null}
      {enabled ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
          <div>
            <p className="text-sm font-medium">Tarjeta activa</p>
            <p className="text-xs text-muted-foreground">Si la apagas, no se suman sellos ni puntos, pero los saldos se mantienen.</p>
          </div>
          <Switch checked={on} onCheckedChange={setOn} aria-label="Tarjeta activa" />
        </div>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        {enabled ? "Guardar" : "Activar tarjeta de fidelidad"}
      </Button>
    </form>
  )
}
