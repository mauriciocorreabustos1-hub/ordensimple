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
import { createWebOrder, previewCoupon } from "@/server/actions/store"
import { applyPromotions, promoActive, promoBadge, promoHint, type PromoRule } from "@/lib/promotions"
import { ProductImage } from "@/components/products/product-image"

export type StoreProduct = { id: string; name: string; price: number; category: string | null; categoryId?: string | null; max: number; imageUrl?: string | null }

const CART_KEY = (slug: string) => `ordensimple-carro-${slug}`

/** Catálogo público: el cliente arma su pedido y lo envía por WhatsApp (queda guardado para el negocio). */
export function StoreFront({
  slug,
  businessName,
  currency,
  products,
  promotions = [],
  timezone = "America/Santiago",
  coupons = false,
}: {
  slug: string
  businessName: string
  currency: string
  products: StoreProduct[]
  /** Promociones de la tienda online (se muestran; el servidor las vuelve a calcular al pedir). */
  promotions?: PromoRule[]
  timezone?: string
  /** Si la tienda acepta cupones. */
  coupons?: boolean
}) {
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
  const gross = lines.reduce((s, l) => s + l.quantity * l.price, 0)
  const promo = applyPromotions(
    lines.map((l) => ({ key: l.id, productId: l.id, categoryId: l.categoryId ?? null, quantity: l.quantity, unitPrice: l.price })),
    promotions,
    { now: new Date(), timezone, channel: "online" },
  )
  const total = gross - promo.discount
  // Etiqueta de promoción de cada producto ("2×1", "−20 %"), si tiene una vigente.
  const live = promotions.filter((r) => r.online && promoActive(r, new Date(), timezone))
  const ruleOf = (p: StoreProduct) =>
    live.find((x) => x.scope === "ALL" || (x.scope === "PRODUCTS" && x.productIds.includes(p.id)) || (x.scope === "CATEGORY" && x.categoryId === p.categoryId))
  const badgeOf = (p: StoreProduct) => {
    const r = ruleOf(p)
    return r ? promoBadge(r) : null
  }
  /** "Agrega 1 más y te sale gratis" si lleva un 2×1 a medias. */
  const hintOf = (p: StoreProduct) => {
    const r = ruleOf(p)
    return r ? promoHint(r, cart[p.id] ?? 0) : null
  }
  const hints = lines.flatMap((l) => {
    const h = hintOf(l)
    return h ? [{ id: l.id, text: `${l.name}: ${h.charAt(0).toLowerCase()}${h.slice(1)}` }] : []
  })
  const set = (p: StoreProduct, n: number) =>
    setCart((c) => {
      const next = { ...c }
      if (n <= 0) delete next[p.id]
      else next[p.id] = Math.min(p.max, n)
      return next
    })

  const withPhotos = products.some((p) => p.imageUrl)
  /** "Agregar" o los botones − cantidad +. En las tarjetas ocupa todo el ancho. */
  const quantity = (p: StoreProduct, wide: boolean) => {
    const n = cart[p.id] ?? 0
    return n ? (
      <div className={cn("flex items-center rounded-lg border", wide && "justify-between")}>
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
      <Button variant="outline" onClick={() => set(p, 1)} aria-label={`Agregar ${p.name}`} className={cn(wide && "w-full")}>
        <Plus />
        Agregar
      </Button>
    )
  }

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
        <p className="py-10 text-center text-sm text-muted-foreground">No encontramos “{query}”.</p>
      ) : (
        withPhotos ? (
          // Con fotos: tarjetas, como una vitrina.
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {shown.map((p) => (
              <li key={p.id} className="flex flex-col overflow-hidden rounded-2xl border bg-background">
                <div className="relative">
                  <ProductImage name={p.name} url={p.imageUrl ?? null} sizes="large" className="aspect-square w-full rounded-none" />
                  {badgeOf(p) ? <span className="absolute top-2 left-2 rounded-full bg-rose-600 px-2 py-0.5 text-xs font-bold text-white shadow">{badgeOf(p)}</span> : null}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm leading-tight font-medium">{p.name}</p>
                    <p className="tabular mt-1 font-semibold">{money(p.price)}</p>
                    {hintOf(p) ? <p className="mt-1 text-xs font-medium text-rose-700 dark:text-rose-400">🎁 {hintOf(p)}</p> : null}
                  </div>
                  {quantity(p, true)}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="divide-y overflow-hidden rounded-2xl border bg-background">
            {shown.map((p) => (
              <li key={p.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-tight font-medium">
                    {p.name}
                    {badgeOf(p) ? <span className="ml-1.5 rounded-full bg-rose-600 px-1.5 py-0.5 align-middle text-[10px] font-bold text-white">{badgeOf(p)}</span> : null}
                  </p>
                  <p className="tabular mt-0.5 text-sm text-muted-foreground">{money(p.price)}</p>
                  {hintOf(p) ? <p className="mt-0.5 text-xs font-medium text-rose-700 dark:text-rose-400">🎁 {hintOf(p)}</p> : null}
                </div>
                {quantity(p, false)}
              </li>
            ))}
          </ul>
        )
      )}

      {count ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">
                {count} {count === 1 ? "producto" : "productos"}
              </p>
              <p className="tabular text-lg font-semibold">
                {money(total)}
                {promo.discount ? <span className="ml-2 text-sm font-normal text-muted-foreground line-through">{money(gross)}</span> : null}
              </p>
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
          gross={gross}
          promos={promo.applied}
          hints={hints}
          total={total}
          coupons={coupons}
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
  gross,
  hints,
  promos,
  total,
  coupons,
  done,
  onDone,
  onClose,
}: {
  gross: number
  /** Promociones "2×1" a medias: qué le falta agregar para aprovecharlas. */
  hints: { id: string; text: string }[]
  promos: { promotionId: string; name: string; amount: number }[]
  coupons: boolean
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
  const [couponText, setCouponText] = React.useState("")
  const [coupon, setCoupon] = React.useState<{ code: string; percent: number | null; amount: number | null; minTotal: number } | null>(null)
  const [couponMsg, setCouponMsg] = React.useState<string | null>(null)
  const [checking, setChecking] = React.useState(false)
  // Si las promociones cambiaron mientras miraba: lo que vale ahora (lo calcula el servidor).
  const [changed, setChanged] = React.useState<{ promos: { name: string; amount: number }[]; coupon: { code: string; amount: number } | null; total: number } | null>(null)
  const couponOff = coupon && total >= coupon.minTotal ? Math.min(total, coupon.percent ? Math.round((total * coupon.percent) / 100) : (coupon.amount ?? 0)) : 0
  const final = total - couponOff

  async function applyCoupon() {
    if (!couponText.trim()) return
    setChecking(true)
    setCouponMsg(null)
    const r = await previewCoupon(slug, couponText)
    setChecking(false)
    if (!r.ok || !r.data) {
      setCoupon(null)
      return setCouponMsg(r.message ?? "Cupón no válido.")
    }
    setCoupon(r.data)
    setCouponMsg(total < r.data.minTotal ? `Este cupón es para compras desde ${money(r.data.minTotal)}.` : null)
  }

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
        couponCode: coupon && couponOff ? coupon.code : undefined,
        // Lo que el cliente ve en pantalla (o el total nuevo, si ya se lo mostramos y lo aceptó).
        expectedTotal: changed ? changed.total : final,
        website: website || undefined,
      })
      if (!r.ok || !r.data) return setError(r.message ?? "No se pudo enviar el pedido.")
      if ("changed" in r.data) {
        setChanged({ promos: r.data.promos, coupon: r.data.coupon, total: r.data.total })
        return
      }
      const text = orderWhatsappText({
        businessName,
        customerName: name.trim(),
        customerPhone: phone.trim() || null,
        delivery,
        note: note.trim() || null,
        items: r.data.items,
        total: money(r.data.total),
        money,
        code: r.data.code,
        promos: r.data.promos,
        coupon: r.data.coupon,
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
            {/* Si las promociones cambiaron, se muestran las que valen ahora (las calculó el servidor). */}
            {(changed ? changed.promos : promos).map((p) => (
              <li key={p.name} className="flex justify-between gap-3 font-medium text-emerald-700 dark:text-emerald-400">
                <span>🏷️ {p.name}</span>
                <span className="tabular shrink-0">−{money(p.amount)}</span>
              </li>
            ))}
            {(changed ? changed.coupon?.amount : couponOff) ? (
              <li className="flex justify-between gap-3 font-medium text-emerald-700 dark:text-emerald-400">
                <span>🎟️ Cupón {changed ? changed.coupon?.code : coupon?.code}</span>
                <span className="tabular shrink-0">−{money(changed ? (changed.coupon?.amount ?? 0) : couponOff)}</span>
              </li>
            ) : null}
            <li className="flex justify-between border-t pt-2 text-base font-semibold">
              <span>Total</span>
              <span className="tabular">
                {money(changed ? changed.total : final)}
                {(changed ? changed.total : final) < gross ? <span className="ml-2 text-xs font-normal text-muted-foreground line-through">{money(gross)}</span> : null}
              </span>
            </li>
          </ul>
          {hints.length ? (
            <div className="space-y-0.5 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:bg-rose-500/10 dark:text-rose-200">
              {hints.map((h) => (
                <p key={h.id}>🎁 {h.text}</p>
              ))}
              <p className="text-xs opacity-80">Cierra esta ventana y súmalo al carro para aprovechar la promoción.</p>
            </div>
          ) : null}
          {changed ? (
            <div className="space-y-1.5 rounded-xl border-2 border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-500/10 dark:text-amber-100" role="alert">
              <p className="font-semibold">⚠️ Las promociones cambiaron mientras mirabas</p>
              {promos
                .filter((p) => !changed.promos.some((c) => c.name === p.name))
                .map((p) => (
                  <p key={p.name}>
                    ❌ <span className="line-through">{p.name}</span> ya no está vigente.
                  </p>
                ))}
              {changed.promos
                .filter((c) => !promos.some((p) => p.name === c.name))
                .map((c) => (
                  <p key={c.name}>
                    ✅ Se aplicó {c.name}: −{money(c.amount)}
                  </p>
                ))}
              <p className="text-base">
                Tu total ahora es <strong className="tabular">{money(changed.total)}</strong>
                {changed.total !== final ? <span className="ml-1.5 text-xs line-through opacity-70">{money(final)}</span> : null}
              </p>
              <p className="text-xs">Si te parece bien, toca de nuevo “Enviar pedido por WhatsApp”.</p>
            </div>
          ) : null}
          {coupons ? (
            <div className="space-y-1">
              <div className="flex gap-2">
                <Input
                  value={couponText}
                  onChange={(e) => setCouponText(e.target.value.toUpperCase().replace(/\s/g, "").slice(0, 20))}
                  placeholder="¿Tienes un cupón?"
                  className="h-10 font-mono uppercase"
                  aria-label="Código del cupón"
                />
                <Button type="button" variant="outline" className="h-10" onClick={() => void applyCoupon()} disabled={checking || !couponText.trim()}>
                  {checking ? <Loader2 className="animate-spin" /> : null}
                  Aplicar
                </Button>
              </div>
              {couponMsg ? <p className="text-xs text-destructive">{couponMsg}</p> : couponOff ? <p className="text-xs text-emerald-700 dark:text-emerald-400">¡Cupón aplicado!</p> : null}
            </div>
          ) : null}
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
