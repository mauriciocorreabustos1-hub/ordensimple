"use client"

import * as React from "react"
import { Copy, ExternalLink, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Field } from "@/components/app/field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { storePath, storeSlugFrom } from "@/lib/store"
import { whatsappLink } from "@/lib/whatsapp"
import { updateStoreSettings } from "@/server/actions/store"

/** Tienda online: dirección pública, WhatsApp donde llegan los pedidos y un mensaje corto. */
export function StoreSettings({
  businessName,
  enabled: initialEnabled,
  slug: initialSlug,
  whatsapp: initialWhatsapp,
  message: initialMessage,
  appUrl,
  disabled,
}: {
  businessName: string
  enabled: boolean
  slug: string | null
  whatsapp: string | null
  message: string | null
  appUrl: string
  disabled?: boolean
}) {
  const [enabled, setEnabled] = React.useState(initialEnabled)
  const [slug, setSlug] = React.useState(initialSlug ?? storeSlugFrom(businessName))
  const [whatsapp, setWhatsapp] = React.useState(initialWhatsapp ?? "")
  const [message, setMessage] = React.useState(initialMessage ?? "")
  const [saved, setSaved] = React.useState(initialSlug)
  const [pending, startTransition] = React.useTransition()
  const url = `${appUrl}${storePath(saved ?? slug)}`

  function save(nextEnabled = enabled) {
    startTransition(async () => {
      const r = await updateStoreSettings({ enabled: nextEnabled, slug, whatsapp, message })
      if (!r.ok) {
        setEnabled(initialEnabled)
        return void toast.error(r.message)
      }
      setEnabled(nextEnabled)
      setSaved(slug)
      toast.success(r.message)
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Dirección de tu tienda" hint={`${appUrl.replace(/^https?:\/\//, "")}/tienda/${slug || "…"}`}>
          <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40))} disabled={disabled} aria-label="Dirección de la tienda" />
        </Field>
        <Field label="WhatsApp donde te llegan los pedidos" hint="Con código de país, ej.: +56 9 1234 5678">
          <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" disabled={disabled} placeholder="+56 9 1234 5678" />
        </Field>
      </div>
      <Field label="Mensaje para tus clientes" optional hint="Horario, comunas de despacho, cómo pagar…">
        <Input value={message} onChange={(e) => setMessage(e.target.value)} maxLength={200} disabled={disabled} placeholder="Ej.: Despacho en Maipú de 10:00 a 20:00. Pagas al recibir." />
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
        <label htmlFor="store-enabled" className="space-y-0.5">
          <span className="block text-sm font-medium">{enabled ? "Tu tienda está publicada" : "Publicar mi tienda"}</span>
          <span className="block text-xs text-muted-foreground">Se muestran tus productos activos con precio y con stock.</span>
        </label>
        <Switch id="store-enabled" checked={enabled} disabled={disabled || pending || !slug || !whatsapp} onCheckedChange={(v) => save(v)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => save()} disabled={disabled || pending || !slug || !whatsapp}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Guardar
        </Button>
        {saved && enabled ? (
          <>
            <Button variant="outline" asChild>
              <a href={storePath(saved)} target="_blank" rel="noopener noreferrer">
                <ExternalLink />
                Ver tienda
              </a>
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                navigator.clipboard
                  .writeText(url)
                  .then(() => toast.success("Enlace copiado"))
                  .catch(() => toast.error("No se pudo copiar"))
              }
            >
              <Copy />
              Copiar enlace
            </Button>
            <Button variant="outline" asChild>
              <a href={whatsappLink(null, `¡Ahora puedes hacer tus pedidos a ${businessName} por aquí! ${url}`)} target="_blank" rel="noopener noreferrer">
                Compartir por WhatsApp
              </a>
            </Button>
          </>
        ) : null}
      </div>
    </div>
  )
}
