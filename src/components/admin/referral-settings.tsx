"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Field } from "@/components/app/field"
import { ChoiceChips } from "@/components/admin/choice-chips"
import { REFERRAL_TRIGGERS, triggerText, type ReferralTrigger } from "@/lib/referrals"
import { saveReferralProgram, type ReferralProgramInput } from "@/server/actions/admin"

const PLAN_OPTIONS = [
  { value: "PRO" as const, label: "Pro" },
  { value: "BUSINESS" as const, label: "Empresa" },
]

/** Número entero desde un campo de texto (vacío = 0). */
const toInt = (v: string) => Math.max(0, Math.floor(Number(v.replace(/\D/g, "")) || 0))

/** Reglas de "Invita a un amigo": cuántos días se regalan, de qué plan y cuándo gana quien invita. */
export function ReferralSettings({ initial }: { initial: ReferralProgramInput }) {
  const [v, setV] = React.useState(initial)
  const [pending, startTransition] = React.useTransition()
  const set = (patch: Partial<ReferralProgramInput>) => setV((x) => ({ ...x, ...patch }))
  const plan = v.plan === "BUSINESS" ? "Empresa" : "Pro"

  function save(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const r = await saveReferralProgram(v)
      if (r.ok) toast.success(r.message ?? "Guardado")
      else toast.error(r.message)
    })
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <label className="flex items-center justify-between gap-4 rounded-xl border bg-muted/30 p-3">
        <span>
          <span className="block font-medium">Programa activo</span>
          <span className="text-sm text-muted-foreground">
            {v.enabled
              ? 'Los clientes ven "Invita y gana" y sus enlaces funcionan.'
              : "Pausado: los enlaces no dan días y la página dice que no está activo."}
          </span>
        </span>
        <Switch checked={v.enabled} onCheckedChange={(enabled) => set({ enabled })} aria-label="Programa activo" />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Días para el invitado" hint="Se le dan al crear su negocio. 0 = nada.">
          <Input
            inputMode="numeric"
            value={String(v.invitedDays)}
            onChange={(e) => set({ invitedDays: Math.min(365, toInt(e.target.value)) })}
          />
        </Field>
        <Field label="Días para quien invita" hint="Por cada negocio que se una. 0 = nada.">
          <Input
            inputMode="numeric"
            value={String(v.referrerDays)}
            onChange={(e) => set({ referrerDays: Math.min(365, toInt(e.target.value)) })}
          />
        </Field>
      </div>

      <Field label="Plan que se regala">
        <ChoiceChips options={PLAN_OPTIONS} value={v.plan} onChange={(plan) => set({ plan })} />
      </Field>

      <Field label="¿Cuándo gana quien invita?" hint="Esperar ventas o un pago evita que alguien cree cuentas falsas solo para ganar días.">
        <ChoiceChips
          options={REFERRAL_TRIGGERS.map((t) => ({ value: t.value as ReferralTrigger, label: t.label }))}
          value={v.referrerTrigger}
          onChange={(referrerTrigger) => set({ referrerTrigger })}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        {v.referrerTrigger === "VENTAS" ? (
          <Field label="Ventas que debe registrar el invitado">
            <Input
              inputMode="numeric"
              value={String(v.minSales)}
              onChange={(e) => set({ minSales: Math.min(500, Math.max(1, toInt(e.target.value))) })}
            />
          </Field>
        ) : null}
        <Field label="Máximo de recompensas por negocio" hint="Vacío = sin límite.">
          <Input
            inputMode="numeric"
            placeholder="Sin límite"
            value={v.maxRewards === null ? "" : String(v.maxRewards)}
            onChange={(e) => set({ maxRewards: e.target.value.trim() === "" ? null : Math.min(1000, Math.max(1, toInt(e.target.value))) })}
          />
        </Field>
      </div>

      <p className="rounded-xl border border-primary/30 bg-accent/40 p-3 text-sm text-pretty">
        <strong>Así lo verán tus clientes:</strong>{" "}
        {v.invitedDays > 0 ? `Tu amigo recibe ${v.invitedDays} días gratis del plan ${plan}. ` : "Tu amigo no recibe días. "}
        {v.referrerDays > 0
          ? `Tú ganas ${v.referrerDays} días del plan ${plan} ${triggerText(v.referrerTrigger, v.minSales)}`
          : "Tú no ganas días"}
        {v.referrerDays > 0 && v.maxRewards !== null ? ` (hasta ${v.maxRewards} veces).` : "."}
      </p>

      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        Guardar reglas
      </Button>
    </form>
  )
}
