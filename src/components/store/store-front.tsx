"use client"

import * as React from "react"
import { CheckCircle2, Loader2, Minus, Plus, Search, ShoppingBasket } from "lucide-react"
import { AppModal } from "@/components/app/app-modal"
import { WhatsAppIcon } from "@/components/landing/social-links"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { formatMoney } from "@/lib/currency"
import { orderWhatsappText } from "@/lib/store"
import { cn } from "@/lib/utils"
import { whatsappLink } from "@/lib/whatsapp"
import { createWebOrder } from "@/server/actions/store"

export type StoreProduct = { id: string; name: string; price: number; category: string | null; max: number }

const CART_KEY = (slug: string) => `ordensimple-carro-${slug}`

/** Catálogo público: el cliente arma su pedido y lo envía por WhatsApp (queda guardado para el negocio). */
export function StoreFront({ slug, businessName, currency, products }: { slug: string; businessName: string; currency: string; products: StoreProduct[] }) {
  const money = (n: number) => formatMoney(n, currency)
  const [query, setQuery] = React.useState("")
  const [category, setCategory] = React.useState<string | null>(null)
  const [cart, setCart] = React.useState<Record<string, number>>({})
  const [checkout, setCheckout] = React.useState(false)
  const [done, setDone] = React.useState<{ link: string; code: string } | null>(null)

  // El carro se recuerda en este teléfono por si cierran la página sin querer.
  React.useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CART_KEY(slug)) ?? "{}") as Record<string, number>
      const valid = Object.fromEntries(Object.entries(saved).filter(([id, n]) => products.some((p) => p.id === id) && n > 0))
      // eslint-disable-next-line react-hooks/set-state-in-effect -- se lee una sola vez al abrir (localStorage no existe en el servidor)
      if (Object.keys(valid).length) setCart(valid)
    } catch {}
  }, [slug, products])
  React.useEffect(() => {
    try {
      localStorage.setItem(CART_KEY(slug), JSON.stringify(cart))
    } catch {}
  }, [slug, cart])

  const categories = [...new Set(products.map((p) => p.category).filter((c): c is string => Boolean(c)))]
  const q = query.trim().toLowerCase()
  const shown = products.filter((p) => (!category || p.category === category) && (!q || p.name.toLowerCase().includes(q)))
  const lines = products.filter((p) => cart[p.id]).map((p) => ({ ...p, quantity: Math.min(cart[p.id], p.max) }))
  const count = lines.reduce((s, l) => s + l.quantity, 0)
  const total = lines.reduce((s, l) => s + l.quantity * l.price, 0)
  const set = (p: StoreProduct, n: number) =>
    setCart((c) => {
      const next = { ...c }
      if (n <= 0) delete next[p.id]
      else next[p.id] = Math.min(p.max, n)
      return next
    })

  if (!products.length) {
    return <p className="rounded-xl border bg-background p-6 text-center text-sm text-muted-foreground">Por ahora no hay productos publicados. Vuelve pronto.</p>
  }

  return (
    <>
      <div className="sticky top-0 z-10 -mx-4 space-y-2 bg-muted/30 px-4 pt-1 pb-3 backdrop-blur">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar productos" className="h-11 bg-background pl-9" aria-label="Buscar productos" />
        </div>
        {categories.length > 1 ? (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {[null, ...categories].map((c) => (
              <button
                key={c ?? "todas"}
                type="button"
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-sm",
                  category === c ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
                )}
              >
                {c ?? "Todo"}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {shown.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No encontramos «{query}».</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-background">
          {shown.map((p) => {
            const n = cart[p.id] ?? 0
            return (
              <li key={p.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-tight font-medium">{p.name}</p>
                  <p className="tabular mt-0.5 text-sm text-muted-foreground">{money(p.price)}</p>
                </div>
                {n ? (
                  <div className="flex items-center rounded-lg border">
                    <button type="button" className="flex size-10 items-center justify-center" aria-label={`Uno menos de ${p.name}`} onClick={() => set(p, n - 1)}>
                      <Minus className="size-4" />
                    </button>
                    <span className="tabular w-7 text-center font-semibold">{n}</span>
                    <button
                      type="button"
                      className="flex size-10 items-center justify-center disabled:opacity-30"
                      aria-label={`Uno más de ${p.name}`}
                      onClick={() => set(p, n + 1)}
                      disabled={n >= p.max}
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => set(p, 1)} aria-label={`Agregar ${p.name}`}>
                    <Plus />
                    Agregar
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {count ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">
                {count} {count === 1 ? "producto" : "productos"}
              </p>
              <p className="tabular text-lg font-semibold">{money(total)}</p>
            </div>
            <Button size="lg" className="h-12" onClick={() => setCheckout(true)}>
              <ShoppingBasket />
              Hacer pedido
            </Button>
          </div>
        </div>
      ) : null}

      {checkout ? (
        <Checkout
          slug={slug}
          businessName={businessName}
          money={money}
          lines={lines}
          total={total}
          done={done}
          onDone={(d) => {
            setDone(d)
            setCart({})
          }}
          onClose={() => {
            setCheckout(false)
            setDone(null)
          }}
        />
      ) : null}
    </>
  )
}

function Checkout({
  slug,
  businessName,
  money,
  lines,
  total,
  done,
  onDone,
  onClose,
}: {
  slug: string
  businessName: string
  money: (n: number) => string
  lines: (StoreProduct & { quantity: number })[]
  total: number
  done: { link: string; code: string } | null
  onDone: (d: { link: string; code: string }) => void
  onClose: () => void
}) {
  const [name, setName] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [delivery, setDelivery] = React.useState(false)
  const [note, setNote] = React.useState("")
  const [website, setWebsite] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (delivery && note.trim().length < 5) return setError("Escribe la dirección para el despacho.")
    startTransition(async () => {
      const r = await createWebOrder({
        slug,
        customerName: name,
        customerPhone: phone || undefined,
        delivery,
        note: note || undefined,
        items: lines.map((l) => ({ productId: l.id, quantity: l.quantity })),
        website: website || undefined,
      })
      if (!r.ok || !r.data) return setError(r.message ?? "No se pudo enviar el pedido.")
      const text = orderWhatsappText({
        businessName,
        customerName: name.trim(),
        delivery,
        note: note.trim() || null,
        items: r.data.items,
        total: money(r.data.total),
        money,
        code: r.data.code,
      })
      const link = whatsappLink(r.data.whatsapp, text)
      onDone({ link, code: r.data.code })
      // En el celular se abre WhatsApp directo; si el navegador no lo deja, queda el botón.
      window.location.href = link
    })
  }

  return (
    <AppModal open onOpenChange={(o) => !o && onClose()} title={done ? "¡Pedido listo!" : "Tu pedido"} noAutoFocus>
      {done ? (
        <div className="space-y-4 text-center">
          <CheckCircle2 className="mx-auto size-12 text-primary" />
          <p className="text-sm text-muted-foreground">
            Pedido n.º <span className="font-semibold text-foreground">{done.code}</span>. Para confirmarlo, envía el mensaje a {businessName} por WhatsApp.
          </p>
          <Button asChild size="lg" className="h-12 w-full bg-[#25D366] text-white hover:bg-[#1fb757]">
            <a href={done.link} target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon className="size-5" />
              Enviar por WhatsApp
            </a>
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Seguir mirando
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <ul className="space-y-1 rounded-xl bg-muted/50 p-3 text-sm">
            {lines.map((l) => (
              <li key={l.id} className="flex justify-between gap-3">
                <span className="min-w-0">
                  {l.quantity} × {l.name}
                </span>
                <span className="tabular shrink-0">{money(l.quantity * l.price)}</span>
              </li>
            ))}
            <li className="flex justify-between border-t pt-2 text-base font-semibold">
              <span>Total</span>
              <span className="tabular">{money(total)}</span>
            </li>
          </ul>
          <div className="space-y-1.5">
            <label htmlFor="store-name" className="text-sm font-medium">
              Tu nombre
            </label>
            <Input id="store-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={60} autoComplete="name" className="h-11" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="store-phone" className="text-sm font-medium">
              Tu teléfono <span className="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <Input id="store-phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} inputMode="tel" autoComplete="tel" className="h-11" />
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" role="radiogroup" aria-label="Entrega">
            {[
              { v: false, label: "Retiro en el local" },
              { v: true, label: "Despacho" },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                role="radio"
                aria-checked={delivery === o.v}
                onClick={() => setDelivery(o.v)}
                className={cn("rounded-lg py-2 text-sm font-medium", delivery === o.v ? "bg-background shadow-sm" : "text-muted-foreground")}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="store-note" className="text-sm font-medium">
              {delivery ? "Dirección y comentarios" : "Comentarios"} {delivery ? null : <span className="font-normal text-muted-foreground">(opcional)</span>}
            </label>
            <Textarea
              id="store-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              rows={2}
              placeholder={delivery ? "Calle, número, depto, comuna" : "Ej.: paso a las 18:00"}
            />
          </div>
          {/* Campo trampa para robots (las personas no lo ven). */}
          <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
          {error ? (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" size="lg" className="h-12 w-full bg-[#25D366] text-white hover:bg-[#1fb757]" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <WhatsAppIcon className="size-5" />}
            Enviar pedido por WhatsApp
          </Button>
          <p className="text-center text-xs text-muted-foreground">El negocio confirma el pedido, el pago y la entrega por WhatsApp.</p>
        </form>
      )}
    </AppModal>
  )
}
