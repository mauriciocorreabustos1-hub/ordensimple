"use client"

import * as React from "react"
import { Crown, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { Plan } from "@/generated/prisma/enums"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { AppModal } from "@/components/app/app-modal"
import { Field } from "@/components/app/field"
import { ChoiceChips } from "@/components/admin/choice-chips"
import { setBusinessPlan } from "@/server/actions/admin"

const PLAN_OPTIONS: { value: Plan; label: string }[] = [
  { value: "FREE", label: "Gratis" },
  { value: "PRO", label: "Pro" },
  { value: "BUSINESS", label: "Empresa" },
]

const DURATIONS: { value: number | null; label: string }[] = [
  { value: 7, label: "7 días" },
  { value: 30, label: "1 mes" },
  { value: 90, label: "3 meses" },
  { value: 180, label: "6 meses" },
  { value: 365, label: "1 año" },
  { value: null, label: "Sin vencimiento" },
]

/** Dar, extender o quitar un plan a un negocio desde /admin. */
export function PlanDialog({
  businessId,
  businessName,
  currentPlan,
  expiresLabel,
}: {
  businessId: string
  businessName: string
  currentPlan: Plan
  expiresLabel: string | null
}) {
  const [open, setOpen] = React.useState(false)
  const [plan, setPlan] = React.useState<Plan>(currentPlan === "FREE" ? "PRO" : currentPlan)
  const [days, setDays] = React.useState<number | null>(30)
  const [notify, setNotify] = React.useState(true)
  const [pending, startTransition] = React.useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const r = await setBusinessPlan({ businessId, plan, days, notify })
      if (!r.ok) return void toast.error(r.message)
      toast.success(r.message ?? "Listo")
      setOpen(false)
    })
  }

  const currentLabel = PLAN_OPTIONS.find((p) => p.value === currentPlan)?.label

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Crown />
        Plan
      </Button>
      <AppModal
        open={open}
        onOpenChange={setOpen}
        title={`Plan de ${businessName}`}
        description={
          currentPlan === "FREE"
            ? "Hoy está en el plan Gratis."
            : `Hoy tiene el plan ${currentLabel}${expiresLabel ? `, vence el ${expiresLabel}` : ", sin vencimiento"}.`
        }
      >
        <form onSubmit={submit} className="grid gap-5">
          <Field label="Nuevo plan">
            <ChoiceChips options={PLAN_OPTIONS} value={plan} onChange={setPlan} />
          </Field>
          {plan !== "FREE" ? (
            <>
              <Field label="¿Por cuánto tiempo?" hint="Se cuenta desde hoy. Al vencer, el negocio vuelve solo al plan Gratis.">
                <ChoiceChips options={DURATIONS} value={days} onChange={setDays} />
              </Field>
              <div className="flex items-center gap-2">
                <Checkbox id={`notify-${businessId}`} checked={notify} onCheckedChange={(v) => setNotify(v === true)} />
                <Label htmlFor={`notify-${businessId}`} className="font-normal">
                  Avisarle por correo al dueño
                </Label>
              </div>
            </>
          ) : (
            <p className="rounded-xl bg-muted px-4 py-3 text-sm">
              El negocio quedará en el plan Gratis desde ahora. Sus datos no se borran.
            </p>
          )}
          <Button type="submit" size="lg" className="h-11 text-base" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {plan === "FREE" ? "Pasar a Gratis" : "Guardar plan"}
          </Button>
        </form>
      </AppModal>
    </>
  )
}
