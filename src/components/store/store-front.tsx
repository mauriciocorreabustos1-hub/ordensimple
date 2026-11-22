"use client"

import * as React from "react"
import { toast } from "sonner"
import { Check, CheckCircle2, CreditCard, Loader2, Minus, PackageSearch, Plus, Search, Share2, ShoppingBag, ShoppingBasket, Store, Truck, X } from "lucide-react"
import { AppModal } from "@/components/app/app-modal"
import { WhatsAppIcon } from "@/components/landing/social-links"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { formatMoney } from "@/lib/currency"
import { orderTrackPath, orderWhatsappText } from "@/lib/store"
import { cn } from "@/lib/utils"
import { whatsappLink } from "@/lib/whatsapp"
import { createWebOrder, existingStoreOrders, previewCoupon } from "@/server/actions/store"
import { payWebOrder } from "@/server/actions/online-payments"
import { applyPromotions, promoActive, promoBadge, promoHint, type PromoRule } from "@/lib/promotions"
import { ProductImage } from "@/components/products/product-image"

export type StoreProduct = { id: string; name: string; price: number; category: string | null; categoryId?: string | null; max: number; imageUrl?: string | null; description?: string | null; uses?: string | null; benefits?: string | null }

/** "Usos" o "Beneficios" en la ficha: un punto por cada línea que escribió el negocio. */
function SheetList({ title, text, marker }: { title: string; text: string; marker: "dot" | "check" }) {
  const items = text.split("\n").map((l) => l.replace(/^[-•*·\s]+/, "").trim()).filter(Boolean)
  if (!items.length) return null
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold">{title}</p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm leading-snug text-muted-foreground">
            {marker === "check" ? (
              <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            ) : (
              <span aria-hidden className="mt-[0.45rem] size-1.5 shrink-0 rounded-full bg-primary" />
            )}
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Ficha del producto: al tocarlo se abre con la foto grande, la descripción completa, el precio y los botones para
 * agregarlo. Es "fixed": en la tienda cubre la pantalla y en la vista previa de Configuración queda dentro del teléfono.
 */
function ProductSheet({
  product: p,
  price,
  hint,
  badge,
  phone,
  onClose,
  onShare,
  children,
}: {
  /** Copia o comparte el enlace directo a este producto. */
  onShare: () => void
  /** Vista previa dentro del teléfono: siempre como hoja desde abajo y sin bloquear la página de atrás. */
  phone: boolean
  product: StoreProduct
  price: string
  hint: string | null
  badge: string | null
  onClose: () => void
  children: React.ReactNode
}) {
  const closeRef = React.useRef<HTMLButtonElement>(null)
  const onEscape = React.useEffectEvent(onClose)
  React.useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEscape()
    }
    window.addEventListener("keydown", onKey)
    // Que la página de atrás no se desplace mientras la ficha está abierta.
    const before = document.body.style.overflow
    if (!phone) document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      if (!phone) document.body.style.overflow = before
    }
  }, [phone])

  const titleId = `ficha-${p.id}`
  return (
    <div className={cn("fixed inset-0 z-30 flex items-end justify-center", !phone && "sm:items-center sm:p-4")} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" tabIndex={-1} aria-hidden className="absolute inset-0 cursor-default bg-black/50 animate-in fade-in" onClick={onClose} />
      <div className={cn(
          "relative flex max-h-[90%] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-background shadow-2xl animate-in slide-in-from-bottom-6",
          !phone && "sm:rounded-3xl",
        )}>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-3 right-3 z-10 flex size-9 items-center justify-center rounded-full border bg-background/95 shadow-sm"
        >
          <X className="size-4" />
        </button>
        <button
          type="button"
          onClick={onShare}
          aria-label={`Compartir ${p.name}`}
          title="Compartir"
          className="absolute top-3 right-14 z-10 flex size-9 items-center justify-center rounded-full border bg-background/95 shadow-sm"
        >
          <Share2 className="size-4" />
        </button>
        <div className="overflow-y-auto">
          {p.imageUrl ? (
            <div className="relative">
              <ProductImage name={p.name} url={p.imageUrl} sizes="large" className="aspect-square w-full rounded-none" />
              {badge ? <span className="absolute top-3 left-3 rounded-full bg-rose-600 px-2.5 py-0.5 text-sm font-bold text-white shadow">{badge}</span> : null}
            </div>
          ) : null}
          <div className="space-y-3 p-5">
            <div className={cn(!p.imageUrl && "pr-20")}>
              {p.category ? <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{p.category}</p> : null}
              <h2 id={titleId} className="mt-0.5 text-xl leading-tight font-semibold">
                {p.name}
                {badge && !p.imageUrl ? <span className="ml-2 rounded-full bg-rose-600 px-2 py-0.5 align-middle text-xs font-bold text-white">{badge}</span> : null}
              </h2>
              <p className="tabular mt-1.5 text-lg font-semibold">{price}</p>
            </div>
            {hint ? <p className="text-sm font-medium text-rose-700 dark:text-rose-400">🎁 {hint}</p> : null}
            {p.description ? <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{p.description}</p> : null}
            {p.uses ? <SheetList title="Usos" text={p.uses} marker="dot" /> : null}
            {p.benefits ? <SheetList title="Beneficios" text={p.benefits} marker="check" /> : null}
            {p.max > 0 && p.max <= 5 ? <p className="text-xs font-medium text-warning">{p.max === 1 ? "Queda 1 unidad" : `Quedan ${p.max} unidades`}</p> : null}
          </div>
        </div>
        <div className="flex gap-2 border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] *:flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}

const CART_KEY = (slug: string) => `ordensimple-carro-${slug}`
/** Pedidos hechos desde este teléfono, para volver a ver en qué van. */
const ORDERS_KEY = (slug: string) => `ordensimple-pedidos-${slug}`
const ORDERS_DAYS = 14

type Done = { link: string; code: string; track: string }
type RecentOrder = { code: string; track: string; at: number }

function readRecent(slug: string): RecentOrder[] {
  try {
    const list = JSON.parse(localStorage.getItem(ORDERS_KEY(slug)) ?? "[]") as RecentOrder[]
    return Array.isArray(list) ? list.filter((o) => o && typeof o.track === "string" && Date.now() - o.at < ORDERS_DAYS * 86_400_000).slice(0, 3) : []
  } catch {
    return []
  }
}

/** Deja en el teléfono solo los pedidos que siguen existiendo (el negocio pudo eliminarlos). */
function keepRecent(slug: string, tracks: string[]) {
  try {
    const keep = readRecent(slug).filter((o) => tracks.includes(o.track))
    localStorage.setItem(ORDERS_KEY(slug), JSON.stringify(keep))
    return keep
  } catch {
    return []
  }
}

function saveRecent(slug: string, order: RecentOrder) {
  try {
    localStorage.setItem(ORDERS_KEY(slug), JSON.stringify([order, ...readRecent(slug)].slice(0, 3)))
  } catch {}
}

/** Catálogo público: el cliente arma su pedido y lo envía por WhatsApp (queda guardado para el negocio). */
export function StoreFront({
  slug,
  businessName,
  currency,
  products,
  promotions = [],
  timezone = "America/Santiago",
  coupons = false,
  table = null,
  payRule = null,
  preview = false,
  openProductId = null,
}: {
  /** Producto que viene en el enlace (?p=…): la tienda se abre con su ficha. */
  openProductId?: string | null
  /** Vista previa en Configuración: se ve igual, pero no busca pedidos ni deja enviar uno. */
  preview?: boolean
  /** Qué cobra online el negocio al pedir (lo fija el dueño): todo, solo despachos, o nada. */
  payRule?: "ALL" | "DELIVERY" | null
  /** Mesa desde la que abrieron la carta con el QR (el pedido se sirve en la mesa). */
  table?: string | null
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
  /** Producto abierto en su ficha (foto grande y descripción completa). */
  const [detail, setDetail] = React.useState<StoreProduct | null>(() => products.find((p) => p.id === openProductId) ?? null)
  // Enlace a un producto que ya no está a la venta (sin stock o desactivado): se avisa y se muestra la tienda.
  React.useEffect(() => {
    if (openProductId && !products.some((p) => p.id === openProductId)) toast.info("Ese producto ya no está disponible. Mira los demás.")
    // Solo al abrir la página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** La dirección de la página lleva el producto abierto, para que se pueda copiar o volver atrás. */
  const setUrlProduct = (id: string | null) => {
    if (preview) return
    try {
      const url = new URL(window.location.href)
      if (id) url.searchParams.set("p", id)
      else url.searchParams.delete("p")
      window.history.replaceState(window.history.state, "", url)
    } catch {}
  }
  const openDetail = (p: StoreProduct) => {
    setDetail(p)
    setUrlProduct(p.id)
  }
  const closeDetail = () => {
    setDetail(null)
    setUrlProduct(null)
  }
  /** En el celular abre el menú de compartir (WhatsApp, Instagram…); en el computador copia el enlace. */
  async function shareProduct(p: StoreProduct) {
    if (preview) return void toast.info("Cuando publiques tu tienda, aquí copias el enlace de este producto para compartirlo.")
    const url = `${window.location.origin}/tienda/${slug}?p=${encodeURIComponent(p.id)}`
    const text = `${p.name} · ${money(p.price)} en ${businessName}`
    const phone = window.matchMedia?.("(pointer: coarse)").matches
    if (phone && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: p.name, text, url })
        return
      } catch (error) {
        // La persona cerró el menú: no hay nada que avisar.
        if (error instanceof DOMException && error.name === "AbortError") return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Enlace copiado. Pégalo en WhatsApp, Instagram o donde quieras.")
    } catch {
      toast.info(url, { description: "Copia este enlace para compartir el producto.", duration: 15000 })
    }
  }
  const [done, setDone] = React.useState<Done | null>(null)
  const [recent, setRecent] = React.useState<RecentOrder[]>([])
  React.useEffect(() => {
    if (preview) return
    const saved = readRecent(slug)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage solo existe en el navegador
    setRecent(saved)
    if (!saved.length) return
    // Se revisa con el negocio: los pedidos eliminados dejan de aparecer.
    let alive = true
    existingStoreOrders(slug, saved.map((o) => o.track)).then((tracks) => {
      if (alive && tracks.length < saved.length) setRecent(keepRecent(slug, tracks))
    }).catch(() => {})
    return () => {
      alive = false
    }
  }, [slug, preview])

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
  const shown = products.filter((p) => (!category || p.category === category) && (!q || p.name.toLowerCase().includes(q) || Boolean(p.description?.toLowerCase().includes(q))))
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

  /** En las tarjetas: un "+" verde; al agregar, cambia a − cantidad +. */
  const compact = (p: StoreProduct, inline = false) => {
    const n = cart[p.id] ?? 0
    return n ? (
      <div className={cn("flex items-center rounded-xl bg-primary text-primary-foreground", !inline && "basis-full justify-between")}>
        <button type="button" className="flex size-9 items-center justify-center" aria-label={`Uno menos de ${p.name}`} onClick={() => set(p, n - 1)}>
          <Minus className="size-4" />
        </button>
        <span className="tabular min-w-5 text-center text-sm font-bold">{n}</span>
        <button
          type="button"
          className="flex size-9 items-center justify-center disabled:opacity-40"
          aria-label={`Uno más de ${p.name}`}
          onClick={() => set(p, n + 1)}
          disabled={n >= p.max}
        >
          <Plus className="size-4" />
        </button>
      </div>
    ) : (
      <button
        type="button"
        onClick={() => set(p, 1)}
        aria-label={`Agregar ${p.name}`}
        className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-transform hover:bg-primary/90 active:scale-90"
      >
        <Plus className="size-4" strokeWidth={2.75} />
      </button>
    )
  }

  if (!products.length) {
    return <p className="rounded-xl border bg-background p-6 text-center text-sm text-muted-foreground">Por ahora no hay productos publicados. Vuelve pronto.</p>
  }

  return (
    <>
      {recent.length ? (
        <div className="space-y-1.5 rounded-xl border bg-background px-4 py-3 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <PackageSearch className="size-4 text-primary" />
            {recent.length === 1 ? "Tu pedido" : "Tus pedidos"}
          </p>
          <ul className="flex flex-wrap gap-2">
            {recent.map((o) => (
              <li key={o.track}>
                <a href={orderTrackPath(o.track)} className="inline-flex rounded-lg bg-primary/10 px-3 py-1.5 font-medium text-primary hover:bg-primary/15">
                  Ver en qué va el n.º {o.code}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {table ? (
        <p className="rounded-xl bg-primary/10 px-4 py-3 text-sm font-medium text-primary">🍽️ Estás en {table}. Elige lo que quieras y envía tu pedido: te lo llevamos a la mesa.</p>
      ) : null}
      <div className="sticky top-0 z-10 -mx-4 space-y-2 bg-muted/95 px-4 pt-2 pb-3 backdrop-blur dark:bg-background/95">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar productos" className="h-11 rounded-2xl border-transparent bg-background pl-9 shadow-[0_1px_3px_oklch(0_0_0/0.05)]" aria-label="Buscar productos" />
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
                  "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  category === c ? "bg-[oklch(0.33_0.08_163)] text-white" : "bg-foreground/[0.06] hover:bg-foreground/10",
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
        !withPhotos ? (
          <ul className="space-y-2">
            {shown.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-foreground/5 bg-background py-3 pr-3 pl-4 shadow-[0_1px_3px_oklch(0_0_0/0.04)] dark:bg-muted/60">
                <button type="button" onClick={() => openDetail(p)} className="block min-w-0 flex-1 text-left" aria-label={`Ver ${p.name}`}>
                  <span className="block leading-tight font-medium">
                    {p.name}
                    {badgeOf(p) ? <span className="ml-1.5 rounded-full bg-rose-600 px-1.5 py-0.5 align-middle text-[10px] font-bold text-white">{badgeOf(p)}</span> : null}
                  </span>
                  {p.description ? <span className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">{p.description}</span> : null}
                  <span className="tabular mt-1 block text-lg font-bold tracking-tight">{money(p.price)}</span>
                  {hintOf(p) ? <span className="mt-0.5 block text-xs font-medium text-rose-700 dark:text-rose-400">🎁 {hintOf(p)}</span> : null}
                </button>
                <div className="shrink-0">{compact(p, true)}</div>
              </li>
            ))}
          </ul>
        ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {shown.map((p) => (
            <li key={p.id} className="flex flex-col rounded-3xl border border-foreground/5 bg-background p-2.5 dark:bg-muted/60 shadow-[0_1px_3px_oklch(0_0_0/0.04)]">
              <button type="button" onClick={() => openDetail(p)} className="flex flex-1 flex-col text-left" aria-label={`Ver ${p.name}`}>
                {withPhotos ? (
                  <span className="relative mb-2.5 block">
                    {p.imageUrl ? (
                      <ProductImage name={p.name} url={p.imageUrl} sizes="large" className="aspect-[5/4] w-full rounded-2xl" />
                    ) : (
                      <span aria-hidden className="flex aspect-[5/4] w-full items-center justify-center rounded-2xl bg-muted text-foreground/15">
                        <ShoppingBag className="size-10" strokeWidth={1.5} />
                      </span>
                    )}
                    {badgeOf(p) ? <span className="absolute top-2 left-2 rounded-full bg-rose-600 px-2 py-0.5 text-xs font-bold text-white shadow">{badgeOf(p)}</span> : null}
                  </span>
                ) : badgeOf(p) ? (
                  <span className="mb-1.5 self-start rounded-full bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">{badgeOf(p)}</span>
                ) : null}
                <span className={cn("block min-w-0 flex-1 px-1", !withPhotos && "pt-1")}>
                  <span className="line-clamp-2 leading-tight font-medium">{p.name}</span>
                  {p.description ? <span className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">{p.description}</span> : null}
                  {hintOf(p) ? <span className="mt-1 block text-xs font-medium text-rose-700 dark:text-rose-400">🎁 {hintOf(p)}</span> : null}
                </span>
              </button>
              <div className="mt-2.5 flex min-h-9 flex-wrap items-center justify-between gap-x-1 gap-y-2 pl-1">
                <span className="tabular truncate text-lg font-bold tracking-tight">{money(p.price)}</span>
                {compact(p)}
              </div>
            </li>
          ))}
        </ul>
        )
      )}

      {detail ? (
        <ProductSheet
          product={detail}
          price={money(detail.price)}
          hint={hintOf(detail)}
          badge={badgeOf(detail)}
          phone={preview}
          onClose={closeDetail}
          onShare={() => void shareProduct(detail)}
        >
          {quantity(detail, true)}
          {cart[detail.id] ? (
            <Button size="lg" className="h-10" onClick={closeDetail}>
              Listo
            </Button>
          ) : null}
        </ProductSheet>
      ) : null}

      {count ? (
        <div className="fixed inset-x-0 bottom-0 z-20 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-3xl bg-[oklch(0.33_0.08_163)] py-2.5 pr-2.5 pl-5 text-white shadow-lg shadow-black/15">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-white/65">
                {count} {count === 1 ? "producto" : "productos"}
              </p>
              <p className="tabular text-xl font-bold tracking-tight">
                {money(total)}
                {promo.discount ? <span className="ml-2 text-sm font-normal text-white/60 line-through">{money(gross)}</span> : null}
              </p>
            </div>
            <Button
              size="lg"
              className="h-12 rounded-2xl bg-[oklch(0.8_0.15_160)] px-5 font-bold text-[oklch(0.2_0.04_165)] hover:bg-[oklch(0.84_0.15_160)]"
              onClick={() => (preview ? toast.info("Esto es una vista previa. Cuando publiques tu tienda, aquí tus clientes envían el pedido.") : setCheckout(true))}
            >
              <ShoppingBasket />
              Hacer pedido
            </Button>
          </div>
        </div>
      ) : null}

      {checkout ? (
        <Checkout
          table={table}
          slug={slug}
          businessName={businessName}
          money={money}
          lines={lines}
          gross={gross}
          promos={promo.applied}
          hints={hints}
          total={total}
          coupons={coupons}
          payRule={table ? null : payRule}
          done={done}
          onDone={(d) => {
            setDone(d)
            setCart({})
            saveRecent(slug, { code: d.code, track: d.track, at: Date.now() })
            setRecent(readRecent(slug))
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
  table,
  slug,
  businessName,
  money,
  lines,
  gross,
  hints,
  promos,
  total,
  coupons,
  payRule,
  done,
  onDone,
  onClose,
}: {
  payRule: "ALL" | "DELIVERY" | null
  table: string | null
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
  done: Done | null
  onDone: (d: Done) => void
  onClose: () => void
}) {
  const [name, setName] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [delivery, setDelivery] = React.useState(false)
  const [note, setNote] = React.useState("")
  const [website, setWebsite] = React.useState("")
  // Lo fija el negocio: este pedido se paga online al hacerlo (el cliente no elige).
  const paying = payRule === "ALL" || (payRule === "DELIVERY" && delivery)
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
        customerEmail: email.trim() || undefined,
        delivery: table ? false : delivery,
        table: table ?? undefined,
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
        table: r.data.table,
        trackUrl: `${window.location.origin}${orderTrackPath(r.data.track)}`,
      })
      const link = whatsappLink(r.data.whatsapp, text)
      onDone({ link, code: r.data.code, track: r.data.track })
      if (r.data.payNow) {
        // Pagar ahora: a Mercado Pago. Al volver, ve su pedido pagado (y el negocio recibe el aviso).
        const pay = await payWebOrder(r.data.track)
        if (pay.ok && pay.data) {
          window.location.href = pay.data.url
          return
        }
        setError(pay.message ?? "No se pudo iniciar el pago. Envía el pedido por WhatsApp y paga al retirar.")
        return
      }
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
          <Button asChild variant="outline" className="w-full">
            <a href={orderTrackPath(done.track)}>
              <PackageSearch />
              Ver en qué va mi pedido
            </a>
          </Button>
          <p className="text-xs text-muted-foreground">El enlace también va en tu mensaje de WhatsApp, para revisarlo cuando quieras.</p>
          <Button variant="ghost" onClick={onClose}>
            Seguir mirando
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <ul className="space-y-2.5 rounded-2xl border border-foreground/5 bg-muted/60 p-4 text-sm">
            {lines.map((l) => (
              <li key={l.id} className="flex items-center gap-3">
                {l.imageUrl ? (
                  <ProductImage name={l.name} url={l.imageUrl} className="size-10 shrink-0 rounded-xl" />
                ) : lines.some((x) => x.imageUrl) ? (
                  // Si otras líneas tienen foto, un cuadro neutro mantiene todo alineado.
                  <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background text-foreground/20">
                    <ShoppingBag className="size-4" />
                  </span>
                ) : null}
                <span className="tabular flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md bg-primary/12 px-1.5 text-xs font-bold text-primary">
                  {l.quantity}
                </span>
                <span className="min-w-0 flex-1 leading-snug">{l.name}</span>
                <span className="tabular shrink-0 font-medium">{money(l.quantity * l.price)}</span>
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
            <li className="flex items-baseline justify-between border-t-2 border-dashed border-foreground/10 pt-3">
              <span className="font-semibold">Total</span>
              <span className="tabular text-2xl font-bold tracking-tight">
                {money(changed ? changed.total : final)}
                {(changed ? changed.total : final) < gross ? <span className="ml-2 text-sm font-normal text-muted-foreground line-through">{money(gross)}</span> : null}
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
          {table ? (
            <p className="rounded-xl bg-primary/10 px-4 py-3 text-sm font-medium text-primary">🍽️ Tu pedido es para {table}: te lo llevamos a la mesa.</p>
          ) : (
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">¿Cómo lo quieres recibir?</legend>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Entrega">
                {[
                  { v: false, label: "Retiro en el local", sub: "Pasas a buscarlo", Icon: Store },
                  { v: true, label: "Despacho", sub: "Te lo llevamos", Icon: Truck },
                ].map((o) => (
                  <button
                    key={o.label}
                    type="button"
                    role="radio"
                    aria-checked={delivery === o.v}
                    onClick={() => setDelivery(o.v)}
                    className={cn(
                      "flex flex-col items-start gap-1.5 rounded-2xl border-2 p-3 text-left transition-colors",
                      delivery === o.v ? "border-primary bg-primary/[0.07]" : "border-foreground/10 hover:border-foreground/20",
                    )}
                  >
                    <o.Icon className={cn("size-5", delivery === o.v ? "text-primary" : "text-muted-foreground")} />
                    <span className="text-sm leading-tight font-semibold">{o.label}</span>
                    <span className="text-xs text-muted-foreground">{o.sub}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <div className="space-y-1.5">
            <label htmlFor="store-note" className="text-sm font-medium">
              {delivery ? "Dirección de despacho" : "Comentarios"} {delivery ? null : <span className="font-normal text-muted-foreground">(opcional)</span>}
            </label>
            <Textarea
              id="store-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              rows={2}
              className="rounded-xl"
              placeholder={delivery ? "Calle, número, depto y comuna. Si quieres, un comentario." : table ? "Ej.: sin cebolla, la bebida bien fría" : "Ej.: paso a las 18:00"}
            />
          </div>
          <fieldset className="space-y-3">
            <legend className="mb-2 text-sm font-semibold">Tus datos</legend>
            <div className="space-y-1.5">
              <label htmlFor="store-name" className="text-sm font-medium">
                Nombre
              </label>
              <Input id="store-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={60} autoComplete="name" className="h-11 rounded-xl" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="store-phone" className="text-sm font-medium">
                  Teléfono <span className="font-normal text-muted-foreground">(opcional)</span>
                </label>
                <Input id="store-phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} inputMode="tel" autoComplete="tel" className="h-11 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="store-email" className="text-sm font-medium">
                  Correo <span className="font-normal text-muted-foreground">(opcional)</span>
                </label>
                <Input id="store-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} autoComplete="email" inputMode="email" className="h-11 rounded-xl" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Con tu correo te enviamos la confirmación y el enlace para ver en qué va tu pedido.</p>
          </fieldset>
          {paying ? (
            <p className="flex gap-2.5 rounded-xl bg-primary/[0.07] px-3.5 py-3 text-sm text-pretty">
              <CreditCard className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                {businessName} cobra {payRule === "DELIVERY" ? "los despachos" : "los pedidos"} al pedir. Pagas ahora con tarjeta o Mercado Pago.
              </span>
            </p>
          ) : null}
          {/* Campo trampa para robots (las personas no lo ven). */}
          <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
          {error ? (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {paying ? (
            <Button type="submit" size="lg" className="h-13 w-full rounded-2xl bg-[oklch(0.33_0.08_163)] text-base font-bold text-white hover:bg-[oklch(0.3_0.08_163)]" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <CreditCard className="size-5" />}
              Pagar {money(changed ? changed.total : final)}
            </Button>
          ) : (
            <Button type="submit" size="lg" className="h-13 w-full rounded-2xl bg-[#25D366] text-base font-bold text-white hover:bg-[#1fb757]" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <WhatsAppIcon className="size-5" />}
              Enviar pedido por WhatsApp
            </Button>
          )}
          <p className="text-center text-xs text-muted-foreground">
            {paying ? "Pagas de forma segura en Mercado Pago y el negocio recibe tu pedido pagado." : "El negocio confirma el pedido, el pago y la entrega por WhatsApp."}
          </p>
        </form>
      )}
    </AppModal>
  )
}
