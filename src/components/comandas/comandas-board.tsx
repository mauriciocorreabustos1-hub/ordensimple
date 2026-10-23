"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, ChefHat, Loader2, Minus, PencilLine, Plus, Printer, Search, X } from "lucide-react"
import { toast } from "sonner"
import type { PaymentMethod } from "@/generated/prisma/enums"
import { AppModal } from "@/components/app/app-modal"
import { MoneyInput } from "@/components/app/money-input"
import { PaymentChips } from "@/components/app/payment-chips"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"
import { DiscountField, type DiscountValue } from "@/components/sales/discount-field"
import { ProductImage } from "@/components/products/product-image"
import { applyPromotions, type PromoRule } from "@/lib/promotions"
import { BillStep, clearBill, forgetBillPerson } from "@/components/comandas/bill-split"
import { cancelComanda, chargeComanda, createComanda, saveComanda, sendComandaToKitchen } from "@/server/actions/comandas"

/** sentQty: cuántas se enviaron a la cocina; readyQty: cuántas ya marcó listas; paidQty: cuántas ya se pagaron. */
export type ComandaLine = {
  id: string
  productId: string | null
  description: string
  quantity: number
  unitPrice: number
  note: string
  sentQty: number
  readyQty: number
  paidQty: number
}
export type ComandaData = { id: string; label: string; createdAt: string; items: ComandaLine[] }
export type ComandaProduct = { id: string; name: string; price: number; category: string | null; categoryId?: string | null; imageUrl?: string | null }

/** Lo que falta pagar de cada plato (cuando cada uno paga lo suyo, lo pagado ya no se cobra). */
const leftOf = (i: ComandaLine) => Math.max(0, i.quantity - i.paidQty)
const totalOf = (items: ComandaLine[]) => items.reduce((sum, i) => sum + leftOf(i) * i.unitPrice, 0)
const countOf = (items: ComandaLine[]) => items.reduce((sum, i) => sum + leftOf(i), 0)
const productsLabel = (n: number) => `${n} ${n === 1 ? "producto" : "productos"}`
/** Propina sugerida en Chile. */
const TIP_RATE = 0.1
/** Lo que falta enviar a la cocina. */
const unsentOf = (items: ComandaLine[]) => items.reduce((sum, i) => sum + Math.max(0, i.quantity - i.sentQty), 0)
/** Lo que la cocina está preparando. */
const cookingOf = (items: ComandaLine[]) => items.reduce((sum, i) => sum + Math.max(0, i.sentQty - i.readyQty), 0)

/** Reloj que avanza cada 30 segundos (para "hace 12 min"). */
function useNow() {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])
  return now
}

function elapsed(from: string, now: number) {
  const min = Math.max(0, Math.floor((now - new Date(from).getTime()) / 60_000))
  if (min < 1) return "recién abierta"
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  return `hace ${h} h ${min % 60} min`
}

export function ComandasBoard({
  currency,
  defaultPayment,
  comandas: initial,
  products,
  customers,
  tables,
  canEditTables,
  canApproveDiscounts,
  productsOnly = false,
  promotions = [],
  timezone = "America/Santiago",
  businessName = "",
}: {
  /** Nombre del negocio (sale arriba en la cuenta impresa). */
  businessName?: string
  /** Promociones vigentes en el local (se ven al cobrar; el servidor las vuelve a calcular). */
  promotions?: PromoRule[]
  /** Zona horaria del negocio (para el horario de las promociones). */
  timezone?: string
  currency: string
  defaultPayment: PaymentMethod
  comandas: ComandaData[]
  products: ComandaProduct[]
  customers: string[]
  /** Mesas y lugares configurados (Mesa 1…N, Barra, Para llevar…). */
  tables: string[]
  canEditTables: boolean
  /** Dueño o administrador: aplica descuentos directo. Empleado: los pide. */
  canApproveDiscounts: boolean
  /** Empleado que solo vende productos guardados: sin "Otro producto". */
  productsOnly?: boolean
}) {
  const router = useRouter()
  const now = useNow()
  const money = (n: number) => formatMoney(n, currency)
  const [comandas, setComandas] = React.useState(initial)
  const [openId, setOpenId] = React.useState<string | null>(null)
  const [creating, setCreating] = React.useState(false)

  // Lo que llega del servidor (otra persona abrió o cobró una comanda) reemplaza lo local, menos la que estás editando.
  const [serverData, setServerData] = React.useState(initial)
  if (serverData !== initial) {
    setServerData(initial)
    setComandas(
      initial.map((c) => {
        const local = c.id === openId ? comandas.find((l) => l.id === c.id) : undefined
        if (!local) return c
        // La que estás editando se queda como la tienes, pero con lo que la cocina ya marcó listo.
        const server = new Map(c.items.map((i) => [i.id, i]))
        return {
          ...local,
          items: local.items.map((i) => {
            const paidQty = server.get(i.id)?.paidQty ?? i.paidQty
            const quantity = Math.max(i.quantity, paidQty)
            return {
              ...i,
              quantity,
              paidQty,
              sentQty: Math.min(quantity, server.get(i.id)?.sentQty ?? i.sentQty),
              readyQty: Math.min(quantity, server.get(i.id)?.readyQty ?? i.readyQty),
            }
          }),
        }
      }),
    )
  }

  // Guardado automático: cada cambio se guarda medio segundo después.
  const timers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const pendingSave = React.useRef(new Map<string, Promise<unknown>>())
  const [saving, setSaving] = React.useState(false)

  const persist = React.useCallback(async (c: ComandaData) => {
    setSaving(true)
    const p = saveComanda(c.id, {
      label: c.label,
      items: c.items.map((i) => ({ id: i.id, productId: i.productId ?? undefined, description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, note: i.note })),
    }).then((r) => {
      if (!r.ok) toast.error(r.message)
      return r
    })
    pendingSave.current.set(c.id, p)
    await p
    pendingSave.current.delete(c.id)
    setSaving(pendingSave.current.size > 0)
  }, [])

  // Lo último que hay en pantalla (los cambios se calculan sobre esto, fuera de setState, para que el guardado sea exactamente lo que se ve).
  const latest = React.useRef(comandas)
  React.useLayoutEffect(() => {
    latest.current = comandas
  }, [comandas])

  function update(id: string, change: (c: ComandaData) => ComandaData) {
    const next = latest.current.map((c) => (c.id === id ? change(c) : c))
    latest.current = next
    setComandas(next)
    clearTimeout(timers.current.get(id))
    timers.current.set(
      id,
      setTimeout(() => {
        timers.current.delete(id)
        const c = latest.current.find((x) => x.id === id)
        if (c) void persist(c)
      }, 500),
    )
  }

  /** Guarda ya lo pendiente (antes de cobrar o de cerrar). */
  async function flush(id: string) {
    const t = timers.current.get(id)
    if (t) {
      clearTimeout(t)
      timers.current.delete(id)
      const c = latest.current.find((x) => x.id === id)
      if (c) await persist(c)
    }
    await pendingSave.current.get(id)
  }

  const current = comandas.find((c) => c.id === openId) ?? null

  // Se actualiza sola para ver lo que la cocina marcó listo y lo que abrieron otros garzones.
  React.useEffect(() => {
    const t = setInterval(() => router.refresh(), 15_000)
    return () => clearInterval(t)
  }, [router])

  function closeEditor() {
    if (openId) void flush(openId).then(() => router.refresh())
    setOpenId(null)
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-accent/30 p-4 text-primary transition-colors hover:border-primary hover:bg-accent/60"
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Plus className="size-5" />
          </span>
          <span className="font-semibold">Nueva comanda</span>
        </button>
        {comandas.map((c) => {
          const total = totalOf(c.items)
          const state = !c.items.length ? "empty" : unsentOf(c.items) ? "unsent" : cookingOf(c.items) ? "cooking" : "ready"
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setOpenId(c.id)}
              className={cn(
                "flex min-h-36 flex-col rounded-2xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/50",
                state === "ready" && "border-primary/60 bg-accent/40 ring-1 ring-primary/30",
              )}
            >
              <span className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                <span className="max-w-full shrink-0 font-display text-lg leading-tight font-semibold">{c.label}</span>
                {state === "unsent" ? (
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">Sin enviar</span>
                ) : state === "cooking" ? (
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                    En cocina
                  </span>
                ) : state === "ready" ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                    <Check className="size-3" />
                    Listo
                  </span>
                ) : null}
              </span>
              <span className="mt-1 text-xs text-muted-foreground">
                {elapsed(c.createdAt, now)}
                {state === "ready" ? " · listo para servir" : ""}
              </span>
              <span className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                {c.items.length ? c.items.map((i) => `${i.quantity} ${i.description}`).join(" · ") : "Sin productos todavía"}
              </span>
              <span className="tabular mt-auto pt-3 text-xl font-semibold">{money(total)}</span>
            </button>
          )
        })}
      </div>
      {comandas.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay comandas abiertas. Toca «Nueva comanda» cuando llegue una mesa o un pedido.</p>
      ) : null}

      <NewComandaModal
        open={creating}
        onOpenChange={setCreating}
        tables={tables}
        canEditTables={canEditTables}
        taken={comandas.map((c) => c.label)}
        onOpenExisting={(label) => {
          const c = comandas.find((x) => x.label === label)
          if (c) setOpenId(c.id)
        }}
        onCreated={(c) => {
          setComandas((list) => [...list, c])
          setOpenId(c.id)
          router.refresh()
        }}
      />

      {current ? (
        <ComandaEditor
          key={current.id}
          comanda={current}
          products={products}
          customers={customers}
          currency={currency}
          defaultPayment={defaultPayment}
          canApproveDiscounts={canApproveDiscounts}
          productsOnly={productsOnly}
          promotions={promotions}
          timezone={timezone}
          businessName={businessName}
          saving={saving}
          onChange={(change) => update(current.id, change)}
          onClose={closeEditor}
          flush={() => flush(current.id)}
          onClosed={() => {
            setComandas((list) => list.filter((c) => c.id !== current.id))
            setOpenId(null)
            router.refresh()
          }}
        />
      ) : null}
    </>
  )
}

function NewComandaModal({
  open,
  onOpenChange,
  tables,
  canEditTables,
  taken,
  onOpenExisting,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tables: string[]
  canEditTables: boolean
  taken: string[]
  onOpenExisting: (label: string) => void
  onCreated: (c: ComandaData) => void
}) {
  const [label, setLabel] = React.useState("")
  const [pending, startTransition] = React.useTransition()

  function create(name: string) {
    const value = name.trim()
    if (!value) return
    startTransition(async () => {
      const r = await createComanda({ label: value, items: [] })
      if (!r.ok || !r.data) {
        toast.error(r.ok ? "No se pudo abrir la comanda." : r.message)
        return
      }
      onCreated({ id: r.data.id, label: value, createdAt: new Date().toISOString(), items: [] })
      setLabel("")
      onOpenChange(false)
    })
  }

  return (
    <AppModal open={open} onOpenChange={onOpenChange} title="Nueva comanda" description="¿Para qué mesa, cliente o pedido es?">
      {tables.length ? (
        <div className="grid max-h-[45dvh] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
          {tables.map((l) => {
            const used = taken.includes(l)
            return (
              <button
                key={l}
                type="button"
                disabled={pending}
                // Si la mesa ya tiene comanda, se abre esa en vez de crear otra.
                onClick={() => {
                  if (!used) return create(l)
                  onOpenChange(false)
                  onOpenExisting(l)
                }}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center rounded-xl border px-2 py-2 text-center text-sm font-medium transition-colors",
                  used ? "border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200" : "bg-card hover:border-primary/50 hover:bg-accent/40",
                )}
              >
                <span className="leading-tight">{l}</span>
                {used ? <span className="text-[11px] font-normal">ocupada · ver</span> : null}
              </button>
            )
          })}
        </div>
      ) : null}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          create(label)
        }}
      >
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={tables.length ? "U otro nombre: Juan, Pedido WhatsApp…" : "Ej.: Mesa 12, Juan, Pedido WhatsApp"}
          maxLength={40}
          aria-label="Nombre de la comanda"
          className="h-11"
        />
        <Button type="submit" className="h-11" disabled={pending || !label.trim()}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Abrir
        </Button>
      </form>
      {canEditTables ? (
        <p className="text-xs text-muted-foreground">
          ¿Tienes más mesas o una barra?{" "}
          <Link href="/dashboard/configuracion#mesas" className="font-medium text-primary hover:underline">
            Cámbialas en Configuración
          </Link>
          .
        </p>
      ) : null}
    </AppModal>
  )
}

function ComandaEditor({
  comanda,
  products,
  customers,
  currency,
  defaultPayment,
  canApproveDiscounts,
  productsOnly,
  promotions,
  timezone,
  businessName,
  saving,
  onChange,
  onClose,
  flush,
  onClosed,
}: {
  promotions: PromoRule[]
  timezone: string
  businessName: string
  comanda: ComandaData
  products: ComandaProduct[]
  customers: string[]
  currency: string
  defaultPayment: PaymentMethod
  canApproveDiscounts: boolean
  productsOnly: boolean
  saving: boolean
  onChange: (change: (c: ComandaData) => ComandaData) => void
  onClose: () => void
  flush: () => Promise<void>
  onClosed: () => void
}) {
  const money = (n: number) => formatMoney(n, currency)
  const [query, setQuery] = React.useState("")
  const [category, setCategory] = React.useState<string | null>(null)
  const [noteFor, setNoteFor] = React.useState<number | null>(null)
  const [custom, setCustom] = React.useState<{ description: string; price: number } | null>(null)
  const [step, setStep] = React.useState<"edit" | "charge" | "cancel" | "bill">("edit")
  /** Persona de la cuenta impresa a la que se le está cobrando (para sacarla de la lista al terminar). */
  const [chargingPerson, setChargingPerson] = React.useState<string | null>(null)
  const [payment, setPayment] = React.useState<PaymentMethod>(defaultPayment === "FIADO" ? "CASH" : defaultPayment)
  const [customer, setCustomer] = React.useState("")
  const [pending, startTransition] = React.useTransition()

  // Cobrar todo o "cada uno paga lo suyo" (se eligen los platos de esa persona).
  const [split, setSplit] = React.useState<Record<string, number> | null>(null)
  const [tipMode, setTipMode] = React.useState<"none" | "suggested" | "other">("none")
  const [otherTip, setOtherTip] = React.useState(0)
  const [people, setPeople] = React.useState(2)
  /** Cambia en cada parte cobrada, para que el descuento empiece de cero con la siguiente persona. */
  const [round, setRound] = React.useState(0)
  const chargeLines = split
    ? comanda.items.filter((i) => (split[i.id] ?? 0) > 0).map((i) => ({ ...i, take: split[i.id] }))
    : comanda.items.filter((i) => leftOf(i) > 0).map((i) => ({ ...i, take: leftOf(i) }))
  const subtotal = step === "charge" ? chargeLines.reduce((sum, i) => sum + i.take * i.unitPrice, 0) : totalOf(comanda.items)
  const [disc, setDisc] = React.useState<{ value: DiscountValue | null; blocked: string | null }>({ value: null, blocked: null })
  // Promociones del local sobre lo que se cobra ahora (el servidor las vuelve a calcular al cobrar).
  const categoryOf = new Map(products.map((p) => [p.id, p.categoryId ?? null]))
  const promo =
    step === "charge"
      ? applyPromotions(
          chargeLines.map((i) => ({ key: i.id, productId: i.productId, categoryId: i.productId ? (categoryOf.get(i.productId) ?? null) : null, quantity: i.take, unitPrice: i.unitPrice })),
          promotions,
          { now: new Date(), timezone, channel: "store" },
        )
      : { discount: 0, applied: [] }
  const total = step === "charge" ? subtotal - promo.discount - (disc.value?.discount ?? 0) : subtotal
  const tip = payment === "FIADO" ? 0 : tipMode === "suggested" ? Math.round(total * TIP_RATE) : tipMode === "other" ? otherTip : 0
  const categories = [...new Set(products.map((p) => p.category).filter((c): c is string => Boolean(c)))]
  const q = query.trim().toLowerCase()
  const shown = products.filter((p) => (!category || p.category === category) && (!q || p.name.toLowerCase().includes(q))).slice(0, 60)

  const setItems = (change: (items: ComandaLine[]) => ComandaLine[]) => onChange((c) => ({ ...c, items: change(c.items) }))

  function add(line: Omit<ComandaLine, "id" | "quantity" | "note" | "sentQty" | "readyQty" | "paidQty">) {
    const id = crypto.randomUUID()
    setItems((items) => {
      // Si ya está (sin nota), suma uno; si no, agrega la línea al final.
      const i = items.findIndex((x) => x.productId === line.productId && x.description === line.description && !x.note)
      if (i >= 0) return items.map((x, k) => (k === i ? { ...x, quantity: x.quantity + 1 } : x))
      if (items.length >= 50) {
        toast.error("Máximo 50 productos distintos por comanda.")
        return items
      }
      return [...items, { ...line, id, quantity: 1, note: "", sentQty: 0, readyQty: 0, paidQty: 0 }]
    })
  }
  const setQty = (index: number, quantity: number) => {
    const paid = comanda.items[index]?.paidQty ?? 0
    if (paid > 0 && quantity < paid) return void toast.info("Eso ya se pagó: no se puede quitar.")
    setItems((items) => (quantity <= 0 ? items.filter((_, k) => k !== index) : items.map((x, k) => (k === index ? { ...x, quantity } : x))))
  }
  const setNote = (index: number, note: string) => setItems((items) => items.map((x, k) => (k === index ? { ...x, note } : x)))

  function charge() {
    if (disc.blocked) return toast.error(disc.blocked)
    startTransition(async () => {
      await flush()
      const r = await chargeComanda(comanda.id, {
        paymentMethod: payment,
        customerName: payment === "FIADO" ? customer : undefined,
        ...(disc.value ?? {}),
        tip,
        parts: split ? chargeLines.map((i) => ({ id: i.id, quantity: i.take })) : undefined,
      })
      if (!r.ok) {
        toast.error(r.message)
        return
      }
      const paidAll = !split || comanda.items.every((i) => leftOf(i) === (split[i.id] ?? 0))
      const tipText = tip ? ` + propina ${money(tip)}` : ""
      const fromBill = chargingPerson
      if (paidAll) clearBill(comanda.id)
      else if (fromBill) forgetBillPerson(comanda.id, fromBill)
      setChargingPerson(null)
      if (!paidAll) {
        // Queda abierta con lo que falta: se marca lo pagado y se sigue cobrando al siguiente.
        onChange((c) => ({ ...c, items: c.items.map((i) => ({ ...i, paidQty: i.paidQty + (split?.[i.id] ?? 0) })) }))
        toast.success(`${comanda.label}: parte cobrada (${money(total)}${tipText}). Falta ${money(totalOf(comanda.items) - subtotal)}.`)
        setSplit({})
        setTipMode("none")
        setDisc({ value: null, blocked: null })
        setRound((n) => n + 1)
        // Si venía de la cuenta por persona, vuelve a ella para cobrarle al siguiente.
        if (fromBill) setStep("bill")
        return
      }
      toast.success(`${comanda.label}: ${r.message?.toLowerCase() ?? "cobrada"} (${money(total)}${tipText})`)
      onClosed()
    })
  }

  function cancel() {
    startTransition(async () => {
      await flush()
      const r = await cancelComanda(comanda.id)
      if (!r.ok) {
        toast.error(r.message)
        return
      }
      toast.success(`${comanda.label}: comanda anulada`)
      onClosed()
    })
  }

  const unsent = unsentOf(comanda.items)

  /** Manda a la pantalla de Cocina lo que todavía no se había enviado. */
  function sendToKitchen() {
    startTransition(async () => {
      await flush()
      const r = await sendComandaToKitchen(comanda.id)
      if (!r.ok) {
        toast.error(r.message)
        return
      }
      onChange((c) => ({ ...c, items: c.items.map((i) => ({ ...i, sentQty: i.quantity })) }))
      const sent = r.data?.sent ?? unsent
      toast.success(`${comanda.label}: ${sent} enviado${sent === 1 ? "" : "s"} a la cocina`)
    })
  }


  return (
    <AppModal
      open
      onOpenChange={(o) => (o ? null : onClose())}
      title={step === "charge" ? `Cobrar ${comanda.label}` : step === "cancel" ? `¿Anular ${comanda.label}?` : step === "bill" ? `Cuenta de ${comanda.label}` : comanda.label}
      description={step === "edit" ? (saving ? "Guardando…" : "Los cambios se guardan solos.") : undefined}
      className="sm:max-w-4xl"
      noAutoFocus
    >
      {step === "bill" ? (
        <BillStep
          comanda={comanda}
          currency={currency}
          businessName={businessName}
          promotions={promotions}
          timezone={timezone}
          categoryOf={categoryOf}
          onBack={() => setStep("edit")}
          onCharge={(counts, personId) => {
            setSplit(counts)
            setChargingPerson(personId)
            setRound((n) => n + 1)
            setDisc({ value: null, blocked: null })
            setStep("charge")
          }}
        />
      ) : step === "charge" ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label="Cómo se paga la cuenta">
            {[
              { key: "all", label: "Todo junto" },
              { key: "split", label: "Cada uno lo suyo" },
            ].map((t) => {
              const active = (t.key === "split") === Boolean(split)
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setSplit(t.key === "split" ? {} : null)
                    setChargingPerson(null)
                    setRound((n) => n + 1)
                    setDisc({ value: null, blocked: null })
                  }}
                  className={cn("rounded-lg py-2 text-sm font-medium transition-colors", active ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >
                  {t.label}
                </button>
              )
            })}
          </div>

          {split ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">¿Qué paga esta persona?</p>
              <ul className="divide-y rounded-xl border">
                {comanda.items
                  .filter((i) => leftOf(i) > 0)
                  .map((i) => {
                    const n = split[i.id] ?? 0
                    const set = (v: number) => setSplit({ ...split, [i.id]: Math.max(0, Math.min(leftOf(i), v)) })
                    return (
                      <li key={i.id} className="flex items-center gap-2 p-2.5">
                        <span className="min-w-0 flex-1 text-sm leading-tight">
                          {i.description}
                          <span className="block text-xs text-muted-foreground">
                            {money(i.unitPrice)} · {leftOf(i) === 1 ? "queda 1" : `quedan ${leftOf(i)}`}
                          </span>
                        </span>
                        <div className="flex items-center rounded-lg border">
                          <button type="button" className="flex size-9 items-center justify-center disabled:opacity-30" aria-label={`Uno menos de ${i.description}`} onClick={() => set(n - 1)} disabled={!n}>
                            <Minus className="size-3.5" />
                          </button>
                          <span className="tabular w-6 text-center text-sm font-semibold">{n}</span>
                          <button
                            type="button"
                            className="flex size-9 items-center justify-center disabled:opacity-30"
                            aria-label={`Uno más de ${i.description}`}
                            onClick={() => set(n + 1)}
                            disabled={n >= leftOf(i)}
                          >
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                      </li>
                    )
                  })}
              </ul>
            </div>
          ) : null}

          <div className="rounded-2xl bg-accent/50 p-5 text-center">
            <p className="text-sm text-muted-foreground">{split ? "Paga esta persona" : "Total a cobrar"}</p>
            <p className="tabular font-display text-4xl font-semibold">{money(total + tip)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {split ? `${chargeLines.reduce((s, i) => s + i.take, 0)} de ${countOf(comanda.items)} productos` : productsLabel(countOf(comanda.items))}
              {disc.value ? ` · descuento de ${money(disc.value.discount)}` : ""}
              {tip ? ` · cuenta ${money(total)} + propina ${money(tip)}` : ""}
            </p>
            {promo.applied.length ? (
              <div className="mt-2 space-y-0.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                {promo.applied.map((a) => (
                  <p key={a.promotionId}>
                    🏷️ {a.name}: −{money(a.amount)}
                  </p>
                ))}
              </div>
            ) : null}
            {!split && total > 0 ? (
              <div className="mt-3 flex items-center justify-center gap-2 text-sm">
                <span className="text-muted-foreground">Dividir entre</span>
                <div className="flex items-center rounded-lg border bg-background">
                  <button type="button" className="flex size-8 items-center justify-center disabled:opacity-30" aria-label="Una persona menos" onClick={() => setPeople(Math.max(2, people - 1))} disabled={people <= 2}>
                    <Minus className="size-3.5" />
                  </button>
                  <span className="tabular w-6 text-center font-semibold">{people}</span>
                  <button type="button" className="flex size-8 items-center justify-center" aria-label="Una persona más" onClick={() => setPeople(Math.min(30, people + 1))}>
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <span>
                  = <span className="tabular font-semibold">{money(Math.ceil((total + tip) / people))}</span> c/u
                </span>
              </div>
            ) : null}
          </div>
          {subtotal > 0 ? (
            <DiscountField key={round} subtotal={subtotal - promo.discount} context={comanda.label} canApprove={canApproveDiscounts} currency={currency} onChange={setDisc} />
          ) : null}
          {payment !== "FIADO" && total > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">¿Dejaron propina?</p>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { key: "none" as const, label: "Sin propina" },
                  { key: "suggested" as const, label: `10% (${money(Math.round(total * TIP_RATE))})` },
                  { key: "other" as const, label: "Otro monto" },
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    aria-pressed={tipMode === t.key}
                    onClick={() => setTipMode(t.key)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition-colors",
                      tipMode === t.key ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-muted",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
                {tipMode === "other" ? (
                  <MoneyInput value={otherTip} onValueChange={setOtherTip} currency={currency} aria-label="Monto de la propina" className="w-32" />
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">La propina se guarda aparte: no suma a tus ventas.</p>
            </div>
          ) : null}
          <div className="space-y-2">
            <p className="text-sm font-medium">¿Cómo te pagaron?</p>
            <PaymentChips value={payment} onChange={setPayment} />
          </div>
          {payment === "FIADO" ? (
            <div className="space-y-1.5">
              <label htmlFor="comanda-customer" className="text-sm font-medium">
                ¿Quién te debe?
              </label>
              <Input
                id="comanda-customer"
                list="comanda-customers"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder="Nombre del cliente"
                maxLength={80}
                className="h-11"
              />
              <datalist id="comanda-customers">
                {customers.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" size="lg" className="h-12" onClick={() => setStep(chargingPerson ? "bill" : "edit")} disabled={pending}>
              Volver
            </Button>
            <Button size="lg" className="h-12" onClick={charge} disabled={pending || subtotal <= 0 || (payment === "FIADO" && !customer.trim())}>
              {pending ? <Loader2 className="animate-spin" /> : <Check />}
              Confirmar cobro
            </Button>
          </div>
        </div>
      ) : step === "cancel" ? (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            La comanda se cierra sin registrar venta. Úsalo si el cliente se fue sin consumir o si la abriste por error.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" size="lg" className="h-12" onClick={() => setStep("edit")} disabled={pending}>
              No, volver
            </Button>
            <Button variant="destructive" size="lg" className="h-12" onClick={cancel} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              Sí, anular
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_320px]">
            {/* Productos para agregar */}
            <div className="min-w-0 space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar producto" className="h-11 pl-9" aria-label="Buscar producto" />
              </div>
              {categories.length > 1 ? (
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {[null, ...categories].map((c) => (
                    <button
                      key={c ?? "todas"}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={cn(
                        "h-9 shrink-0 rounded-full border px-3.5 text-xs font-medium sm:h-8",
                        category === c ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/50",
                      )}
                    >
                      {c ?? "Todo"}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="grid max-h-[46dvh] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 md:max-h-[52dvh]">
                {shown.map((p) => {
                  const qty = comanda.items.filter((i) => i.productId === p.id).reduce((s, i) => s + i.quantity, 0)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => add({ productId: p.id, description: p.name, unitPrice: p.price })}
                      className={cn(
                        "relative flex min-h-20 flex-col justify-between rounded-xl border bg-card p-3 text-left text-sm transition-colors hover:border-primary/50 active:scale-[0.98]",
                        qty > 0 && "border-primary/60 bg-accent/40",
                      )}
                    >
                      {p.imageUrl ? <ProductImage name={p.name} url={p.imageUrl} className="mb-1.5 aspect-[4/3] w-full" /> : null}
                      <span className="line-clamp-2 leading-snug font-medium">{p.name}</span>
                      <span className="tabular text-xs text-muted-foreground">{money(p.price)}</span>
                      {qty > 0 ? (
                        <span className="tabular absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                          {qty}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
                {productsOnly ? null : (
                  <button
                    type="button"
                    onClick={() => setCustom({ description: query.trim(), price: 0 })}
                    className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed p-3 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  >
                    <Plus className="size-4" />
                    Otro producto
                  </button>
                )}
              </div>
              {custom ? (
                <form
                  className="grid gap-2 rounded-xl border bg-muted/30 p-3 sm:grid-cols-[1fr_140px_auto]"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!custom.description.trim() || custom.price <= 0) return toast.error("Escribe qué es y su precio.")
                    add({ productId: null, description: custom.description.trim().slice(0, 120), unitPrice: custom.price })
                    setCustom(null)
                  }}
                >
                  <Input
                    autoFocus
                    value={custom.description}
                    onChange={(e) => setCustom({ ...custom, description: e.target.value })}
                    placeholder="Qué es (ej.: Agregado palta)"
                    maxLength={120}
                    aria-label="Descripción"
                  />
                  <MoneyInput value={custom.price} onValueChange={(v) => setCustom({ ...custom, price: v })} currency={currency} aria-label="Precio" />
                  <div className="flex gap-2">
                    <Button type="submit">Agregar</Button>
                    <Button type="button" variant="ghost" size="icon" aria-label="Cancelar" onClick={() => setCustom(null)}>
                      <X />
                    </Button>
                  </div>
                </form>
              ) : null}
            </div>

            {/* Lo que lleva la comanda */}
            <div className="min-w-0 space-y-2 md:border-l md:pl-5">
              <div className="flex items-center justify-between gap-2">
                <p id="comanda-pedido" className="scroll-mt-4 text-sm font-medium">
                  Pedido
                </p>
                <input
                  value={comanda.label}
                  onChange={(e) => onChange((c) => ({ ...c, label: e.target.value.slice(0, 40) || c.label }))}
                  aria-label="Nombre de la comanda"
                  className="w-32 rounded-md border border-transparent bg-transparent px-2 py-1 text-right text-xs text-muted-foreground hover:border-input focus:border-ring focus:outline-none"
                />
              </div>
              {comanda.items.length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">Toca los productos para agregarlos.</p>
              ) : (
                <ul className="divide-y rounded-xl border">
                  {comanda.items.map((item, i) => (
                    <li key={item.id} className="space-y-1.5 p-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center rounded-lg border">
                          <button type="button" className="flex size-9 items-center justify-center sm:size-8" aria-label="Quitar uno" onClick={() => setQty(i, item.quantity - 1)}>
                            <Minus className="size-3.5" />
                          </button>
                          <span className="tabular w-6 text-center text-sm font-semibold">{item.quantity}</span>
                          <button type="button" className="flex size-9 items-center justify-center sm:size-8" aria-label="Agregar uno" onClick={() => setQty(i, item.quantity + 1)}>
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                        <span className="min-w-0 flex-1 text-sm leading-tight">
                          {item.description}
                          {item.note && noteFor !== i ? <span className="block text-xs text-amber-700 dark:text-amber-400">{item.note}</span> : null}
                          {item.paidQty ? (
                            <span className="mt-0.5 block text-[11px] font-medium text-primary">
                              {item.paidQty >= item.quantity ? "Pagado" : `${item.paidQty} pagado${item.paidQty === 1 ? "" : "s"}`}
                            </span>
                          ) : null}
                          {item.quantity > item.sentQty ? (
                            <span className="mt-0.5 block text-[11px] font-medium text-muted-foreground">
                              {item.sentQty ? `+${item.quantity - item.sentQty} sin enviar a cocina` : "Sin enviar a cocina"}
                            </span>
                          ) : null}
                        </span>
                        {item.quantity > item.sentQty ? null : item.readyQty >= item.quantity ? (
                          <span title="La cocina lo marcó listo" className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Check className="size-3" />
                          </span>
                        ) : (
                          <span title="En la cocina" className="flex size-5 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15">
                            <ChefHat className="size-3" />
                          </span>
                        )}
                        <span className="tabular text-sm font-medium">{money(item.quantity * item.unitPrice)}</span>
                        <button
                          type="button"
                          aria-label="Agregar nota"
                          onClick={() => setNoteFor(noteFor === i ? null : i)}
                          className={cn("flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted sm:size-8", item.note && "text-amber-700")}
                        >
                          <PencilLine className="size-3.5" />
                        </button>
                      </div>
                      {noteFor === i ? (
                        <Input
                          autoFocus
                          value={item.note}
                          onChange={(e) => setNote(i, e.target.value.slice(0, 80))}
                          onKeyDown={(e) => e.key === "Enter" && setNoteFor(null)}
                          placeholder="Nota: sin mayo, para llevar…"
                          className="h-9 text-sm"
                          aria-label={`Nota para ${item.description}`}
                        />
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="sticky -bottom-5 -mx-5 flex flex-wrap items-center gap-2 border-t bg-background px-5 pt-3 pb-1 sm:-bottom-6 sm:-mx-6 sm:px-6">
            <div className="mr-auto">
              {/* En el celular el pedido queda abajo de los productos: tocar aquí lleva a él. */}
              <button
                type="button"
                onClick={() => document.getElementById("comanda-pedido")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="-my-2 py-2 text-xs text-muted-foreground underline-offset-2 hover:underline md:pointer-events-none md:no-underline"
              >
                {productsLabel(countOf(comanda.items))}<span className="md:hidden"> · ver pedido</span>
              </button>
              <p className="tabular text-xl font-semibold">{money(total)}</p>
            </div>
            <Button variant="ghost" className="text-muted-foreground" onClick={() => setStep("cancel")}>
              Anular
            </Button>
            <Button variant={unsent ? "default" : "outline"} onClick={sendToKitchen} disabled={pending || !unsent}>
              {pending ? <Loader2 className="animate-spin" /> : <ChefHat />}
              {unsent ? `Enviar a cocina (${unsent})` : "Enviado a cocina"}
            </Button>
            <Button variant="outline" onClick={() => setStep("bill")} disabled={!countOf(comanda.items)}>
              <Printer />
              Cuenta
            </Button>
            <Button
              variant={unsent ? "outline" : "default"}
              onClick={() => {
                setChargingPerson(null)
                setStep("charge")
              }}
              disabled={!comanda.items.length}
            >
              Cobrar
            </Button>
          </div>
        </>
      )}
    </AppModal>
  )
}
