"use client"

import * as React from "react"
import { Loader2, PackagePlus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AppModal } from "@/components/app/app-modal"
import { Field } from "@/components/app/field"
import { ChoiceChips } from "@/components/admin/choice-chips"
import { setBusinessExtras } from "@/server/actions/admin"

const PRODUCT_STEPS = [0, 50, 150, 450, 950]
const MEMBER_STEPS = [0, 1, 3, 5, 10]

/** Regalar productos o trabajadores extra a un negocio, sin cambiarle el plan. */
export function ExtrasDialog({
  businessId,
  businessName,
  planName,
  baseProducts,
  baseMembers,
  extraProducts,
  extraMembers,
}: {
  businessId: string
  businessName: string
  planName: string
  /** Lo que da su plan (null = sin límite). */
  baseProducts: number | null
  /** Trabajadores que da su plan, sin contar al dueño. */
  baseMembers: number
  extraProducts: number
  extraMembers: number
}) {
  const [open, setOpen] = React.useState(false)
  const [products, setProducts] = React.useState(String(extraProducts))
  const [members, setMembers] = React.useState(String(extraMembers))
  const [pending, startTransition] = React.useTransition()

  const p = Math.max(0, Math.floor(Number(products) || 0))
  const m = Math.max(0, Math.floor(Number(members) || 0))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const r = await setBusinessExtras({ businessId, extraProducts: p, extraMembers: m })
      if (!r.ok) return void toast.error(r.message)
      toast.success(r.message ?? "Listo")
      setOpen(false)
    })
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <PackagePlus />
        Cupos extra
      </Button>
      <AppModal
        open={open}
        onOpenChange={setOpen}
        title={`Cupos extra · ${businessName}`}
        description={`Se suman a lo que da su plan ${planName}, sin cambiarle el plan. Pon 0 para quitarlos.`}
      >
        <form onSubmit={submit} className="grid gap-5">
          <Field
            label="Productos extra"
            htmlFor="ex-products"
            hint={
              baseProducts === null
                ? "Su plan ya tiene productos ilimitados."
                : `Su plan permite ${baseProducts}. Con esto podrá tener ${baseProducts + p}.`
            }
          >
            <div className="space-y-2">
              <ChoiceChips
                options={PRODUCT_STEPS.map((n) => ({ value: n, label: n === 0 ? "Ninguno" : `+${n}` }))}
                value={PRODUCT_STEPS.includes(p) ? p : -1}
                onChange={(n) => setProducts(String(n))}
              />
              <Input id="ex-products" type="number" inputMode="numeric" min={0} max={100000} value={products} onChange={(e) => setProducts(e.target.value)} className="h-10" />
            </div>
          </Field>
          <Field
            label="Trabajadores extra"
            htmlFor="ex-members"
            hint={`Su plan permite ${baseMembers} trabajadores además del dueño. Con esto podrá tener ${baseMembers + m}.`}
          >
            <div className="space-y-2">
              <ChoiceChips
                options={MEMBER_STEPS.map((n) => ({ value: n, label: n === 0 ? "Ninguno" : `+${n}` }))}
                value={MEMBER_STEPS.includes(m) ? m : -1}
                onChange={(n) => setMembers(String(n))}
              />
              <Input id="ex-members" type="number" inputMode="numeric" min={0} max={1000} value={members} onChange={(e) => setMembers(e.target.value)} className="h-10" />
            </div>
          </Field>
          <Button type="submit" size="lg" className="h-11" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Guardar cupos
          </Button>
        </form>
      </AppModal>
    </>
  )
}
