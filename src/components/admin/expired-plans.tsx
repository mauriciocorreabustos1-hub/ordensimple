"use client"

import * as React from "react"
import Link from "next/link"
import { BellRing, FlaskConical, Loader2, Mail, Send, TicketPercent } from "lucide-react"
import { toast } from "sonner"
import { PlanDialog } from "@/components/admin/plan-dialog"
import { Field } from "@/components/app/field"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { sendExpiredPlanEmails, sendExpiredPlanTest } from "@/server/actions/expired-plans"

export type ExpiredRow = {
  id: string
  name: string
  planName: string
  expiredLabel: string
  expiredAgo: string
  /** Días desde que venció (para ordenar y destacar los recientes). */
  expiredDays: number
  owner: { id: string; name: string; email: string; optIn: boolean } | null
  activity: string
  /** ¿Vendió en los últimos 14 días? Sigue usando la app aunque el plan venció. */
  active: boolean
  lastNotice: { label: string; kind: "aviso" | "oferta"; coupon: string | null } | null
  /** Recibió un correo hace menos de 7 días: no se le vuelve a escribir todavía. */
  cooling: boolean
}

type Kind = "aviso" | "oferta"

const TEMPLATES: Record<Kind, { subject: string; body: string; button: string }> = {
  aviso: {
    subject: "Tu plan {plan} de OrdenSimple venció",
    body:
      "Hola, {nombre}:\n\nTe escribimos porque el plan {plan} de {negocio} venció el {fecha}. Tus ventas, productos y clientes siguen guardados, pero las funciones {plan} quedaron en pausa: tienda online, cierre de caja, reportes de cualquier fecha y más.\n\nPuedes volver cuando quieras, en un par de minutos.",
    button: "Volver a {plan}",
  },
  oferta: {
    subject: "{nombre}, vuelve a {plan} con un descuento",
    body:
      "Hola, {nombre}:\n\nExtrañamos a {negocio} en el plan {plan}. Para que vuelvas a tener tu tienda online, el cierre de caja y todos tus reportes, te dejamos un código de descuento.\n\nCanjéalo en Configuración, sección Tu plan, o con el botón de abajo.",
    button: "Usar mi código",
  },
}

/**
 * Planes vencidos: a quién se le venció, si sigue vendiendo y qué se le mandó. Desde aquí se le recuerda, se le ofrece
 * un descuento o se le regalan días. `autoOpen` abre el correo con todos los elegibles marcados (desde "Qué revisar").
 */
export function ExpiredPlans({ rows, coupons, autoOpen }: { rows: ExpiredRow[]; coupons: { code: string; summary: string }[]; autoOpen?: Kind | null }) {
  const eligible = React.useMemo(() => rows.filter((r) => r.owner && !r.cooling).map((r) => r.id), [rows])
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set(eligible))
  const [compose, setCompose] = React.useState<Kind | null>(autoOpen ?? null)
  const all = eligible.length > 0 && eligible.every((id) => selected.has(id))
  const chosen = rows.filter((r) => selected.has(r.id))
  const optIn = chosen.filter((r) => r.owner?.optIn).length

  if (!rows.length) {
    return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No hay planes vencidos. Cuando a alguien se le venza, aparecerá aquí para que le escribas.</p>
  }

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="space-y-3">
      {/* Barra de acciones: queda a mano mientras se recorre la lista. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-muted/40 px-3 py-2.5">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={all} onCheckedChange={(v) => setSelected(v ? new Set(eligible) : new Set())} aria-label="Elegir todos los que se pueden contactar" />
          <span>
            <span className="font-medium tabular-nums">{chosen.length}</span> de {rows.length} elegidos
            <span className="text-muted-foreground"> · {optIn} aceptan ofertas</span>
          </span>
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={!chosen.length} onClick={() => setCompose("aviso")}>
            <BellRing /> Recordar
          </Button>
          <Button size="sm" disabled={!chosen.length || !optIn} onClick={() => setCompose("oferta")} title={!optIn && chosen.length ? "Ninguno de los elegidos acepta ofertas" : undefined}>
            <TicketPercent /> Ofrecer descuento
          </Button>
        </div>
      </div>

      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {rows.map((r) => (
          <li key={r.id} className={cn("grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 px-3 py-3 sm:px-4 md:grid-cols-[auto_minmax(0,1.3fr)_minmax(0,1fr)_auto] md:items-center", r.cooling && "bg-muted/30")}>
            <Checkbox
              checked={selected.has(r.id)}
              onCheckedChange={() => toggle(r.id)}
              disabled={!r.owner}
              aria-label={`Elegir ${r.name}`}
              className="mt-0.5 md:mt-0"
            />
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="truncate font-medium">{r.name}</span>
                <Badge variant="outline" className="border-warning/40 text-warning">
                  {r.planName} venció {r.expiredAgo}
                </Badge>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {r.owner ? (
                  <Link href={`/admin/usuarios/${r.owner.id}`} className="hover:text-foreground hover:underline">
                    {r.owner.name} · {r.owner.email}
                  </Link>
                ) : (
                  "Sin dueño"
                )}
                {" · "}el {r.expiredLabel}
              </p>
            </div>
            <div className="col-start-2 min-w-0 space-y-0.5 text-xs md:col-start-auto">
              <p className={cn(r.active ? "text-success" : "text-muted-foreground")}>{r.activity}</p>
              <p className="text-muted-foreground">
                {r.lastNotice ? (
                  <>
                    {r.lastNotice.kind === "oferta" ? `Oferta${r.lastNotice.coupon ? ` (${r.lastNotice.coupon})` : ""}` : "Recordatorio"} {r.lastNotice.label}
                    {r.cooling ? " · espera unos días para volver a escribirle" : ""}
                  </>
                ) : (
                  "Todavía no le escribes"
                )}
                {r.owner && !r.owner.optIn ? " · no recibe ofertas" : ""}
              </p>
            </div>
            <div className="col-start-2 flex flex-wrap gap-2 md:col-start-auto md:justify-end">
              <PlanDialog businessId={r.id} businessName={r.name} currentPlan="FREE" expiresLabel={null} />
              {r.owner ? (
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/admin?para=${r.owner.id}#correo-directo`} aria-label={`Escribirle a ${r.owner.name}`}>
                    <Mail /> Escribirle
                  </Link>
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        El recordatorio es un aviso sobre su cuenta y le llega a todos. La oferta es una promoción: solo le llega a quien aceptó recibir ofertas. A nadie se le escribe más de una
        vez cada 7 días. Para darle más tiempo sin cobrar, usa Plan y regálale días.
      </p>

      <Composer kind={compose} onClose={() => setCompose(null)} ids={chosen.map((r) => r.id)} count={chosen.length} optIn={optIn} coupons={coupons} />
    </div>
  )
}

function Composer({
  kind,
  onClose,
  ids,
  count,
  optIn,
  coupons,
}: {
  kind: Kind | null
  onClose: () => void
  ids: string[]
  count: number
  optIn: number
  coupons: { code: string; summary: string }[]
}) {
  const open = kind !== null
  const k = kind ?? "aviso"
  const [subject, setSubject] = React.useState(TEMPLATES[k].subject)
  const [body, setBody] = React.useState(TEMPLATES[k].body)
  const [button, setButton] = React.useState(TEMPLATES[k].button)
  const [coupon, setCoupon] = React.useState(coupons[0]?.code ?? "")
  const [pending, setPending] = React.useState<"test" | "send" | null>(null)
  // Al cambiar de recordatorio a oferta, vuelve el texto sugerido de cada uno.
  const [shownKind, setShownKind] = React.useState(k)
  if (shownKind !== k) {
    setShownKind(k)
    setSubject(TEMPLATES[k].subject)
    setBody(TEMPLATES[k].body)
    setButton(TEMPLATES[k].button)
  }

  const input = { businessIds: ids, kind: k, subject, body, buttonLabel: button, couponCode: k === "oferta" ? coupon : undefined }
  const run = async (mode: "test" | "send") => {
    setPending(mode)
    try {
      const r = mode === "test" ? await sendExpiredPlanTest(input) : await sendExpiredPlanEmails(input)
      if (r.ok) {
        toast.success(r.message)
        if (mode === "send") onClose()
      } else toast.error(r.message)
    } finally {
      setPending(null)
    }
  }
  const reach = k === "oferta" ? optIn : count

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {k === "oferta" ? <TicketPercent className="size-5 text-primary" /> : <BellRing className="size-5 text-primary" />}
            {k === "oferta" ? "Ofrecer un descuento" : "Recordar que el plan venció"}
          </DialogTitle>
          <DialogDescription>
            Le llegará a {reach} {reach === 1 ? "persona" : "personas"}
            {k === "oferta" && count > optIn ? ` (${count - optIn} no aceptan ofertas y se omiten)` : ""}. Puedes usar {"{nombre}"}, {"{negocio}"}, {"{plan}"} y {"{fecha}"}.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {k === "oferta" ? (
            coupons.length ? (
              <Field label="Código de descuento" htmlFor="exp-coupon">
                <select
                  id="exp-coupon"
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  className="h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {coupons.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} · {c.summary}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm">
                No tienes códigos activos. Crea uno en esta misma sección, en “Códigos de descuento” (por ejemplo, 30 días gratis del plan Pro), y vuelve aquí.
              </p>
            )
          ) : null}
          <Field label="Asunto" htmlFor="exp-subject">
            <Input id="exp-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} />
          </Field>
          <Field label="Mensaje" htmlFor="exp-body" hint="Deja una línea en blanco entre párrafos.">
            <Textarea id="exp-body" value={body} onChange={(e) => setBody(e.target.value)} rows={8} maxLength={5000} />
          </Field>
          <Field label="Texto del botón" htmlFor="exp-button" hint={k === "oferta" ? "Lleva a Tu plan con el código ya escrito." : "Lleva a Tu plan, listo para contratar."}>
            <Input id="exp-button" value={button} onChange={(e) => setButton(e.target.value)} maxLength={40} />
          </Field>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => run("test")} disabled={pending !== null || !count || (k === "oferta" && !coupon)}>
            {pending === "test" ? <Loader2 className="animate-spin" /> : <FlaskConical />} Enviarme una prueba
          </Button>
          <Button onClick={() => run("send")} disabled={pending !== null || !reach || (k === "oferta" && !coupon)}>
            {pending === "send" ? <Loader2 className="animate-spin" /> : <Send />} Enviar a {reach}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
