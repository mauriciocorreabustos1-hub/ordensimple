"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2, Target } from "lucide-react"
import { toast } from "sonner"
import { AppModal } from "@/components/app/app-modal"
import { MoneyInput } from "@/components/app/money-input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatMoney, formatNumber } from "@/lib/currency"
import { setMemberGoal } from "@/server/actions/team"

export type TeamRow = {
  memberId: string
  name: string
  role: string
  net: number
  count: number
  discounts: number
  returned: number
  /** Lo vendido en el mes en curso (para la meta). */
  monthNet: number
  monthlyGoal: number | null
  commissionRate: number | null
  /** Comisión del período elegido. */
  commission: number
}

/** Cómo le fue a cada persona del equipo: ventas, descuentos, devoluciones, meta del mes y comisión. */
export function TeamCard({ rows, currency, canEdit, monthLabel }: { rows: TeamRow[]; currency: string; canEdit: boolean; monthLabel: string }) {
  const money = (n: number) => formatMoney(n, currency)
  const [editing, setEditing] = React.useState<TeamRow | null>(null)
  const top = Math.max(1, ...rows.map((r) => r.net))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tu equipo</CardTitle>
        <CardDescription>
          Lo que vendió cada persona en estas fechas, ya descontando lo que le devolvieron. La meta es la de {monthLabel}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {rows.map((r) => {
            const pct = r.monthlyGoal ? Math.min(1, Math.max(0, r.monthNet / r.monthlyGoal)) : 0
            return (
              <li key={r.memberId} className="space-y-2 py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.role} · {formatNumber(r.count)} {r.count === 1 ? "venta" : "ventas"}
                      {r.count ? ` · promedio ${money(Math.round((r.net + r.returned) / r.count))}` : ""}
                    </p>
                  </div>
                  <p className="tabular text-lg font-semibold">{money(r.net)}</p>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-chart-1" style={{ width: `${r.net > 0 ? Math.max(3, (r.net / top) * 100) : 0}%` }} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {r.discounts ? <span>Descuentos: {money(r.discounts)}</span> : null}
                  {r.returned ? <span className="text-red-600 dark:text-red-400">Devoluciones: {money(r.returned)}</span> : null}
                  {r.commissionRate ? (
                    <span className="font-medium text-foreground">
                      Comisión ({formatPercentRate(r.commissionRate)}): {money(r.commission)}
                    </span>
                  ) : null}
                </div>
                {r.monthlyGoal ? (
                  <div className="rounded-lg bg-muted/50 p-2.5">
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span>
                        Meta de {monthLabel}: <span className="tabular font-medium">{money(r.monthNet)}</span> de {money(r.monthlyGoal)}
                      </span>
                      <span className={`tabular font-semibold ${pct >= 1 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                        {pct >= 1 ? "¡Cumplida!" : `${Math.round(pct * 100)}%`}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-background">
                      <div className={`h-full rounded-full ${pct >= 1 ? "bg-emerald-500" : "bg-primary"}`} style={{ width: `${pct * 100}%` }} />
                    </div>
                  </div>
                ) : null}
                {canEdit ? (
                  <Button variant="ghost" size="sm" className="-ml-2 h-8" onClick={() => setEditing(r)}>
                    <Target />
                    {r.monthlyGoal || r.commissionRate ? "Cambiar meta y comisión" : "Ponerle meta o comisión"}
                  </Button>
                ) : null}
              </li>
            )
          })}
        </ul>
      </CardContent>
      {editing ? <GoalDialog key={editing.memberId} row={editing} currency={currency} onClose={() => setEditing(null)} /> : null}
    </Card>
  )
}

function formatPercentRate(rate: number) {
  return `${(Math.round(rate * 1000) / 10).toString().replace(".", ",")} %`
}

function GoalDialog({ row, currency, onClose }: { row: TeamRow; currency: string; onClose: () => void }) {
  const router = useRouter()
  const [goal, setGoal] = React.useState(row.monthlyGoal ?? 0)
  const [percent, setPercent] = React.useState(row.commissionRate ? String(Math.round(row.commissionRate * 1000) / 10).replace(".", ",") : "")
  const [busy, setBusy] = React.useState(false)
  const parsedPercent = percent.trim() ? Number(percent.replace(",", ".")) : 0
  const invalid = !Number.isFinite(parsedPercent) || parsedPercent < 0 || parsedPercent > 50

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (invalid) return
    setBusy(true)
    const r = await setMemberGoal(row.memberId, { monthlyGoal: goal || null, commissionPercent: parsedPercent || null })
    setBusy(false)
    if (!r.ok) return toast.error(r.message)
    toast.success(r.message)
    onClose()
    router.refresh()
  }

  return (
    <AppModal open onOpenChange={(o) => !o && onClose()} title={`Meta y comisión de ${row.name.split(" ")[0]}`} description="Lo verá en su inicio, para saber cómo va en el mes." noAutoFocus>
      <form onSubmit={save} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="goal">Meta de ventas del mes</Label>
          <MoneyInput id="goal" value={goal} onValueChange={setGoal} currency={currency} />
          <p className="text-xs text-muted-foreground">Déjala vacía si no quieres ponerle meta.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="commission">Comisión sobre lo que vende (%)</Label>
          <Input id="commission" inputMode="decimal" placeholder="Ej: 3" value={percent} onChange={(e) => setPercent(e.target.value)} className="w-32" aria-invalid={invalid} />
          <p className={`text-xs ${invalid ? "text-destructive" : "text-muted-foreground"}`}>
            {invalid ? "Escribe un número entre 0 y 50." : "Se calcula sobre lo vendido, sin contar lo que le devolvieron."}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy || invalid}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            Guardar
          </Button>
        </div>
      </form>
    </AppModal>
  )
}
