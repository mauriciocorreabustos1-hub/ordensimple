"use client"

import * as React from "react"
import { Check, FlaskConical, Loader2, Send } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field } from "@/components/app/field"
import { ChoiceChips } from "@/components/admin/choice-chips"
import { cn } from "@/lib/utils"
import { previewCampaignAudience, sendCampaign, sendTestCampaign, type CampaignInput } from "@/server/actions/admin"

type Audience = CampaignInput["audience"]

export function CampaignComposer({
  audiences,
  rubros: rubroOptions,
  coupons,
  appUrl,
}: {
  audiences: { value: Audience; label: string; count: number }[]
  /** Rubros para filtrar, con cuántas personas (que aceptan ofertas) hay en cada uno. */
  rubros: { value: string; count: number }[]
  coupons: { code: string; summary: string }[]
  appUrl: string
}) {
  const [audience, setAudience] = React.useState<Audience>("ALL")
  const [rubros, setRubros] = React.useState<string[]>([])
  // Con rubros elegidos, el total se pide al servidor (se cruza con el plan).
  const [filteredCount, setFilteredCount] = React.useState<number | null>(null)
  React.useEffect(() => {
    if (!rubros.length) return
    let cancelled = false
    const t = setTimeout(async () => {
      const r = await previewCampaignAudience({ audience, rubros })
      if (!cancelled && r.ok && r.data) setFilteredCount(r.data.count)
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [audience, rubros])
  const toggleRubro = (r: string) => {
    setFilteredCount(null)
    setRubros((list) => (list.includes(r) ? list.filter((x) => x !== r) : [...list, r]))
  }
  const [subject, setSubject] = React.useState("")
  const [body, setBody] = React.useState("")
  const [couponCode, setCouponCode] = React.useState<string>("")
  const [buttonLabel, setButtonLabel] = React.useState("Ir a OrdenSimple")
  const [buttonUrl, setButtonUrl] = React.useState(`${appUrl}/dashboard`)
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({})
  const [pending, setPending] = React.useState<"test" | "send" | null>(null)

  const count = rubros.length ? (filteredCount ?? 0) : (audiences.find((a) => a.value === audience)?.count ?? 0)
  const counting = rubros.length > 0 && filteredCount === null
  const input = (): CampaignInput => ({
    audience,
    rubros,
    subject,
    body,
    couponCode: couponCode || undefined,
    buttonLabel: buttonLabel.trim() || undefined,
    buttonUrl: buttonUrl.trim() || undefined,
  })

  async function run(kind: "test" | "send") {
    if (kind === "send") {
      const ok = window.confirm(
        `¿Enviar "${subject}" a ${count} persona${count === 1 ? "" : "s"}${rubros.length ? ` (rubros: ${rubros.join(", ")})` : ""}? Esto no se puede deshacer.`,
      )
      if (!ok) return
    }
    setPending(kind)
    try {
      const r = kind === "test" ? await sendTestCampaign(input()) : await sendCampaign(input())
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {})
        toast.error(r.message)
        return
      }
      setErrors({})
      toast.success(r.message ?? "Listo")
      if (kind === "send") {
        setSubject("")
        setBody("")
        setCouponCode("")
      }
    } finally {
      setPending(null)
    }
  }

  return (
    <form
      className="grid gap-5 rounded-xl border bg-card p-4 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault()
        void run("send")
      }}
    >
      <Field label="¿A quién?" hint="Solo se envía a personas que aceptaron recibir ofertas. Cada correo trae un enlace para darse de baja.">
        <ChoiceChips
          options={audiences.map((a) => ({ value: a.value, label: `${a.label} (${a.count})` }))}
          value={audience}
          onChange={(a) => {
            setFilteredCount(null)
            setAudience(a)
          }}
        />
      </Field>

      <Field label="¿De qué rubro?" optional hint="Puedes marcar varios. Sin marcar ninguno, se envía a todos los rubros.">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Rubros">
          <button
            type="button"
            aria-pressed={rubros.length === 0}
            onClick={() => {
              setFilteredCount(null)
              setRubros([])
            }}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition-colors",
              rubros.length === 0 ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-muted",
            )}
          >
            Todos los rubros
          </button>
          {rubroOptions.map((r) => {
            const on = rubros.includes(r.value)
            return (
              <button
                key={r.value}
                type="button"
                aria-pressed={on}
                onClick={() => toggleRubro(r.value)}
                className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors", on ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-muted")}
              >
                {on ? <Check className="size-3.5" /> : null}
                {r.value === "Otro" ? "Otro (escrito a mano)" : r.value} ({r.count})
              </button>
            )
          })}
        </div>
      </Field>

      <Field label="Asunto" htmlFor="cm-subject" error={errors.subject?.[0]} hint="Corto y claro. Ej.: {nombre}, este mes Pro te sale gratis 🎁">
        <Input id="cm-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} className="h-10" />
      </Field>

      <Field
        label="Mensaje"
        htmlFor="cm-body"
        error={errors.body?.[0]}
        hint="Deja una línea en blanco para separar párrafos. Escribe {nombre} y se reemplaza por el nombre de cada persona."
      >
        <Textarea
          id="cm-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={5000}
          rows={8}
          placeholder={"Hola {nombre},\n\nQueremos agradecerte por usar OrdenSimple…"}
        />
      </Field>

      {coupons.length ? (
        <Field label="Incluir un código de descuento" optional hint="Aparece destacado en el correo.">
          <ChoiceChips
            options={[{ value: "", label: "Ninguno" }, ...coupons.map((c) => ({ value: c.code, label: `${c.code} · ${c.summary}` }))]}
            value={couponCode}
            onChange={setCouponCode}
          />
        </Field>
      ) : (
        <p className="text-xs text-muted-foreground">Si creas un código de descuento más abajo, podrás incluirlo en el correo.</p>
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
        <Field label="Texto del botón" htmlFor="cm-btn" optional>
          <Input id="cm-btn" value={buttonLabel} onChange={(e) => setButtonLabel(e.target.value)} maxLength={40} className="h-10" />
        </Field>
        <Field label="Enlace del botón" htmlFor="cm-url" optional error={errors.buttonUrl?.[0]}>
          <Input id="cm-url" type="url" value={buttonUrl} onChange={(e) => setButtonUrl(e.target.value)} maxLength={500} className="h-10" />
        </Field>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" size="lg" className="h-10" disabled={pending !== null} onClick={() => void run("test")}>
          {pending === "test" ? <Loader2 className="animate-spin" /> : <FlaskConical />}
          Enviarme una prueba
        </Button>
        <Button type="submit" size="lg" className="h-10" disabled={pending !== null || counting || count === 0}>
          {pending === "send" || counting ? <Loader2 className="animate-spin" /> : <Send />}
          {counting ? "Contando…" : `Enviar a ${count} persona${count === 1 ? "" : "s"}`}
        </Button>
      </div>
    </form>
  )
}
