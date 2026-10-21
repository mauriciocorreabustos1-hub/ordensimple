"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Clock, Loader2, Pencil, Plus, Tag, Ticket, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { AppModal } from "@/components/app/app-modal"
import { MoneyInput } from "@/components/app/money-input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { formatMoney } from "@/lib/currency"
import { promoActive, promoBadge, WEEKDAYS, type PromoRule } from "@/lib/promotions"
import { cn } from "@/lib/utils"
import { deleteCoupon, deletePromotion, saveCoupon, savePromotion, setPromotionActive } from "@/server/actions/promotions"

type Option = { id: string; name: string }

export type PromotionRow = {
  id: string
  name: string
  kind: "PERCENT" | "BUY_X_PAY_Y"
  percent: number | null
  buyQty: number | null
  payQty: number | null
  scope: string
  productIds: string[]
  categoryId: string | null
  startsAt: string | null
  endsAt: string | null
  startsAtIso: string | null
  endsAtIso: string | null
  weekdays: number[]
  fromTime: string | null
  toTime: string | null
  fromMinute: number | null
  toMinute: number | null
  inStore: boolean
  online: boolean
  active: boolean
  used: { amount: number; count: number }
}

export type CouponRow = {
  id: string
  code: string
  percent: number | null
  amount: number | null
  minTotal: number
  maxUses: number | null
  uses: number
  endsAt: string | null
  expired: boolean
  active: boolean
}

const dayLabel = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("es-CL", { day: "numeric", month: "short" })

/** Estado de la promoción ahora: activa, fuera de horario, programada, vencida o pausada. */
function statusOf(p: PromotionRow, now: Date, timezone: string) {
  if (!p.active) return { label: "Pausada", tone: "bg-muted text-muted-foreground" }
  if (p.endsAtIso && new Date(p.endsAtIso) <= now) return { label: "Terminada", tone: "bg-muted text-muted-foreground" }
  if (p.startsAtIso && new Date(p.startsAtIso) > now) return { label: "Programada", tone: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300" }
  const rule = { ...p, startsAt: p.startsAtIso, endsAt: p.endsAtIso } as PromoRule
  return promoActive(rule, now, timezone)
    ? { label: "Activa ahora", tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" }
    : { label: "Fuera de horario", tone: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" }
}

export function PromotionsManager({
  promotions,
  coupons,
  products,
  categories,
  currency,
  now: nowIso,
  timezone,
  storeEnabled,
}: {
  promotions: PromotionRow[]
  coupons: CouponRow[]
  products: Option[]
  categories: Option[]
  currency: string
  now: string
  timezone: string
  storeEnabled: boolean
}) {
  const router = useRouter()
  const money = (n: number) => formatMoney(n, currency)
  const now = new Date(nowIso)
  const [tab, setTab] = React.useState<"promos" | "coupons">("promos")
  const [editing, setEditing] = React.useState<PromotionRow | "new" | null>(null)
  const [editingCoupon, setEditingCoupon] = React.useState<CouponRow | "new" | null>(null)
  const [busy, setBusy] = React.useState<string | null>(null)
  const productName = new Map(products.map((p) => [p.id, p.name]))
  const categoryName = new Map(categories.map((c) => [c.id, c.name]))

  async function run(id: string, action: () => Promise<{ ok: boolean; message?: string }>) {
    setBusy(id)
    const r = await action()
    setBusy(null)
    if (r.ok) toast.success(r.message)
    else toast.error(r.message)
    router.refresh()
  }

  const scopeText = (p: PromotionRow) =>
    p.scope === "ALL"
      ? "Todos los productos"
      : p.scope === "CATEGORY"
        ? `Categoría ${categoryName.get(p.categoryId ?? "") ?? "(eliminada)"}`
        : p.productIds.map((id) => productName.get(id) ?? "(producto eliminado)").slice(0, 3).join(", ") + (p.productIds.length > 3 ? ` y ${p.productIds.length - 3} más` : "")
  const whenText = (p: PromotionRow) =>
    [
      p.weekdays.length && p.weekdays.length < 7 ? p.weekdays.map((d) => WEEKDAYS[d]).join(", ") : null,
      p.fromTime && p.toTime ? `${p.fromTime} a ${p.toTime}` : null,
      p.startsAt || p.endsAt ? `${p.startsAt ? `desde el ${dayLabel(p.startsAt)}` : ""}${p.startsAt && p.endsAt ? " " : ""}${p.endsAt ? `hasta el ${dayLabel(p.endsAt)}` : ""}` : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Siempre"

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" role="tablist">
          {(
            [
              ["promos", `Promociones (${promotions.length})`],
              ["coupons", `Cupones (${coupons.length})`],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cn("rounded-lg px-4 py-2 text-sm font-medium", tab === k ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              {label}
            </button>
          ))}
        </div>
        <Button onClick={() => (tab === "promos" ? setEditing("new") : setEditingCoupon("new"))}>
          <Plus />
          {tab === "promos" ? "Nueva promoción" : "Nuevo cupón"}
        </Button>
      </div>

      {tab === "promos" ? (
        promotions.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center">
            <Tag className="mx-auto size-8 text-primary" />
            <p className="mt-2 font-medium">Todavía no tienes promociones</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Crea un 2×1, un descuento en una categoría o un happy hour. Se aplica solo al vender: tu equipo no tiene que acordarse de nada.
            </p>
            <Button className="mt-4" onClick={() => setEditing("new")}>
              <Plus />
              Crear mi primera promoción
            </Button>
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {promotions.map((p) => {
              const st = statusOf(p, now, timezone)
              return (
                <li key={p.id} className="space-y-3 rounded-2xl border bg-card p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-xl bg-primary px-2 text-sm font-bold text-primary-foreground">{promoBadge(p)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{p.name}</p>
                      <p className="truncate text-sm text-muted-foreground">{scopeText(p)}</p>
                    </div>
                    <Switch checked={p.active} disabled={busy === p.id} onCheckedChange={(v) => void run(p.id, () => setPromotionActive(p.id, v))} aria-label={`Activar ${p.name}`} />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className={cn("rounded-full px-2 py-0.5 font-medium", st.tone)}>{st.label}</span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="size-3" />
                      {whenText(p)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    {p.inStore ? <Badge variant="outline">En el local</Badge> : null}
                    {p.online ? <Badge variant="outline">Tienda online</Badge> : null}
                    <span className="ml-auto text-muted-foreground">
                      {p.used.count ? `${p.used.count} ${p.used.count === 1 ? "venta" : "ventas"} · ${money(p.used.amount)} descontado (30 días)` : "Sin uso en 30 días"}
                    </span>
                  </div>
                  <div className="flex gap-2 border-t pt-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(p)}>
                      <Pencil />
                      Editar
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={busy === p.id} onClick={() => void run(p.id, () => deletePromotion(p.id))}>
                      <Trash2 />
                      Eliminar
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )
      ) : (
        <>
          {!storeEnabled ? (
            <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              Los cupones se usan en tu tienda online, y todavía no está publicada. Actívala en Configuración → Tienda online.
            </p>
          ) : null}
          {coupons.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-8 text-center">
              <Ticket className="mx-auto size-8 text-primary" />
              <p className="mt-2 font-medium">Todavía no tienes cupones</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Crea un código como BIENVENIDO10 y compártelo en tus redes: quien lo escriba al pedir en tu tienda online recibe el descuento.
              </p>
              <Button className="mt-4" onClick={() => setEditingCoupon("new")}>
                <Plus />
                Crear mi primer cupón
              </Button>
            </div>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {coupons.map((c) => (
                <li key={c.id} className="space-y-2 rounded-2xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-lg font-bold tracking-wider">{c.code}</p>
                      <p className="text-sm text-muted-foreground">
                        {c.percent ? `${c.percent} % de descuento` : `${money(c.amount ?? 0)} de descuento`}
                        {c.minTotal ? ` · compras desde ${money(c.minTotal)}` : ""}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                        !c.active || c.expired || (c.maxUses !== null && c.uses >= c.maxUses)
                          ? "bg-muted text-muted-foreground"
                          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
                      )}
                    >
                      {!c.active ? "Pausado" : c.expired ? "Vencido" : c.maxUses !== null && c.uses >= c.maxUses ? "Agotado" : "Activo"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Usado {c.uses} {c.uses === 1 ? "vez" : "veces"}
                    {c.maxUses !== null ? ` de ${c.maxUses}` : ""}
                    {c.endsAt ? ` · vence el ${dayLabel(c.endsAt)}` : ""}
                  </p>
                  <div className="flex gap-2 border-t pt-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditingCoupon(c)}>
                      <Pencil />
                      Editar
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={busy === c.id} onClick={() => void run(c.id, () => deleteCoupon(c.id))}>
                      <Trash2 />
                      Eliminar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {editing ? (
        <PromotionDialog
          key={editing === "new" ? "new" : editing.id}
          initial={editing === "new" ? null : editing}
          products={products}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            router.refresh()
          }}
        />
      ) : null}
      {editingCoupon ? (
        <CouponDialog
          key={editingCoupon === "new" ? "new" : editingCoupon.id}
          initial={editingCoupon === "new" ? null : editingCoupon}
          currency={currency}
          onClose={() => setEditingCoupon(null)}
          onSaved={() => {
            setEditingCoupon(null)
            router.refresh()
          }}
        />
      ) : null}
    </div>
  )
}

function Chips<T extends string | number>({ options, value, onChange, multiple = false }: { options: { value: T; label: string }[]; value: T[]; onChange: (v: T[]) => void; multiple?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o.value)
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(multiple ? (on ? value.filter((v) => v !== o.value) : [...value, o.value]) : [o.value])}
            className={cn("rounded-full border px-3 py-1.5 text-sm", on ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-muted")}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function PromotionDialog({
  initial,
  products,
  categories,
  onClose,
  onSaved,
}: {
  initial: PromotionRow | null
  products: Option[]
  categories: Option[]
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = React.useState(initial?.name ?? "")
  const [kind, setKind] = React.useState<"PERCENT" | "BUY_X_PAY_Y">(initial?.kind ?? "BUY_X_PAY_Y")
  const [percent, setPercent] = React.useState(String(initial?.percent ?? 20))
  const [buyQty, setBuyQty] = React.useState(initial?.buyQty ?? 2)
  const [payQty, setPayQty] = React.useState(initial?.payQty ?? 1)
  const [scope, setScope] = React.useState<"ALL" | "PRODUCTS" | "CATEGORY">((initial?.scope as "ALL" | "PRODUCTS" | "CATEGORY") ?? "PRODUCTS")
  const [productIds, setProductIds] = React.useState<string[]>(initial?.productIds ?? [])
  const [categoryId, setCategoryId] = React.useState<string>(initial?.categoryId ?? categories[0]?.id ?? "")
  const [query, setQuery] = React.useState("")
  const [weekdays, setWeekdays] = React.useState<number[]>(initial?.weekdays ?? [])
  const [hours, setHours] = React.useState(Boolean(initial?.fromTime))
  const [fromTime, setFromTime] = React.useState(initial?.fromTime ?? "18:00")
  const [toTime, setToTime] = React.useState(initial?.toTime ?? "20:00")
  const [startsAt, setStartsAt] = React.useState(initial?.startsAt ?? "")
  const [endsAt, setEndsAt] = React.useState(initial?.endsAt ?? "")
  const [inStore, setInStore] = React.useState(initial?.inStore ?? true)
  const [online, setOnline] = React.useState(initial?.online ?? true)
  const [pending, startTransition] = React.useTransition()
  const q = query.trim().toLowerCase()
  const shown = products.filter((p) => !q || p.name.toLowerCase().includes(q)).slice(0, 60)

  // Nombre sugerido mientras no lo escriban.
  const suggested = `${kind === "PERCENT" ? `${percent || "?"} % de descuento` : `${buyQty}×${payQty}`}${
    scope === "CATEGORY" ? ` en ${categories.find((c) => c.id === categoryId)?.name ?? ""}` : scope === "PRODUCTS" && productIds.length === 1 ? ` en ${products.find((p) => p.id === productIds[0])?.name ?? ""}` : ""
  }`

  function save(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const r = await savePromotion(initial?.id ?? null, {
        name: name.trim() || suggested,
        kind,
        percent: kind === "PERCENT" ? Number(percent) || null : null,
        buyQty: kind === "BUY_X_PAY_Y" ? buyQty : null,
        payQty: kind === "BUY_X_PAY_Y" ? payQty : null,
        scope,
        productIds: scope === "PRODUCTS" ? productIds : [],
        categoryId: scope === "CATEGORY" ? categoryId || null : null,
        startsAt: startsAt || null,
        endsAt: endsAt || null,
        weekdays,
        fromTime: hours ? fromTime : null,
        toTime: hours ? toTime : null,
        inStore,
        online,
        active: initial?.active ?? true,
      })
      if (!r.ok) return void toast.error(r.message)
      toast.success(r.message)
      onSaved()
    })
  }

  return (
    <AppModal open onOpenChange={(o) => !o && onClose()} title={initial ? "Editar promoción" : "Nueva promoción"} className="sm:max-w-xl" noAutoFocus>
      <form onSubmit={save} className="space-y-5">
        <section className="space-y-2">
          <p className="text-sm font-medium">¿Qué tipo de promoción?</p>
          <Chips
            options={[
              { value: "BUY_X_PAY_Y", label: "Lleva X, paga Y (2×1, 3×2…)" },
              { value: "PERCENT", label: "% de descuento" },
            ]}
            value={[kind]}
            onChange={(v) => setKind(v[0] as "PERCENT" | "BUY_X_PAY_Y")}
          />
          {kind === "PERCENT" ? (
            <label className="flex items-center gap-2 text-sm">
              <Input value={percent} onChange={(e) => setPercent(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" className="w-20" aria-label="Porcentaje" />% de descuento
            </label>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              Lleva
              <Input type="number" min={2} max={20} value={buyQty} onChange={(e) => setBuyQty(Math.max(2, Math.min(20, Number(e.target.value) || 2)))} className="w-20" aria-label="Lleva" />
              y paga
              <Input type="number" min={1} max={19} value={payQty} onChange={(e) => setPayQty(Math.max(1, Math.min(19, Number(e.target.value) || 1)))} className="w-20" aria-label="Paga" />
              <span className="text-muted-foreground">{payQty < buyQty ? `(${buyQty - payQty} gratis cada ${buyQty})` : "(paga tiene que ser menor)"}</span>
            </div>
          )}
        </section>

        <section className="space-y-2">
          <p className="text-sm font-medium">¿En qué productos?</p>
          <Chips
            options={[
              { value: "PRODUCTS", label: "Productos que elijo" },
              ...(categories.length ? [{ value: "CATEGORY" as const, label: "Una categoría" }] : []),
              { value: "ALL", label: "Todos" },
            ]}
            value={[scope]}
            onChange={(v) => setScope(v[0] as "ALL" | "PRODUCTS" | "CATEGORY")}
          />
          {scope === "CATEGORY" ? (
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm" aria-label="Categoría">
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : scope === "PRODUCTS" ? (
            <div className="space-y-2 rounded-xl border p-2">
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar producto" aria-label="Buscar producto" />
              <div className="max-h-48 space-y-0.5 overflow-y-auto">
                {shown.map((p) => {
                  const on = productIds.includes(p.id)
                  return (
                    <label key={p.id} className={cn("flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm", on ? "bg-primary/10" : "hover:bg-muted")}>
                      <input type="checkbox" checked={on} onChange={() => setProductIds(on ? productIds.filter((x) => x !== p.id) : [...productIds, p.id])} className="size-4 accent-primary" />
                      {p.name}
                    </label>
                  )
                })}
              </div>
              <p className="px-1 text-xs text-muted-foreground">{productIds.length ? `${productIds.length} elegidos` : "Marca uno o más productos"}</p>
            </div>
          ) : null}
        </section>

        <section className="space-y-2">
          <p className="text-sm font-medium">
            ¿Cuándo? <span className="font-normal text-muted-foreground">(si no eliges nada, vale siempre)</span>
          </p>
          <Chips multiple options={WEEKDAYS.map((d, i) => ({ value: i, label: d })).slice(1).concat({ value: 0, label: "Dom" })} value={weekdays} onChange={setWeekdays} />
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={hours} onCheckedChange={setHours} />
            Solo en un horario (happy hour)
          </label>
          {hours ? (
            <div className="flex items-center gap-2 text-sm">
              De
              <Input type="time" value={fromTime} onChange={(e) => setFromTime(e.target.value)} className="w-32" aria-label="Desde" />a
              <Input type="time" value={toTime} onChange={(e) => setToTime(e.target.value)} className="w-32" aria-label="Hasta" />
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            Desde
            <Input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="w-40" aria-label="Fecha de inicio" />
            hasta
            <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="w-40" aria-label="Fecha de término" />
          </div>
        </section>

        <section className="space-y-2">
          <p className="text-sm font-medium">¿Dónde se aplica?</p>
          <label className="flex items-center justify-between gap-3 text-sm">
            Al vender en el local (ventas y comandas)
            <Switch checked={inStore} onCheckedChange={setInStore} />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            En la tienda online
            <Switch checked={online} onCheckedChange={setOnline} />
          </label>
        </section>

        <section className="space-y-1.5">
          <label htmlFor="promo-name" className="text-sm font-medium">
            Nombre
          </label>
          <Input id="promo-name" value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} placeholder={suggested} />
          <p className="text-xs text-muted-foreground">Se ve en el detalle de la venta, en la tienda y en los reportes.</p>
        </section>

        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Guardar
          </Button>
        </div>
      </form>
    </AppModal>
  )
}

function CouponDialog({ initial, currency, onClose, onSaved }: { initial: CouponRow | null; currency: string; onClose: () => void; onSaved: () => void }) {
  const [code, setCode] = React.useState(initial?.code ?? "")
  const [type, setType] = React.useState<"percent" | "amount">(initial?.amount ? "amount" : "percent")
  const [percent, setPercent] = React.useState(String(initial?.percent ?? 10))
  const [amount, setAmount] = React.useState(initial?.amount ?? 0)
  const [minTotal, setMinTotal] = React.useState(initial?.minTotal ?? 0)
  const [maxUses, setMaxUses] = React.useState(initial?.maxUses ? String(initial.maxUses) : "")
  const [endsAt, setEndsAt] = React.useState(initial?.endsAt ?? "")
  const [active, setActive] = React.useState(initial?.active ?? true)
  const [pending, startTransition] = React.useTransition()

  function save(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const r = await saveCoupon(initial?.id ?? null, {
        code,
        percent: type === "percent" ? Number(percent) || null : null,
        amount: type === "amount" ? amount || null : null,
        minTotal,
        maxUses: maxUses ? Number(maxUses) : null,
        endsAt: endsAt || null,
        active,
      })
      if (!r.ok) return void toast.error(r.message)
      toast.success(r.message)
      onSaved()
    })
  }

  return (
    <AppModal open onOpenChange={(o) => !o && onClose()} title={initial ? "Editar cupón" : "Nuevo cupón"} description="Para tu tienda online: el cliente escribe el código al hacer el pedido." noAutoFocus>
      <form onSubmit={save} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="coupon-code" className="text-sm font-medium">
            Código
          </label>
          <Input
            id="coupon-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 20))}
            placeholder="BIENVENIDO10"
            className="font-mono tracking-wider uppercase"
          />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Descuento</p>
          <Chips
            options={[
              { value: "percent", label: "Porcentaje" },
              { value: "amount", label: "Monto fijo" },
            ]}
            value={[type]}
            onChange={(v) => setType(v[0] as "percent" | "amount")}
          />
          {type === "percent" ? (
            <label className="flex items-center gap-2 text-sm">
              <Input value={percent} onChange={(e) => setPercent(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" className="w-20" aria-label="Porcentaje" />%
            </label>
          ) : (
            <MoneyInput value={amount} onValueChange={setAmount} currency={currency} aria-label="Monto del descuento" className="w-40" />
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Compra mínima</p>
            <MoneyInput value={minTotal} onValueChange={setMinTotal} currency={currency} aria-label="Compra mínima" />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">¿Cuántas veces se puede usar?</p>
            <Input value={maxUses} onChange={(e) => setMaxUses(e.target.value.replace(/\D/g, "").slice(0, 7))} inputMode="numeric" placeholder="Sin límite" aria-label="Usos máximos" />
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium">
            Vence <span className="font-normal text-muted-foreground">(opcional)</span>
          </p>
          <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="w-44" aria-label="Fecha de vencimiento" />
        </div>
        <label className="flex items-center justify-between gap-3 text-sm">
          Activo
          <Switch checked={active} onCheckedChange={setActive} />
        </label>
        <p className="text-xs text-muted-foreground">El cupón se suma a las promociones de la tienda: primero se aplican las promociones y el cupón va sobre lo que queda.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending || code.length < 3}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Guardar
          </Button>
        </div>
      </form>
    </AppModal>
  )
}
