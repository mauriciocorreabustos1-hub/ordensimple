"use client"

import * as React from "react"
import { Copy, Loader2, Pause, Play, Plus, Shuffle, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AppModal } from "@/components/app/app-modal"
import { Field } from "@/components/app/field"
import { ChoiceChips } from "@/components/admin/choice-chips"
import { createCoupon, deleteCoupon, toggleCoupon, type CouponInput } from "@/server/actions/admin"

export type CouponRow = {
  id: string
  code: string
  summary: string
  maxRedemptions: number | null
  uses: number
  expiresLabel: string | null
  expired: boolean
  active: boolean
  note: string | null
}

// Sin letras ni números que se confundan (O/0, I/1).
function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}

function CreateCouponDialog() {
  const [open, setOpen] = React.useState(false)
  const [code, setCode] = React.useState("")
  const [kind, setKind] = React.useState<CouponInput["kind"]>("FREE_DAYS")
  const [plan, setPlan] = React.useState<CouponInput["plan"]>("PRO")
  const [days, setDays] = React.useState("30")
  const [percent, setPercent] = React.useState("20")
  const [maxUses, setMaxUses] = React.useState("")
  const [expiresAt, setExpiresAt] = React.useState("")
  const [note, setNote] = React.useState("")
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({})
  const [pending, startTransition] = React.useTransition()

  const int = (v: string) => (v.trim() ? Number.parseInt(v, 10) : null)

  function openDialog() {
    if (!code) setCode(randomCode())
    setErrors({})
    setOpen(true)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const r = await createCoupon({
        code,
        kind,
        plan,
        days: kind === "FREE_DAYS" ? int(days) : null,
        percentOff: kind === "PERCENT" ? int(percent) : null,
        maxRedemptions: int(maxUses),
        expiresAt: expiresAt || null,
        note,
      })
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {})
        return void toast.error(r.message)
      }
      toast.success(r.message ?? "Código creado")
      setOpen(false)
      setCode("")
      setNote("")
    })
  }

  return (
    <>
      <Button size="sm" onClick={openDialog}>
        <Plus />
        Crear código
      </Button>
      <AppModal open={open} onOpenChange={setOpen} title="Nuevo código" description="Compártelo por redes sociales, correo o WhatsApp.">
        <form onSubmit={submit} className="grid gap-5">
          <Field label="Código" htmlFor="cp-code" error={errors.code?.[0]} hint="Ej.: LANZAMIENTO, BIENVENIDA30, FERIA-2026">
            <div className="flex gap-2">
              <Input
                id="cp-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
                maxLength={30}
                className="h-10 font-mono uppercase"
              />
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-10"
                onClick={() => setCode(randomCode())}
                aria-label="Generar código al azar"
              >
                <Shuffle />
              </Button>
            </div>
          </Field>
          <Field label="¿Qué da el código?">
            <ChoiceChips
              options={[
                { value: "FREE_DAYS", label: "Días gratis" },
                { value: "PERCENT", label: "% de descuento" },
              ]}
              value={kind}
              onChange={setKind}
            />
          </Field>
          <Field label="Plan">
            <ChoiceChips
              options={[
                { value: "PRO", label: "Pro" },
                { value: "BUSINESS", label: "Empresa" },
              ]}
              value={plan}
              onChange={setPlan}
            />
          </Field>
          {kind === "FREE_DAYS" ? (
            <Field label="Días gratis" htmlFor="cp-days" error={errors.days?.[0]} hint="El plan se activa apenas canjean el código.">
              <Input
                id="cp-days"
                type="number"
                inputMode="numeric"
                min={1}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className="h-10"
              />
            </Field>
          ) : (
            <Field
              label="Porcentaje de descuento"
              htmlFor="cp-pct"
              error={errors.percentOff?.[0]}
              hint="Queda guardado en el negocio y se aplicará cuando empiece a pagar la suscripción."
            >
              <Input
                id="cp-pct"
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                className="h-10"
              />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Máximo de usos" htmlFor="cp-max" optional error={errors.maxRedemptions?.[0]}>
              <Input
                id="cp-max"
                type="number"
                inputMode="numeric"
                min={1}
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="Ilimitado"
                className="h-10"
              />
            </Field>
            <Field label="Válido hasta" htmlFor="cp-exp" optional>
              <Input id="cp-exp" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="h-10" />
            </Field>
          </div>
          <Field label="Nota interna" htmlFor="cp-note" optional hint="Solo la ves tú. Ej.: campaña Instagram octubre.">
            <Input id="cp-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className="h-10" />
          </Field>
          <Button type="submit" size="lg" className="h-11 text-base" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Crear código
          </Button>
        </form>
      </AppModal>
    </>
  )
}

function CouponActions({ coupon }: { coupon: CouponRow }) {
  const [pending, startTransition] = React.useTransition()
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      const r = await fn()
      if (r.ok) toast.success(r.message ?? "Listo")
      else toast.error(r.message ?? "No se pudo")
    })

  return (
    <div className="flex gap-1">
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Copiar código"
        onClick={() => {
          void navigator.clipboard?.writeText(coupon.code)
          toast.success(`Copiado: ${coupon.code}`)
        }}
      >
        <Copy />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        disabled={pending}
        aria-label={coupon.active ? "Pausar código" : "Activar código"}
        onClick={() => run(() => toggleCoupon(coupon.id, !coupon.active))}
      >
        {coupon.active ? <Pause /> : <Play />}
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        disabled={pending}
        aria-label="Eliminar código"
        className="text-destructive"
        onClick={() => {
          if (window.confirm(`¿Eliminar el código ${coupon.code}? Quienes ya lo usaron conservan lo que ganaron.`)) {
            run(() => deleteCoupon(coupon.id))
          }
        }}
      >
        {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
      </Button>
    </div>
  )
}

export function CouponManager({ coupons }: { coupons: CouponRow[] }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <CreateCouponDialog />
      </div>
      {coupons.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Aún no hay códigos. Crea uno para regalar días de Pro o guardar un descuento para cuando empieces a cobrar.
        </p>
      ) : (
        <ul className="grid gap-2">
          {coupons.map((c) => {
            const soldOut = c.maxRedemptions !== null && c.uses >= c.maxRedemptions
            const status = !c.active ? "Pausado" : c.expired ? "Vencido" : soldOut ? "Agotado" : "Activo"
            return (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-semibold">{c.code}</span>
                    <Badge variant="outline" className={status === "Activo" ? "border-success/30 bg-success/15 text-success" : "text-muted-foreground"}>
                      {status}
                    </Badge>
                  </p>
                  <p className="text-sm">{c.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.uses} uso{c.uses === 1 ? "" : "s"}
                    {c.maxRedemptions !== null ? ` de ${c.maxRedemptions}` : ""}
                    {c.expiresLabel ? ` · válido hasta el ${c.expiresLabel}` : " · sin fecha de término"}
                    {c.note ? ` · ${c.note}` : ""}
                  </p>
                </div>
                <CouponActions coupon={c} />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
