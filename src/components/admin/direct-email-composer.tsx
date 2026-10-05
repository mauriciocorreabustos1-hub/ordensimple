"use client"

import * as React from "react"
import { FlaskConical, Loader2, Search, Send, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field } from "@/components/app/field"
import { searchUsersForEmail, sendDirectEmail, sendTestDirectEmail, type DirectEmailInput } from "@/server/actions/admin"

export type Recipient = { id: string; name: string; email: string; marketingOptIn: boolean }

const MAX = 50

/** Correo a personas específicas: avisos, respuestas o una promoción solo para algunos. */
export function DirectEmailComposer({ appUrl, initial = [] }: { appUrl: string; initial?: Recipient[] }) {
  const [selected, setSelected] = React.useState<Recipient[]>(initial)
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<Recipient[]>([])
  const [searching, setSearching] = React.useState(false)
  const [promo, setPromo] = React.useState(false)
  const [subject, setSubject] = React.useState("")
  const [body, setBody] = React.useState("")
  const [buttonLabel, setButtonLabel] = React.useState("")
  const [buttonUrl, setButtonUrl] = React.useState("")
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({})
  const [pending, setPending] = React.useState<"test" | "send" | null>(null)

  // Búsqueda con una pequeña espera para no consultar en cada tecla; solo vale la respuesta más reciente.
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = React.useRef(0)
  function search(value: string) {
    setQuery(value)
    if (timer.current) clearTimeout(timer.current)
    const term = value.trim()
    const id = ++latest.current
    if (term.length < 2) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    timer.current = setTimeout(async () => {
      const rows = await searchUsersForEmail(term).catch(() => [])
      if (id === latest.current) {
        setResults(rows)
        setSearching(false)
      }
    }, 250)
  }

  function add(u: Recipient) {
    if (selected.some((s) => s.id === u.id)) return
    if (selected.length >= MAX) return void toast.error(`Máximo ${MAX} personas por envío`)
    setSelected([...selected, u])
    search("")
  }

  const reachable = promo ? selected.filter((s) => s.marketingOptIn) : selected
  const skipped = selected.length - reachable.length

  const input = (): DirectEmailInput => ({
    userIds: selected.map((s) => s.id),
    subject,
    body,
    promo,
    buttonLabel: buttonLabel.trim() || undefined,
    buttonUrl: buttonUrl.trim() || undefined,
  })

  async function run(kind: "test" | "send") {
    if (kind === "send") {
      const who = reachable.length === 1 ? reachable[0].email : `${reachable.length} personas`
      if (!window.confirm(`¿Enviar "${subject}" a ${who}? Esto no se puede deshacer.`)) return
    }
    setPending(kind)
    try {
      const r = kind === "test" ? await sendTestDirectEmail(input()) : await sendDirectEmail(input())
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {})
        toast.error(r.message)
        return
      }
      setErrors({})
      toast.success(r.message ?? "Listo")
      if (kind === "send") {
        setSelected([])
        setSubject("")
        setBody("")
      }
    } finally {
      setPending(null)
    }
  }

  return (
    <form
      id="correo-directo"
      className="grid scroll-mt-20 gap-5 rounded-xl border bg-card p-4 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault()
        void run("send")
      }}
    >
      <Field label="¿A quién?" hint={`Busca por nombre o correo. Hasta ${MAX} personas.`} error={errors.userIds?.[0]}>
        <div className="space-y-2">
          {selected.length ? (
            <div className="flex flex-wrap gap-2">
              {selected.map((s) => (
                <span
                  key={s.id}
                  className={`inline-flex max-w-full items-center gap-1.5 rounded-full border py-1 pr-1 pl-3 text-sm ${promo && !s.marketingOptIn ? "border-dashed text-muted-foreground line-through" : "bg-accent/50"}`}
                  title={promo && !s.marketingOptIn ? "No acepta ofertas: no le llegará una promoción" : s.email}
                >
                  <span className="truncate">{s.name}</span>
                  <span className="hidden truncate text-xs text-muted-foreground sm:inline">{s.email}</span>
                  <button
                    type="button"
                    onClick={() => setSelected(selected.filter((x) => x.id !== s.id))}
                    className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={`Quitar a ${s.name}`}
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => search(e.target.value)}
              placeholder="Ej: juan o juan@gmail.com"
              className="h-10 pl-9"
              aria-label="Buscar persona"
            />
            {searching ? <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" /> : null}
          </div>
          {results.length ? (
            <ul className="divide-y overflow-hidden rounded-xl border">
              {results.map((u) => {
                const already = selected.some((s) => s.id === u.id)
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => add(u)}
                      disabled={already}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted disabled:opacity-50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{u.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {already ? "Agregada" : u.marketingOptIn ? "Agregar" : "Agregar · no acepta ofertas"}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : query.trim().length >= 2 && !searching ? (
            <p className="text-xs text-muted-foreground">No encontramos a nadie con “{query.trim()}”.</p>
          ) : null}
        </div>
      </Field>

      <label htmlFor="de-promo" className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm">
        <Checkbox id="de-promo" checked={promo} onCheckedChange={(v) => setPromo(v === true)} className="mt-0.5" />
        <span className="space-y-0.5">
          <span className="block font-medium">Es una promoción</span>
          <span className="block text-xs text-muted-foreground">
            Márcalo si ofreces algo (descuentos, planes). Solo les llega a quienes aceptaron recibir ofertas y trae el enlace
            para darse de baja. Déjalo sin marcar para avisos o respuestas sobre su cuenta.
          </span>
        </span>
      </label>

      <Field label="Asunto" htmlFor="de-subject" error={errors.subject?.[0]}>
        <Input id="de-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} className="h-10" />
      </Field>

      <Field
        label="Mensaje"
        htmlFor="de-body"
        error={errors.body?.[0]}
        hint="Deja una línea en blanco para separar párrafos. {nombre} se reemplaza por el nombre de cada persona."
      >
        <Textarea
          id="de-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={5000}
          rows={7}
          placeholder={"Hola {nombre},\n\nTe escribimos porque…"}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
        <Field label="Texto del botón" htmlFor="de-btn" optional>
          <Input id="de-btn" value={buttonLabel} onChange={(e) => setButtonLabel(e.target.value)} maxLength={40} className="h-10" placeholder="Ir a OrdenSimple" />
        </Field>
        <Field label="Enlace del botón" htmlFor="de-url" optional error={errors.buttonUrl?.[0]}>
          <Input id="de-url" type="url" value={buttonUrl} onChange={(e) => setButtonUrl(e.target.value)} maxLength={500} className="h-10" placeholder={`${appUrl}/dashboard`} />
        </Field>
      </div>

      {promo && skipped > 0 ? (
        <p className="rounded-lg bg-warning/10 p-3 text-xs">
          {skipped === 1 ? "1 persona no acepta" : `${skipped} personas no aceptan`} ofertas: no le{skipped === 1 ? "" : "s"} llegará este correo.
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" size="lg" className="h-10" disabled={pending !== null} onClick={() => void run("test")}>
          {pending === "test" ? <Loader2 className="animate-spin" /> : <FlaskConical />}
          Enviarme una prueba
        </Button>
        <Button type="submit" size="lg" className="h-10" disabled={pending !== null || reachable.length === 0}>
          {pending === "send" ? <Loader2 className="animate-spin" /> : <Send />}
          {reachable.length === 1 ? "Enviar a 1 persona" : `Enviar a ${reachable.length} personas`}
        </Button>
      </div>
    </form>
  )
}
