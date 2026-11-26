"use client"

import * as React from "react"
import { Check, Copy, KeyRound, Loader2, Plus, Send, Trash2, Webhook as WebhookIcon } from "lucide-react"
import { toast } from "sonner"
import { Field } from "@/components/app/field"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { WEBHOOK_EVENT_LABEL, WEBHOOK_EVENTS, type WebhookEvent } from "@/lib/api-events"
import { addWebhook, createApiKey, deleteWebhook, revokeApiKey, testWebhook } from "@/server/actions/integrations"

export type ApiKeyRow = { id: string; name: string; hint: string; createdLabel: string; lastUsedLabel: string | null }
export type WebhookRow = {
  id: string
  url: string
  events: string[]
  active: boolean
  lastLabel: string | null
  lastOk: boolean | null
  lastError: string | null
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = React.useState(false)
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setDone(true)
          setTimeout(() => setDone(false), 1800)
        } catch {
          toast.error("No se pudo copiar. Selecciónalo y cópialo a mano.")
        }
      }}
      aria-label={label}
    >
      {done ? <Check /> : <Copy />} {done ? "Copiado" : "Copiar"}
    </Button>
  )
}

/** Valor para copiar (dirección, clave o secreto), con su botón. */
function CopyLine({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-lg border border-dashed bg-muted/50 px-3 py-2 font-mono text-[13px]" title={value}>
        {value}
      </code>
      <CopyButton value={value} label={label} />
    </div>
  )
}

export function ApiAddress({ url }: { url: string }) {
  return <CopyLine value={url} label="Copiar la dirección de la API" />
}

export function ApiKeys({ keys }: { keys: ApiKeyRow[] }) {
  const [creating, setCreating] = React.useState(false)
  const [name, setName] = React.useState("OrdenCRM")
  const [pending, setPending] = React.useState(false)
  const [created, setCreated] = React.useState<string | null>(null)
  const [revoking, setRevoking] = React.useState<ApiKeyRow | null>(null)

  const create = async () => {
    setPending(true)
    try {
      const r = await createApiKey(name)
      if (r.ok && r.data) {
        setCreating(false)
        setCreated(r.data.key)
      } else toast.error(r.message)
    } finally {
      setPending(false)
    }
  }
  const revoke = async () => {
    if (!revoking) return
    setPending(true)
    try {
      const r = await revokeApiKey(revoking.id)
      if (r.ok) {
        toast.success(r.message)
        setRevoking(null)
      } else toast.error(r.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-3">
      {keys.length ? (
        <ul className="divide-y rounded-xl border">
          {keys.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
              <KeyRound className="size-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{k.name}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-mono">{k.hint}</span> · Creada el {k.createdLabel} · {k.lastUsedLabel ? `Último uso: ${k.lastUsedLabel}` : "Todavía no se usa"}
                </p>
              </div>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setRevoking(k)}>
                Revocar
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Todavía no tienes claves. Crea una para conectar OrdenCRM u otra app.
        </p>
      )}
      <Button variant="outline" onClick={() => setCreating(true)}>
        <Plus /> Crear clave
      </Button>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crear clave de API</DialogTitle>
            <DialogDescription>Ponle el nombre de la app que la va a usar, para reconocerla después.</DialogDescription>
          </DialogHeader>
          <Field label="Nombre" htmlFor="api-key-name">
            <Input id="api-key-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus />
          </Field>
          <DialogFooter>
            <Button onClick={create} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <KeyRound />} Crear clave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={created !== null} onOpenChange={(o) => !o && setCreated(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Copia tu clave ahora</DialogTitle>
            <DialogDescription>
              Por seguridad, es la única vez que la mostramos completa. Pégala en la otra app y no la compartas: permite leer tus clientes, ventas y
              productos, y pedir avisos cuando cambien.
            </DialogDescription>
          </DialogHeader>
          {created ? <CopyLine value={created} label="Copiar la clave" /> : null}
          <DialogFooter>
            <Button onClick={() => setCreated(null)}>Listo, ya la copié</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={revoking !== null} onOpenChange={(o) => !o && setRevoking(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Revocar la clave “{revoking?.name}”?</DialogTitle>
            <DialogDescription>Las apps que la usan dejan de recibir tus datos de inmediato y se eliminan los avisos que crearon. No se puede deshacer, pero puedes crear otra.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevoking(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={revoke} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null} Revocar clave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function Webhooks({ hooks, max }: { hooks: WebhookRow[]; max: number }) {
  const [adding, setAdding] = React.useState(false)
  const [url, setUrl] = React.useState("")
  const [secret, setSecret] = React.useState("")
  const [events, setEvents] = React.useState<string[]>(["*"])
  const [pending, setPending] = React.useState<string | null>(null)
  const [generated, setGenerated] = React.useState<string | null>(null)

  const toggle = (e: string) =>
    setEvents((cur) => {
      if (e === "*") return cur.includes("*") ? [] : ["*"]
      const rest = cur.filter((x) => x !== "*")
      return rest.includes(e) ? rest.filter((x) => x !== e) : [...rest, e]
    })

  const add = async () => {
    setPending("add")
    try {
      const r = await addWebhook({ url, events: events as Parameters<typeof addWebhook>[0]["events"], secret })
      if (r.ok && r.data) {
        toast.success(r.message)
        setAdding(false)
        setUrl("")
        setSecret("")
        setEvents(["*"])
        if (r.data.generated) setGenerated(r.data.secret)
      } else toast.error(r.message)
    } finally {
      setPending(null)
    }
  }
  const run = async (id: string, kind: "test" | "delete") => {
    setPending(`${kind}:${id}`)
    try {
      const r = kind === "test" ? await testWebhook(id) : await deleteWebhook(id)
      if (r.ok) toast.success(r.message)
      else toast.error(r.message)
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="space-y-3">
      {hooks.length ? (
        <ul className="divide-y rounded-xl border">
          {hooks.map((h) => (
            <li key={h.id} className="space-y-2 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <WebhookIcon className="size-4 shrink-0 text-primary" />
                <p className="min-w-0 flex-1 truncate font-mono text-[13px]" title={h.url}>
                  {h.url}
                </p>
                <Button variant="outline" size="sm" onClick={() => run(h.id, "test")} disabled={pending !== null}>
                  {pending === `test:${h.id}` ? <Loader2 className="animate-spin" /> : <Send />} Probar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => run(h.id, "delete")} disabled={pending !== null} aria-label="Eliminar aviso">
                  <Trash2 />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {h.events.includes("*") ? "Todos los eventos" : h.events.map((e) => WEBHOOK_EVENT_LABEL[e as WebhookEvent] ?? e).join(", ")}
                {" · "}
                {!h.active ? (
                  <span className="text-destructive">Pausado por fallar muchas veces seguidas. Usa Probar para reactivarlo.</span>
                ) : h.lastLabel ? (
                  <span className={h.lastOk ? "text-success" : "text-destructive"}>
                    Último envío {h.lastLabel}: {h.lastOk ? "llegó bien" : (h.lastError ?? "falló")}
                  </span>
                ) : (
                  "Todavía no se envía ninguno"
                )}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      {hooks.length < max ? (
        <Button variant="outline" onClick={() => setAdding(true)}>
          <Plus /> Agregar aviso
        </Button>
      ) : null}

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Agregar aviso (webhook)</DialogTitle>
            <DialogDescription>Cuando cambie algo, OrdenSimple le avisa al instante a esta dirección. La otra app te la entrega junto con su secreto.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Dirección" htmlFor="wh-url">
              <Input id="wh-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." inputMode="url" autoComplete="off" />
            </Field>
            <Field label="Secreto" htmlFor="wh-secret" hint="Pega el que te dio la otra app. Si lo dejas vacío, creamos uno.">
              <Input id="wh-secret" value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="off" spellCheck={false} />
            </Field>
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium">Avisar cuando haya</legend>
              {(["*", ...WEBHOOK_EVENTS] as string[]).map((e) => (
                <label key={e} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={events.includes(e)} onCheckedChange={() => toggle(e)} />
                  {e === "*" ? "Cualquier cambio" : WEBHOOK_EVENT_LABEL[e as WebhookEvent]}
                </label>
              ))}
            </fieldset>
          </div>
          <DialogFooter>
            <Button onClick={add} disabled={pending !== null || !url || !events.length}>
              {pending === "add" ? <Loader2 className="animate-spin" /> : <Plus />} Agregar aviso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={generated !== null} onOpenChange={(o) => !o && setGenerated(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Copia el secreto del aviso</DialogTitle>
            <DialogDescription>La otra app lo usa para comprobar que el aviso viene de OrdenSimple. Es la única vez que lo mostramos.</DialogDescription>
          </DialogHeader>
          {generated ? <CopyLine value={generated} label="Copiar el secreto" /> : null}
          <DialogFooter>
            <Button onClick={() => setGenerated(null)}>Listo, ya lo copié</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
