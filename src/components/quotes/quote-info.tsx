"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Building2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { AppModal } from "@/components/app/app-modal"
import { Field } from "@/components/app/field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { updateQuoteInfo } from "@/server/actions/quotes"

export type QuoteInfo = {
  taxId: string | null
  address: string | null
  contactPhone: string | null
  contactEmail: string | null
  quoteTerms: string | null
  quoteValidDays: number
}

/** Datos del negocio que salen en cada cotización. */
export function QuoteInfoButton({ info }: { info: QuoteInfo }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [v, setV] = React.useState(() => ({
    taxId: info.taxId ?? "",
    address: info.address ?? "",
    contactPhone: info.contactPhone ?? "",
    contactEmail: info.contactEmail ?? "",
    quoteTerms: info.quoteTerms ?? "",
    quoteValidDays: String(info.quoteValidDays),
  }))
  const [pending, startTransition] = React.useTransition()
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((x) => ({ ...x, [k]: e.target.value }))

  function save(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const r = await updateQuoteInfo({
        taxId: v.taxId,
        address: v.address,
        contactPhone: v.contactPhone,
        contactEmail: v.contactEmail,
        quoteTerms: v.quoteTerms,
        quoteValidDays: Number(v.quoteValidDays) || 0,
      })
      if (!r.ok) return void toast.error(r.message)
      toast.success(r.message)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Building2 />
        Datos del negocio
      </Button>
      <AppModal open={open} onOpenChange={setOpen} title="Datos en tus cotizaciones" description="Salen arriba de cada cotización, junto al nombre y logo de tu negocio." noAutoFocus>
        <form onSubmit={save} className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="RUT" htmlFor="qi-rut" optional>
              <Input id="qi-rut" value={v.taxId} onChange={set("taxId")} maxLength={20} placeholder="76.123.456-7" className="h-10" />
            </Field>
            <Field label="Teléfono" htmlFor="qi-phone" optional>
              <Input id="qi-phone" value={v.contactPhone} onChange={set("contactPhone")} maxLength={30} inputMode="tel" className="h-10" />
            </Field>
          </div>
          <Field label="Dirección" htmlFor="qi-address" optional>
            <Input id="qi-address" value={v.address} onChange={set("address")} maxLength={160} placeholder="Av. Principal 123, Santiago" className="h-10" />
          </Field>
          <Field label="Correo" htmlFor="qi-email" optional>
            <Input id="qi-email" type="email" value={v.contactEmail} onChange={set("contactEmail")} maxLength={120} className="h-10" />
          </Field>
          <Field label="Condiciones" htmlFor="qi-terms" optional hint="Van al pie de todas tus cotizaciones. Ej: forma de pago, plazo de entrega, garantía.">
            <Textarea id="qi-terms" value={v.quoteTerms} onChange={set("quoteTerms")} maxLength={600} rows={3} placeholder="50 % al aceptar y 50 % contra entrega. Entrega en 5 días hábiles." />
          </Field>
          <Field label="Validez de una cotización nueva (días)" htmlFor="qi-days">
            <Input id="qi-days" inputMode="numeric" value={v.quoteValidDays} onChange={(e) => setV((x) => ({ ...x, quoteValidDays: e.target.value.replace(/\D/g, "").slice(0, 3) }))} className="h-10 w-28" />
          </Field>
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Guardar
          </Button>
        </form>
      </AppModal>
    </>
  )
}
