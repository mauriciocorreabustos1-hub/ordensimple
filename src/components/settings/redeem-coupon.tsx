"use client"

import * as React from "react"
import { Loader2, TicketPercent } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { redeemCoupon } from "@/server/actions/plan"

/** "¿Tienes un código?" en Configuración → Tu plan. */
export function RedeemCoupon() {
  const [code, setCode] = React.useState("")
  const [error, setError] = React.useState<string | undefined>()
  const [pending, startTransition] = React.useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return setError("Escribe tu código")
    startTransition(async () => {
      const r = await redeemCoupon(code)
      if (!r.ok) return setError(r.message)
      setError(undefined)
      setCode("")
      toast.success(r.message ?? "Código canjeado")
    })
  }

  return (
    <form onSubmit={submit} className="grid gap-1.5">
      <label htmlFor="coupon-code" className="text-sm font-medium">
        ¿Tienes un código de descuento?
      </label>
      <div className="flex gap-2">
        <Input
          id="coupon-code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase().replace(/\s/g, ""))
            setError(undefined)
          }}
          placeholder="EJEMPLO30"
          maxLength={30}
          autoComplete="off"
          aria-invalid={Boolean(error)}
          className="h-10 max-w-56 font-mono uppercase"
        />
        <Button type="submit" variant="outline" size="lg" className="h-10" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <TicketPercent />}
          Canjear
        </Button>
      </div>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  )
}
