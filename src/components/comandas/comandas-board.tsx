"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Check, ChefHat, Loader2, Minus, PencilLine, Plus, Search, X } from "lucide-react"
import { toast } from "sonner"
import type { PaymentMethod } from "@/generated/prisma/enums"
import { AppModal } from "@/components/app/app-modal"
import { MoneyInput } from "@/components/app/money-input"
import { PaymentChips } from "@/components/app/payment-chips"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"
import { cancelComanda, chargeComanda, createComanda, saveComanda, sendComandaToKitchen } from "@/server/actions/comandas"

/** sentQty: cuántas se enviaron a la cocina; readyQty: cuántas ya marcó listas. */
export type ComandaLine = { id: string; productId: string | null; description: string; quantity: number; unitPrice: number; note: string; sentQty: number; readyQty: number }
export type ComandaData = { id: string; label: string; createdAt: string; items: ComandaLine[] }
export type ComandaProduct = { id: string; name: string; price: number; category: string | null }

const QUICK_LABELS = ["Mesa 1", "Mesa 2", "Mesa 3", "Mesa 4", "Mesa 5", "Mesa 6", "Para llevar", "Delivery"]

const totalOf = (items: ComandaLine[]) => items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)
const countOf = (items: ComandaLine[]) => items.reduce((sum, i) => sum + i.quantity, 0)
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
}: {
  currency: string
  defaultPayment: PaymentMethod
  comandas: ComandaData[]
  products: ComandaProduct[]
  customers: string[]
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
          items: local.items.map((i) => ({
            ...i,
            sentQty: Math.min(i.quantity, server.get(i.id)?.sentQty ?? i.sentQty),
            readyQty: Math.min(i.quantity, server.get(i.id)?.readyQty ?? i.readyQty),
          })),
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
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setOpenId(c.id)}
              className="flex min-h-36 flex-col rounded-2xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/50"
            >
              <span className="flex items-start justify-between gap-2">
                <span className="font-display text-lg leading-tight font-semibold">{c.label}</span>
                <ChefHat className="size-4 shrink-0 text-muted-foreground" />
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {elapsed(c.createdAt, now)}
                {!c.items.length ? null : unsentOf(c.items) ? (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 font-medium text-foreground">Sin enviar a cocina</span>
                ) : cookingOf(c.items) ? (
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">En cocina</span>
                ) : (
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-medium text-primary">Listo para servir</span>
                )}
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
        taken={comandas.map((c) => c.label)}
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
  taken,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  taken: string[]
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
      <div className="flex flex-wrap gap-2">
        {QUICK_LABELS.map((l) => {
          const used = taken.includes(l)
          return (
            <button
              key={l}
              type="button"
              disabled={pending || used}
              onClick={() => create(l)}
              title={used ? "Ya tiene una comanda abierta" : undefined}
              className="rounded-full border bg-card px-3.5 py-2 text-sm font-medium transition-colors hover:border-primary/50 disabled:opacity-40"
            >
              {l}
            </button>
          )
        })}
      </div>
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
          placeholder="Ej.: Mesa 12, Juan, Pedido WhatsApp"
          maxLength={40}
          aria-label="Nombre de la comanda"
          className="h-11"
        />
        <Button type="submit" className="h-11" disabled={pending || !label.trim()}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Abrir
        </Button>
      </form>
    </AppModal>
  )
}

function ComandaEditor({
  comanda,
  products,
  customers,
  currency,
  defaultPayment,
  saving,
  onChange,
  onClose,
  flush,
  onClosed,
}: {
  comanda: ComandaData
  products: ComandaProduct[]
  customers: string[]
  currency: string
  defaultPayment: PaymentMethod
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
  const [step, setStep] = React.useState<"edit" | "charge" | "cancel">("edit")
  const [payment, setPayment] = React.useState<PaymentMethod>(defaultPayment === "FIADO" ? "CASH" : defaultPayment)
  const [customer, setCustomer] = React.useState("")
  const [pending, startTransition] = React.useTransition()

  const total = totalOf(comanda.items)
  const categories = [...new Set(products.map((p) => p.category).filter((c): c is string => Boolean(c)))]
  const q = query.trim().toLowerCase()
  const shown = products.filter((p) => (!category || p.category === category) && (!q || p.name.toLowerCase().includes(q))).slice(0, 60)

  const setItems = (change: (items: ComandaLine[]) => ComandaLine[]) => onChange((c) => ({ ...c, items: change(c.items) }))

  function add(line: Omit<ComandaLine, "id" | "quantity" | "note" | "sentQty" | "readyQty">) {
    const id = crypto.randomUUID()
    setItems((items) => {
      // Si ya está (sin nota), suma uno; si no, agrega la línea al final.
      const i = items.findIndex((x) => x.productId === line.productId && x.description === line.description && !x.note)
      if (i >= 0) return items.map((x, k) => (k === i ? { ...x, quantity: x.quantity + 1 } : x))
      if (items.length >= 50) {
        toast.error("Máximo 50 productos distintos por comanda.")
        return items
      }
      return [...items, { ...line, id, quantity: 1, note: "", sentQty: 0, readyQty: 0 }]
    })
  }
  const setQty = (index: number, quantity: number) =>
    setItems((items) => (quantity <= 0 ? items.filter((_, k) => k !== index) : items.map((x, k) => (k === index ? { ...x, quantity } : x))))
  const setNote = (index: number, note: string) => setItems((items) => items.map((x, k) => (k === index ? { ...x, note } : x)))

  function charge() {
    startTransition(async () => {
      await flush()
      const r = await chargeComanda(comanda.id, { paymentMethod: payment, customerName: payment === "FIADO" ? customer : undefined })
      if (!r.ok) {
        toast.error(r.message)
        return
      }
      toast.success(`${comanda.label}: ${r.message?.toLowerCase() ?? "cobrada"} (${money(total)})`)
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
      title={step === "charge" ? `Cobrar ${comanda.label}` : step === "cancel" ? `¿Anular ${comanda.label}?` : comanda.label}
      description={step === "edit" ? (saving ? "Guardando…" : "Los cambios se guardan solos.") : undefined}
      className="sm:max-w-4xl"
    >
      {step === "charge" ? (
        <div className="space-y-5">
          <div className="rounded-2xl bg-accent/50 p-5 text-center">
            <p className="text-sm text-muted-foreground">Total a cobrar</p>
            <p className="tabular font-display text-4xl font-semibold">{money(total)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{countOf(comanda.items)} productos</p>
          </div>
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
            <Button variant="outline" size="lg" className="h-12" onClick={() => setStep("edit")} disabled={pending}>
              Volver
            </Button>
            <Button size="lg" className="h-12" onClick={charge} disabled={pending || (payment === "FIADO" && !customer.trim())}>
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
                        "shrink-0 rounded-full border px-3 py-1 text-xs font-medium",
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
                <button
                  type="button"
                  onClick={() => setCustom({ description: query.trim(), price: 0 })}
                  className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed p-3 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground"
                >
                  <Plus className="size-4" />
                  Otro producto
                </button>
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
                <p className="text-sm font-medium">Pedido</p>
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
                          <button type="button" className="flex size-8 items-center justify-center" aria-label="Quitar uno" onClick={() => setQty(i, item.quantity - 1)}>
                            <Minus className="size-3.5" />
                          </button>
                          <span className="tabular w-6 text-center text-sm font-semibold">{item.quantity}</span>
                          <button type="button" className="flex size-8 items-center justify-center" aria-label="Agregar uno" onClick={() => setQty(i, item.quantity + 1)}>
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                        <span className="min-w-0 flex-1 text-sm leading-tight">
                          {item.description}
                          {item.note && noteFor !== i ? <span className="block text-xs text-amber-700 dark:text-amber-400">{item.note}</span> : null}
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
                          className={cn("flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted", item.note && "text-amber-700")}
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
              <p className="text-xs text-muted-foreground">{countOf(comanda.items)} productos</p>
              <p className="tabular text-xl font-semibold">{money(total)}</p>
            </div>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setStep("cancel")}>
              Anular
            </Button>
            <Button variant={unsent ? "default" : "outline"} onClick={sendToKitchen} disabled={pending || !unsent}>
              {pending ? <Loader2 className="animate-spin" /> : <ChefHat />}
              {unsent ? `Enviar a cocina (${unsent})` : "Enviado a cocina"}
            </Button>
            <Button variant={unsent ? "outline" : "default"} onClick={() => setStep("charge")} disabled={!comanda.items.length}>
              Cobrar
            </Button>
          </div>
        </>
      )}
    </AppModal>
  )
}
