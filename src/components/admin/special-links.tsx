"use client"

import * as React from "react"
import { Check, Copy, Loader2, Pause, Play, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AppModal } from "@/components/app/app-modal"
import { Field } from "@/components/app/field"
import { ChoiceChips } from "@/components/admin/choice-chips"
import { createSpecialLink, deleteSpecialLink, toggleSpecialLink, type SpecialLinkInput } from "@/server/actions/admin"

export type SpecialLinkRow = {
  id: string
  name: string
  code: string
  url: string
  gift: string
  expiresLabel: string | null
  expired: boolean
  maxUses: number | null
  active: boolean
  signups: number
  businesses: number
  paying: number
}

/** "Instagram Octubre" → "instagram-octubre" */
function slug(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
}

function CreateLinkDialog({ baseUrl }: { baseUrl: string }) {
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [code, setCode] = React.useState("")
  const [codeTouched, setCodeTouched] = React.useState(false)
  const [plan, setPlan] = React.useState<SpecialLinkInput["plan"]>("PRO")
  const [days, setDays] = React.useState("14")
  const [maxUses, setMaxUses] = React.useState("")
  const [expiresAt, setExpiresAt] = React.useState("")
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({})
  const [pending, startTransition] = React.useTransition()
  const int = (v: string) => (v.trim() ? Number.parseInt(v, 10) : null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const r = await createSpecialLink({ name, code, plan, days: int(days) ?? 0, maxUses: int(maxUses), expiresAt: expiresAt || null })
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {})
        return void toast.error(r.message)
      }
      toast.success(r.message ?? "Enlace creado")
      setOpen(false)
      setName("")
      setCode("")
      setCodeTouched(false)
      setMaxUses("")
      setExpiresAt("")
      setErrors({})
    })
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus />
        Crear enlace
      </Button>
      <AppModal
        open={open}
        onOpenChange={setOpen}
        title="Nuevo enlace especial"
        description="Para tus anuncios, una feria, volantes o alguien que te recomiende. Quien se registra con él recibe días gratis."
      >
        <form onSubmit={submit} className="grid gap-5">
          <Field
            label="Nombre (solo lo ves tú)"
            htmlFor="sl-name"
            error={errors.name?.[0]}
            hint="Ej.: Instagram octubre, Feria Maipú, Juan contador"
          >
            <Input
              id="sl-name"
              value={name}
              maxLength={60}
              onChange={(e) => {
                setName(e.target.value)
                if (!codeTouched) setCode(slug(e.target.value))
              }}
              className="h-10"
              autoFocus
            />
          </Field>
          <Field label="Enlace" htmlFor="sl-code" error={errors.code?.[0]}>
            <div className="flex items-center gap-1 rounded-lg border bg-muted/40 pl-3 text-sm">
              <span className="shrink-0 text-muted-foreground">{baseUrl.replace(/^https?:\/\//, "")}/amigo/</span>
              <Input
                id="sl-code"
                value={code}
                maxLength={32}
                onChange={(e) => {
                  setCodeTouched(true)
                  setCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                }}
                className="h-10 min-w-0 border-0 bg-transparent px-1 font-mono shadow-none focus-visible:ring-0"
              />
            </div>
          </Field>
          <Field label="Plan que regala">
            <ChoiceChips
              options={[
                { value: "PRO", label: "Pro" },
                { value: "BUSINESS", label: "Empresa" },
              ]}
              value={plan}
              onChange={setPlan}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Días gratis" htmlFor="sl-days" error={errors.days?.[0]}>
              <Input
                id="sl-days"
                type="number"
                inputMode="numeric"
                min={1}
                max={365}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className="h-10"
              />
            </Field>
            <Field label="Máximo de negocios" htmlFor="sl-max" error={errors.maxUses?.[0]} hint="Vacío = sin límite">
              <Input
                id="sl-max"
                type="number"
                inputMode="numeric"
                min={1}
                placeholder="Sin límite"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                className="h-10"
              />
            </Field>
          </div>
          <Field label="Válido hasta" htmlFor="sl-exp" hint="Vacío = no vence">
            <Input id="sl-exp" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="h-10" />
          </Field>
          <Button type="submit" size="lg" className="h-11" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Crear enlace
          </Button>
        </form>
      </AppModal>
    </>
  )
}

function LinkActions({ link }: { link: SpecialLinkRow }) {
  const [pending, startTransition] = React.useTransition()
  const [copied, setCopied] = React.useState(false)
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      const r = await fn()
      if (r.ok) toast.success(r.message ?? "Listo")
      else toast.error(r.message ?? "No se pudo")
    })

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        size="sm"
        variant="outline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link.url)
            setCopied(true)
            toast.success("Enlace copiado")
            setTimeout(() => setCopied(false), 2000)
          } catch {
            toast.error("No se pudo copiar")
          }
        }}
      >
        {copied ? <Check /> : <Copy />}
        Copiar
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        disabled={pending}
        onClick={() => run(() => toggleSpecialLink(link.id, !link.active))}
        aria-label={link.active ? "Pausar enlace" : "Activar enlace"}
        title={link.active ? "Pausar" : "Activar"}
      >
        {link.active ? <Pause /> : <Play />}
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        disabled={pending}
        onClick={() => {
          if (
            window.confirm(
              `¿Eliminar el enlace "${link.name}"? Dejará de funcionar y se pierden sus números. Los días ya regalados se mantienen.`,
            )
          )
            run(() => deleteSpecialLink(link.id))
        }}
        aria-label="Eliminar enlace"
        title="Eliminar"
      >
        <Trash2 />
      </Button>
    </div>
  )
}

export function SpecialLinks({ links, baseUrl }: { links: SpecialLinkRow[]; baseUrl: string }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {links.length ? `${links.length} ${links.length === 1 ? "enlace" : "enlaces"}` : "Aún no tienes enlaces especiales."}
        </p>
        <CreateLinkDialog baseUrl={baseUrl} />
      </div>
      {links.length ? (
        <ul className="grid gap-2">
          {links.map((l) => {
            const full = l.maxUses !== null && l.businesses >= l.maxUses
            const status = !l.active ? "Pausado" : l.expired ? "Vencido" : full ? "Completo" : "Activo"
            return (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-medium break-words">{l.name}</span>
                    <Badge
                      variant="outline"
                      className={status === "Activo" ? "border-success/30 bg-success/15 text-success" : "text-muted-foreground"}
                    >
                      {status}
                    </Badge>
                  </p>
                  <p className="truncate font-mono text-xs text-muted-foreground" title={l.url}>
                    {l.url.replace(/^https?:\/\//, "")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {l.gift}
                    {l.maxUses !== null ? ` · máximo ${l.maxUses} negocios` : ""}
                    {l.expiresLabel ? ` · hasta el ${l.expiresLabel}` : ""}
                  </p>
                  <p className="flex flex-wrap gap-x-4 gap-y-1 pt-0.5 text-sm">
                    <span>
                      <strong className="tabular">{l.signups}</strong> <span className="text-muted-foreground">se registraron</span>
                    </span>
                    <span>
                      <strong className="tabular">{l.businesses}</strong> <span className="text-muted-foreground">crearon su negocio</span>
                    </span>
                    <span>
                      <strong className="tabular">{l.paying}</strong> <span className="text-muted-foreground">ya pagan</span>
                    </span>
                  </p>
                </div>
                <LinkActions link={l} />
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
