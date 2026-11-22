"use client"

import * as React from "react"
import { Check, Plus, Search, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { LINK_ICON_COMPONENTS } from "@/components/links/link-page-view"
import { SocialIcon } from "@/components/links/social-icons"
import { Field, ImageField, Segmented, TextField } from "@/components/links/editor/fields"
import { normalizePhone } from "@/lib/contact-card"
import { LINK_ICONS, LINK_SOCIAL_KINDS, LINK_SOCIALS, normalizeLinkSocial, parseVideo, safeUrl, type LinkBlock } from "@/lib/links"
import { cn } from "@/lib/utils"

export type EditorProduct = { id: string; name: string; price: string; imageUrl: string | null }

type Ctx = { products: EditorProduct[]; bookingUrl: string | null; storeUrl: string | null }

/** Problema de un campo, solo si ya se escribió algo (no se reta a nadie por un campo que aún no llena). */
const urlError = (v: string) => (v && !safeUrl(v) ? "Usa una dirección completa, por ejemplo https://miweb.cl" : null)
const phoneError = (v: string) => (v && !normalizePhone(v) ? "Escribe un número válido, por ejemplo +56 9 1234 5678" : null)
const emailError = (v: string) => (v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? "Escribe un correo válido" : null)

export function BlockForm({ block, onChange, ctx }: { block: LinkBlock; onChange: (b: LinkBlock) => void; ctx: Ctx }) {
  // Al tocar cualquier campo, el bloque deja de ser "de ejemplo".
  const set = (patch: Record<string, unknown>) => onChange({ ...block, ...patch, demo: false } as LinkBlock)

  switch (block.type) {
    case "link":
      return (
        <div className="space-y-3">
          <TextField label="Texto del botón" value={block.title} max={80} placeholder="Ej.: Mira nuestro catálogo" onChange={(title) => set({ title })} />
          <TextField label="Enlace" value={block.url} max={500} type="url" inputMode="url" placeholder="https://" error={urlError(block.url)} onChange={(url) => set({ url })} />
          {ctx.storeUrl && !block.url ? (
            <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => set({ url: ctx.storeUrl!, icon: "shop" })}>
              Usar el enlace de mi tienda online
            </button>
          ) : null}
          <Field label="Ícono">
            <div className="flex flex-wrap gap-1">
              <IconChoice active={!block.icon} onClick={() => set({ icon: null })} label="Sin ícono">
                <span className="text-[11px]">Ninguno</span>
              </IconChoice>
              {LINK_ICONS.map((key) => {
                const Icon = LINK_ICON_COMPONENTS[key]
                return (
                  <IconChoice key={key} active={block.icon === key} onClick={() => set({ icon: key })} label={key}>
                    <Icon className="size-4" />
                  </IconChoice>
                )
              })}
            </div>
          </Field>
          <ImageField label="Miniatura (opcional)" value={block.thumb} onChange={(thumb) => set({ thumb })} max={240} hint="Una foto chica a la izquierda del botón, en vez del ícono." />
          <HighlightSwitch block={block} onChange={set} />
        </div>
      )
    case "text":
      return (
        <div className="space-y-3">
          <TextField label="Título" value={block.title} max={120} onChange={(title) => set({ title })} />
          <TextField label="Texto" value={block.body} max={1200} multiline onChange={(body) => set({ body })} />
        </div>
      )
    case "image":
      return (
        <div className="space-y-3">
          <ImageField label="Foto" value={block.image} onChange={(image) => set({ image })} max={1200} />
          <TextField label="Descripción de la foto" value={block.alt} max={140} hint="Para personas que usan lector de pantalla y para Google." onChange={(alt) => set({ alt })} />
          <Field label="Forma">
            <Segmented label="Forma de la foto" value={block.ratio} onChange={(ratio) => set({ ratio })} options={[{ value: "auto", label: "Original" }, { value: "square", label: "Cuadrada" }, { value: "wide", label: "Panorámica" }]} />
          </Field>
          <TextField label="Enlace al tocarla (opcional)" value={block.url} max={500} type="url" inputMode="url" placeholder="https://" error={urlError(block.url)} onChange={(url) => set({ url })} />
        </div>
      )
    case "video":
      return (
        <div className="space-y-3">
          <TextField
            label="Enlace del video"
            value={block.url}
            max={300}
            type="url"
            inputMode="url"
            placeholder="https://www.youtube.com/watch?v=…"
            error={block.url && !parseVideo(block.url) ? "Pega el enlace de un video de YouTube o Vimeo" : null}
            hint="El video se carga recién cuando lo tocan: la página abre rápido y nunca suena sola."
            onChange={(url) => set({ url })}
          />
          <TextField label="Título (opcional)" value={block.title} max={80} onChange={(title) => set({ title })} />
        </div>
      )
    case "socials":
      return <SocialsForm block={block} onChange={(items) => set({ items })} />
    case "whatsapp":
      return (
        <div className="space-y-3">
          <TextField label="Texto del botón" value={block.title} max={80} placeholder="Escríbenos por WhatsApp" onChange={(title) => set({ title })} />
          <TextField label="Número de WhatsApp" value={block.phone} max={30} type="tel" inputMode="tel" placeholder="+56 9 1234 5678" error={phoneError(block.phone)} onChange={(phone) => set({ phone })} />
          <TextField label="Mensaje que te llega escrito" value={block.message} max={300} multiline hint="La persona lo puede cambiar antes de enviarlo." onChange={(message) => set({ message })} />
          <HighlightSwitch block={block} onChange={set} />
        </div>
      )
    case "email":
      return (
        <div className="space-y-3">
          <TextField label="Texto del botón" value={block.title} max={80} placeholder="Escríbenos un correo" onChange={(title) => set({ title })} />
          <TextField label="Correo" value={block.email} max={120} type="email" inputMode="email" error={emailError(block.email)} onChange={(email) => set({ email })} />
          <TextField label="Asunto (opcional)" value={block.subject} max={120} onChange={(subject) => set({ subject })} />
        </div>
      )
    case "phone":
      return (
        <div className="space-y-3">
          <TextField label="Texto del botón" value={block.title} max={80} placeholder="Llámanos" onChange={(title) => set({ title })} />
          <TextField label="Teléfono" value={block.phone} max={30} type="tel" inputMode="tel" error={phoneError(block.phone)} onChange={(phone) => set({ phone })} />
        </div>
      )
    case "location":
      return (
        <div className="space-y-3">
          <TextField label="Título" value={block.title} max={80} placeholder="Cómo llegar" onChange={(title) => set({ title })} />
          <TextField label="Dirección" value={block.address} max={200} placeholder="Av. Providencia 1234, Providencia" hint="Al tocarla se abre en el mapa del celular." onChange={(address) => set({ address })} />
        </div>
      )
    case "separator":
      return (
        <Field label="Estilo">
          <Segmented label="Estilo del separador" value={block.style} onChange={(style) => set({ style })} options={[{ value: "line", label: "Línea" }, { value: "dots", label: "Puntos" }, { value: "space", label: "Espacio" }]} />
        </Field>
      )
    case "products":
      return (
        <div className="space-y-3">
          <TextField label="Título (opcional)" value={block.title} max={80} placeholder="Lo más pedido" onChange={(title) => set({ title })} />
          <Field label="Cómo se muestran">
            <Segmented label="Cómo se muestran los productos" value={block.layout} onChange={(layout) => set({ layout })} options={[{ value: "grid", label: "Cuadrícula" }, { value: "list", label: "Lista" }]} />
          </Field>
          <ProductPicker products={ctx.products} selected={block.productIds} onChange={(productIds) => set({ productIds })} />
        </div>
      )
    case "booking":
      return (
        <div className="space-y-3">
          <TextField label="Texto del botón" value={block.title} max={80} placeholder="Reserva tu hora" onChange={(title) => set({ title })} />
          <p className={cn("rounded-lg px-3 py-2 text-xs", ctx.bookingUrl ? "bg-primary/[0.07] text-foreground" : "bg-muted text-muted-foreground")}>
            {ctx.bookingUrl
              ? "Lleva a la Agenda de tu tienda online: tus clientes eligen el servicio y la hora, y la reserva te llega como siempre."
              : "Para recibir reservas, activa tu tienda online y la Agenda (Configuración, sección Tienda online). Mientras tanto, este botón no se muestra."}
          </p>
        </div>
      )
    case "quote":
      return (
        <div className="space-y-3">
          <TextField label="Texto del botón" value={block.title} max={80} placeholder="Pide una cotización" onChange={(title) => set({ title })} />
          <Field label="Te llega por">
            <Segmented label="Dónde llegan las solicitudes" value={block.channel} onChange={(channel) => set({ channel })} options={[{ value: "whatsapp", label: "WhatsApp" }, { value: "email", label: "Correo" }]} />
          </Field>
          {block.channel === "whatsapp" ? (
            <TextField label="Número de WhatsApp" value={block.phone} max={30} type="tel" inputMode="tel" error={phoneError(block.phone)} onChange={(phone) => set({ phone })} />
          ) : (
            <TextField label="Correo" value={block.email} max={120} type="email" inputMode="email" error={emailError(block.email)} onChange={(email) => set({ email })} />
          )}
          <TextField label="Mensaje que te llega escrito" value={block.message} max={300} multiline placeholder="Hola, me gustaría pedir una cotización." onChange={(message) => set({ message })} />
          <p className="text-xs text-muted-foreground">Cuando te escriban, arma la cotización en Cotizaciones y mándales el enlace para que la acepten.</p>
        </div>
      )
    case "promo":
      return (
        <div className="space-y-3">
          <TextField label="Título" value={block.title} max={80} placeholder="20 % de descuento en tu primera compra" onChange={(title) => set({ title })} />
          <TextField label="Detalle (opcional)" value={block.body} max={300} multiline onChange={(body) => set({ body })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Código del cupón (opcional)" value={block.code} max={30} placeholder="BIENVENIDA" onChange={(code) => set({ code: code.toUpperCase().replace(/\s+/g, "") })} />
            <Field label="Válida hasta (opcional)">
              <Input type="date" value={block.until ?? ""} onChange={(e) => set({ until: e.target.value || null })} />
            </Field>
          </div>
          <TextField label="Enlace del botón (opcional)" value={block.url} max={500} type="url" inputMode="url" placeholder="https://" error={urlError(block.url)} onChange={(url) => set({ url })} />
          <p className="text-xs text-muted-foreground">Después de la fecha, la promoción se esconde sola.</p>
        </div>
      )
  }
}

function IconChoice({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={cn("grid h-8 min-w-8 place-items-center rounded-md border px-1.5 transition-colors", active ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}
    >
      {children}
    </button>
  )
}

function HighlightSwitch({ block, onChange }: { block: LinkBlock; onChange: (p: { highlight: boolean }) => void }) {
  const id = React.useId()
  return (
    <label htmlFor={id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
      <span className="text-[13px]">
        <span className="block font-medium">Destacar este botón</span>
        <span className="block text-xs text-muted-foreground">Va con el color principal aunque los demás sean más sobrios.</span>
      </span>
      <Switch id={id} checked={Boolean(block.highlight)} onCheckedChange={(highlight) => onChange({ highlight })} />
    </label>
  )
}

function SocialsForm({ block, onChange }: { block: Extract<LinkBlock, { type: "socials" }>; onChange: (items: { kind: (typeof LINK_SOCIAL_KINDS)[number]; handle: string }[]) => void }) {
  const missing = LINK_SOCIAL_KINDS.filter((k) => !block.items.some((i) => i.kind === k))
  return (
    <div className="space-y-3">
      {block.items.map((item, i) => (
        <div key={item.kind} className="flex items-end gap-2">
          <span className="mb-1.5 grid size-8 shrink-0 place-items-center rounded-full bg-muted">
            <SocialIcon kind={item.kind} className="size-4" />
          </span>
          <TextField
            className="min-w-0 flex-1"
            label={LINK_SOCIALS[item.kind].label}
            value={item.handle}
            max={200}
            placeholder="@usuario o el enlace a tu perfil"
            error={item.handle && !normalizeLinkSocial(item.kind, item.handle) ? `Escribe tu usuario de ${LINK_SOCIALS[item.kind].label} o el enlace a tu perfil` : null}
            onChange={(handle) => onChange(block.items.map((x, j) => (j === i ? { ...x, handle } : x)))}
          />
          <Button type="button" variant="ghost" size="icon" className="mb-0.5" aria-label={`Quitar ${LINK_SOCIALS[item.kind].label}`} onClick={() => onChange(block.items.filter((_, j) => j !== i))}>
            <Trash2 />
          </Button>
        </div>
      ))}
      {missing.length ? (
        <div className="flex flex-wrap gap-1.5">
          {missing.map((kind) => (
            <Button key={kind} type="button" variant="outline" size="sm" onClick={() => onChange([...block.items, { kind, handle: "" }])}>
              <Plus />
              {LINK_SOCIALS[kind].label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ProductPicker({ products, selected, onChange }: { products: EditorProduct[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const [q, setQ] = React.useState("")
  if (!products.length) {
    return <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">Todavía no tienes productos con precio. Agrégalos en Productos y aparecerán aquí.</p>
  }
  const term = q.trim().toLowerCase()
  const list = products.filter((p) => !term || p.name.toLowerCase().includes(term)).slice(0, 60)
  const full = selected.length >= 12
  return (
    <Field label={`Productos elegidos (${selected.length} de 12)`} hint="El precio y la foto se toman de tu catálogo: si los cambias en Productos, aquí se actualizan solos. El costo y el stock nunca se muestran.">
      <div className="rounded-lg border">
        <div className="flex items-center gap-2 border-b px-2.5">
          <Search className="size-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto" aria-label="Buscar producto" className="h-9 w-full bg-transparent text-sm outline-none" />
        </div>
        <ul className="max-h-60 overflow-y-auto p-1">
          {list.map((p) => {
            const on = selected.includes(p.id)
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={!on && full}
                  onClick={() => onChange(on ? selected.filter((id) => id !== p.id) : [...selected, p.id])}
                  aria-pressed={on}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-40"
                >
                  <span className={cn("grid size-4 shrink-0 place-items-center rounded border", on && "border-primary bg-primary text-primary-foreground")}>{on ? <Check className="size-3" /> : null}</span>
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt="" className="size-7 rounded object-cover" />
                  ) : (
                    <span className="grid size-7 place-items-center rounded bg-primary/[0.08] text-xs font-semibold text-primary">{p.name[0]?.toUpperCase()}</span>
                  )}
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{p.price}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </Field>
  )
}
