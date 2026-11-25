"use client"

import * as React from "react"
import { BellRing, FlaskConical, Loader2, Send } from "lucide-react"
import { toast } from "sonner"
import { Field } from "@/components/app/field"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { sendSalesReminders, sendSalesReminderTest } from "@/server/actions/sales-reminders"

export type Segment = "configurar" | "primera" | "volver"

export type SegmentCard = {
  key: Segment
  label: string
  hint: string
  count: number
  sample: string[]
  skipped: { cooling: number; noTips: number; series: number }
}

/** Texto sugerido de cada grupo: se puede cambiar antes de enviar. */
const TEMPLATES: Record<Segment, { subject: string; body: string; button: string; where: string }> = {
  configurar: {
    subject: "{nombre}, te falta un paso para ordenar tu negocio",
    body: "Hola, {nombre}:\n\nCreaste tu cuenta en OrdenSimple, pero todavía no configuras tu negocio. Son 2 minutos: el nombre, el rubro y listo.\n\nDespués anotas tus ventas y gastos desde el celular y ves cuánto te queda cada día.",
    button: "Configurar mi negocio",
    where: "Lleva a configurar el negocio.",
  },
  primera: {
    subject: "{nombre}, anota tu primera venta en 10 segundos",
    body: "Hola, {nombre}:\n\n{negocio} ya está listo en OrdenSimple. Falta lo más importante: anotar tu primera venta.\n\nToca el botón, escribe el monto y elige cómo te pagaron. No necesitas cargar productos antes.",
    button: "Anotar mi primera venta",
    where: "Abre directo Registrar venta.",
  },
  volver: {
    subject: "{nombre}, ¿cómo van las ventas de {negocio}?",
    body: "Hola, {nombre}:\n\nHace {dias} días que no anotas ventas en {negocio}. Si vendiste, anótalas ahora: puedes registrar el total del día como una sola venta.\n\nAsí tus números quedan al día y sabes cuánto te quedó este mes.",
    button: "Anotar una venta",
    where: "Abre directo Registrar venta.",
  },
}

/** Recordatorios para que anoten ventas, por grupo. `autoOpen` abre el de un grupo al llegar (desde "Qué revisar"). */
export function SalesReminders({ segments, autoOpen }: { segments: SegmentCard[]; autoOpen?: Segment | null }) {
  const [open, setOpen] = React.useState<Segment | null>(autoOpen ?? null)
  const current = segments.find((s) => s.key === open)
  return (
    <div className="space-y-3">
      <ul className="grid gap-3 md:grid-cols-3">
        {segments.map((s) => {
          const skipped = s.skipped.cooling + s.skipped.noTips + s.skipped.series
          return (
            <li key={s.key} className="flex flex-col rounded-xl border bg-card p-4">
              <p className="text-sm font-semibold">{s.label}</p>
              <p className="text-xs text-muted-foreground">{s.hint}</p>
              <p className="mt-3 flex items-baseline gap-1.5">
                <span className="font-display text-3xl font-semibold tabular-nums">{s.count}</span>
                <span className="text-sm text-muted-foreground">{s.count === 1 ? "persona para escribirle hoy" : "personas para escribirles hoy"}</span>
              </p>
              {s.sample.length ? (
                <p className="mt-1 truncate text-xs text-muted-foreground" title={s.sample.join(", ")}>
                  {s.sample.join(", ")}
                  {s.count > s.sample.length ? ` y ${s.count - s.sample.length} más` : ""}
                </p>
              ) : null}
              {skipped ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Se omiten{" "}
                  {[
                    s.skipped.cooling ? `${s.skipped.cooling} con un recordatorio reciente` : null,
                    s.skipped.series ? `${s.skipped.series} en la serie de bienvenida` : null,
                    s.skipped.noTips ? `${s.skipped.noTips} que no quieren consejos` : null,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                  .
                </p>
              ) : null}
              <div className="mt-auto pt-4">
                <Button className="w-full" variant={s.count ? "default" : "outline"} disabled={!s.count} onClick={() => setOpen(s.key)}>
                  <BellRing /> Escribir recordatorio
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        Es un consejo, como la serie de bienvenida: trae el enlace para no recibir más. A nadie se le escribe más de una vez cada 7 días, y como máximo 80 por envío para no pasar tu
        límite diario de correos.
      </p>
      <ReminderComposer segment={open} count={current?.count ?? 0} onClose={() => setOpen(null)} />
    </div>
  )
}

/** Botón "Recordarle" de una persona en Usuarios: abre el mismo correo, solo para ella. */
export function RemindUserButton({ userId, name, segment }: { userId: string; name: string; segment: Segment }) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} aria-label={`Recordarle a ${name} que anote ventas`}>
        <BellRing /> Recordarle
      </Button>
      <ReminderComposer segment={open ? segment : null} count={1} userIds={[userId]} who={name} onClose={() => setOpen(false)} />
    </>
  )
}

function ReminderComposer({ segment, count, userIds, who, onClose }: { segment: Segment | null; count: number; userIds?: string[]; who?: string; onClose: () => void }) {
  const k = segment ?? "primera"
  const [subject, setSubject] = React.useState(TEMPLATES[k].subject)
  const [body, setBody] = React.useState(TEMPLATES[k].body)
  const [button, setButton] = React.useState(TEMPLATES[k].button)
  const [pending, setPending] = React.useState<"test" | "send" | null>(null)
  // Al abrir otro grupo, vuelve su texto sugerido.
  const [shown, setShown] = React.useState(k)
  if (shown !== k) {
    setShown(k)
    setSubject(TEMPLATES[k].subject)
    setBody(TEMPLATES[k].body)
    setButton(TEMPLATES[k].button)
  }
  const input = { segment: k, subject, body, buttonLabel: button, userIds }
  const run = async (mode: "test" | "send") => {
    setPending(mode)
    try {
      const r = mode === "test" ? await sendSalesReminderTest(input) : await sendSalesReminders(input)
      if (r.ok) {
        toast.success(r.message)
        if (mode === "send") onClose()
      } else toast.error(r.message)
    } finally {
      setPending(null)
    }
  }
  const reach = Math.min(count, 80)

  return (
    <Dialog open={segment !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="size-5 text-primary" />
            {who ? `Recordarle a ${who}` : k === "configurar" ? "Recordar que configuren su negocio" : k === "primera" ? "Recordar la primera venta" : "Recordar que vuelvan a anotar"}
          </DialogTitle>
          <DialogDescription>
            {who ? "Le llegará solo a esta persona." : `Le llegará a ${reach} ${reach === 1 ? "persona" : "personas"}${count > 80 ? ` (las ${count - 80} restantes, otro día)` : ""}.`} Puedes usar {"{nombre}"}
            {k !== "configurar" ? <>, {"{negocio}"}</> : null}
            {k === "volver" ? <> y {"{dias}"}</> : null}.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          <Field label="Asunto" htmlFor="rec-subject">
            <Input id="rec-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} />
          </Field>
          <Field label="Mensaje" htmlFor="rec-body" hint="Deja una línea en blanco entre párrafos.">
            <Textarea id="rec-body" value={body} onChange={(e) => setBody(e.target.value)} rows={7} maxLength={5000} />
          </Field>
          <Field label="Texto del botón" htmlFor="rec-button" hint={TEMPLATES[k].where}>
            <Input id="rec-button" value={button} onChange={(e) => setButton(e.target.value)} maxLength={40} />
          </Field>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => run("test")} disabled={pending !== null}>
            {pending === "test" ? <Loader2 className="animate-spin" /> : <FlaskConical />} Enviarme una prueba
          </Button>
          <Button onClick={() => run("send")} disabled={pending !== null || !count}>
            {pending === "send" ? <Loader2 className="animate-spin" /> : <Send />} {who ? "Enviar" : `Enviar a ${reach}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
