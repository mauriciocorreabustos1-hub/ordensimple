"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Minus, Plus, Printer, UserPlus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"
import { applyPromotions, type PromoRule } from "@/lib/promotions"
import type { ComandaData, ComandaLine } from "@/components/comandas/comandas-board"

// La cuenta de la mesa para imprimir: todo junto, en partes iguales o separada por persona
// (cada uno con lo que consumió). Lo repartido se guarda en este dispositivo para cobrarle después a cada uno.

type Person = { id: string; name: string }
type Assign = Record<string, Record<string, number>>
type Saved = { people: Person[]; assign: Assign }

const TIP_RATE = 0.1
const leftOf = (i: ComandaLine) => Math.max(0, i.quantity - i.paidQty)
const storageKey = (id: string) => `comanda-cuenta:${id}`

function load(id: string): Saved | null {
  try {
    const raw = localStorage.getItem(storageKey(id))
    if (!raw) return null
    const s = JSON.parse(raw) as Saved
    return Array.isArray(s.people) && s.people.length && s.assign ? s : null
  } catch {
    return null
  }
}
function save(id: string, s: Saved | null) {
  try {
    if (s) localStorage.setItem(storageKey(id), JSON.stringify(s))
    else localStorage.removeItem(storageKey(id))
  } catch {}
}

/** Saca a una persona de lo guardado (después de cobrarle). */
export function forgetBillPerson(comandaId: string, personId: string) {
  const s = load(comandaId)
  if (!s) return
  const people = s.people.filter((p) => p.id !== personId)
  const assign = Object.fromEntries(Object.entries(s.assign).filter(([id]) => id !== personId))
  save(comandaId, people.length ? { people, assign } : null)
}

const newPerson = (n: number): Person => ({ id: crypto.randomUUID(), name: `Persona ${n}` })

/**
 * Lo que le toca a cada persona, sin pasarse de lo que queda por pagar: si algo se cobró por otro lado,
 * se descuenta en orden (primero a la Persona 1, después a la 2…).
 */
function effective(items: ComandaLine[], people: Person[], assign: Assign) {
  const out: Record<string, Record<string, number>> = {}
  const unassigned: Record<string, number> = {}
  for (const i of items) {
    let left = leftOf(i)
    for (const p of people) {
      const n = Math.min(left, Math.max(0, assign[p.id]?.[i.id] ?? 0))
      if (n) (out[p.id] ??= {})[i.id] = n
      left -= n
    }
    if (left > 0) unassigned[i.id] = left
  }
  return { byPerson: out, unassigned }
}

type Section = {
  key: string
  title: string
  lines: { description: string; quantity: number; unitPrice: number }[]
  promos: { name: string; amount: number }[]
  total: number
}

export function BillStep({
  comanda,
  currency,
  businessName,
  promotions,
  timezone,
  categoryOf,
  onBack,
  onCharge,
}: {
  comanda: ComandaData
  currency: string
  businessName: string
  promotions: PromoRule[]
  timezone: string
  categoryOf: Map<string, string | null>
  onBack: () => void
  /** Cobrarle a una persona lo suyo (abre el cobro con sus productos ya elegidos). */
  onCharge: (split: Record<string, number>, personId: string) => void
}) {
  const money = (n: number) => formatMoney(n, currency)
  const items = comanda.items.filter((i) => leftOf(i) > 0)
  // Lo repartido antes en este dispositivo (si cerraste la comanda y volviste a abrirla).
  // Este paso solo se abre al tocar "Cuenta", nunca en el servidor: se puede leer al tiro.
  const [saved] = React.useState(() => load(comanda.id))
  const [mode, setMode] = React.useState<"all" | "people">(saved ? "people" : "all")
  const [equal, setEqual] = React.useState(1)
  const [withTip, setWithTip] = React.useState(true)
  const [state, setState] = React.useState<Saved>(() => saved ?? { people: [newPerson(1), newPerson(2)], assign: {} })
  const [current, setCurrent] = React.useState<string | null>(null)

  const update = (change: (s: Saved) => Saved) =>
    setState((s) => {
      const next = change(s)
      save(comanda.id, next)
      return next
    })

  const { people, assign } = state
  const active = people.find((p) => p.id === current) ?? people[0]
  const { byPerson, unassigned } = effective(items, people, assign)
  const unassignedCount = Object.values(unassigned).reduce((s, n) => s + n, 0)

  const promoOf = (lines: { item: ComandaLine; quantity: number }[]) =>
    applyPromotions(
      lines.map(({ item, quantity }) => ({ key: item.id, productId: item.productId, categoryId: item.productId ? (categoryOf.get(item.productId) ?? null) : null, quantity, unitPrice: item.unitPrice })),
      promotions,
      { now: new Date(), timezone, channel: "store" },
    )

  function section(key: string, title: string, counts: Record<string, number>): Section {
    const lines = items.filter((i) => counts[i.id]).map((item) => ({ item, quantity: counts[item.id] }))
    const promo = promoOf(lines)
    const subtotal = lines.reduce((s, l) => s + l.quantity * l.item.unitPrice, 0)
    return {
      key,
      title,
      lines: lines.map((l) => ({ description: l.item.description, quantity: l.quantity, unitPrice: l.item.unitPrice })),
      promos: promo.applied.map((a) => ({ name: a.name, amount: a.amount })),
      total: subtotal - promo.discount,
    }
  }

  const sections: Section[] =
    mode === "all"
      ? [section("all", "", Object.fromEntries(items.map((i) => [i.id, leftOf(i)])))]
      : [
          ...people.filter((p) => byPerson[p.id]).map((p) => section(p.id, p.name.trim() || "Sin nombre", byPerson[p.id])),
          ...(unassignedCount ? [section("none", "Sin asignar", unassigned)] : []),
        ]

  function setCount(itemId: string, n: number) {
    if (!active) return
    const item = items.find((i) => i.id === itemId)
    if (!item) return
    const mine = byPerson[active.id]?.[itemId] ?? 0
    const max = mine + (unassigned[itemId] ?? 0)
    update((s) => ({ ...s, assign: { ...s.assign, [active.id]: { ...s.assign[active.id], [itemId]: Math.max(0, Math.min(max, n)) } } }))
  }

  function addPerson() {
    if (people.length >= 20) return
    const p = newPerson(people.length + 1)
    update((s) => ({ ...s, people: [...s.people, p] }))
    setCurrent(p.id)
  }

  function removePerson(id: string) {
    if (people.length <= 1) return
    update((s) => ({ people: s.people.filter((p) => p.id !== id), assign: Object.fromEntries(Object.entries(s.assign).filter(([k]) => k !== id)) }))
    if (current === id) setCurrent(null)
  }

  const rename = (id: string, name: string) => update((s) => ({ ...s, people: s.people.map((p) => (p.id === id ? { ...p, name: name.slice(0, 30) } : p)) }))

  /** Reparte lo que queda sin asignar, un producto a la vez, entre todos (para partir rápido y después ajustar). */
  function spreadRest() {
    update((s) => {
      const assignNext: Assign = Object.fromEntries(s.people.map((p) => [p.id, { ...s.assign[p.id] }]))
      let k = 0
      for (const i of items) {
        for (let n = 0; n < (unassigned[i.id] ?? 0); n++) {
          const p = s.people[k++ % s.people.length]
          assignNext[p.id][i.id] = (assignNext[p.id][i.id] ?? 0) + 1
        }
      }
      return { ...s, assign: assignNext }
    })
  }

  const grand = sections.reduce((s, x) => s + x.total, 0)
  const tipOf = (n: number) => (withTip ? Math.round(n * TIP_RATE) : 0)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label="Cómo se imprime la cuenta">
        {[
          { key: "all" as const, label: "Todo junto" },
          { key: "people" as const, label: "Por persona" },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={mode === t.key}
            onClick={() => setMode(t.key)}
            className={cn("rounded-lg py-2 text-sm font-medium transition-colors", mode === t.key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mode === "people" && active ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {people.map((p) => {
              const count = Object.values(byPerson[p.id] ?? {}).reduce((s, n) => s + n, 0)
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={p.id === active.id}
                  onClick={() => setCurrent(p.id)}
                  className={cn(
                    "h-9 rounded-full border px-3.5 text-sm font-medium",
                    p.id === active.id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/50",
                  )}
                >
                  {p.name.trim() || "Sin nombre"}
                  {count ? <span className="tabular ml-1.5 opacity-75">· {count}</span> : null}
                </button>
              )
            })}
            <button type="button" onClick={addPerson} disabled={people.length >= 20} className="flex h-9 items-center gap-1.5 rounded-full border border-dashed px-3.5 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground disabled:opacity-40">
              <UserPlus className="size-4" />
              Otra persona
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Input value={active.name} onChange={(e) => rename(active.id, e.target.value)} aria-label="Nombre de la persona" placeholder="Nombre (opcional)" className="h-10" maxLength={30} />
            {people.length > 1 ? (
              <Button variant="ghost" size="icon" className="size-10 shrink-0 text-muted-foreground" aria-label={`Quitar a ${active.name}`} onClick={() => removePerson(active.id)}>
                <X className="size-4" />
              </Button>
            ) : null}
          </div>

          <p className="text-sm font-medium">¿Qué consumió {active.name.trim() || "esta persona"}?</p>
          <ul className="divide-y rounded-xl border">
            {items.map((i) => {
              const mine = byPerson[active.id]?.[i.id] ?? 0
              const free = unassigned[i.id] ?? 0
              return (
                <li key={i.id} className="flex items-center gap-2 p-2.5">
                  <span className="min-w-0 flex-1 text-sm leading-tight">
                    {i.description}
                    <span className="block text-xs text-muted-foreground">
                      {money(i.unitPrice)} · {free ? `${free} sin asignar` : "todo asignado"}
                    </span>
                  </span>
                  <div className="flex items-center rounded-lg border">
                    <button type="button" className="flex size-9 items-center justify-center disabled:opacity-30" aria-label={`Uno menos de ${i.description}`} onClick={() => setCount(i.id, mine - 1)} disabled={!mine}>
                      <Minus className="size-3.5" />
                    </button>
                    <span className="tabular w-6 text-center text-sm font-semibold">{mine}</span>
                    <button type="button" className="flex size-9 items-center justify-center disabled:opacity-30" aria-label={`Uno más de ${i.description}`} onClick={() => setCount(i.id, mine + 1)} disabled={!free}>
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
          {unassignedCount ? (
            <p className="text-xs text-muted-foreground">
              {unassignedCount === 1 ? "Queda 1 sin asignar: saldrá aparte" : `Quedan ${unassignedCount} sin asignar: saldrán aparte`} en la cuenta.{" "}
              {people.length > 1 ? (
                <button type="button" onClick={spreadRest} className="font-medium text-primary hover:underline">
                  Repartirlos entre todos
                </button>
              ) : null}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Resumen de lo que va a salir impreso */}
      <div className="space-y-2 rounded-2xl bg-accent/50 p-4">
        {mode === "people" ? (
          sections.length ? (
            sections.map((s) => (
              <div key={s.key} className="flex items-center gap-2 text-sm">
                <span className={cn("min-w-0 flex-1 truncate", s.key === "none" && "text-muted-foreground")}>{s.title}</span>
                <span className="tabular font-semibold">{money(s.total + tipOf(s.total))}</span>
                {s.key !== "none" && byPerson[s.key] ? (
                  <Button size="sm" variant="outline" className="h-8" onClick={() => onCharge(byPerson[s.key], s.key)}>
                    Cobrar
                  </Button>
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-center text-sm text-muted-foreground">Elige qué consumió cada persona.</p>
          )
        ) : (
          <>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">{withTip ? "Total con propina" : "Total de la mesa"}</span>
              <span className="tabular font-display text-2xl font-semibold">{money(grand + tipOf(grand))}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Dividir entre</span>
              <div className="flex items-center rounded-lg border bg-background">
                <button type="button" className="flex size-8 items-center justify-center disabled:opacity-30" aria-label="Una persona menos" onClick={() => setEqual(Math.max(1, equal - 1))} disabled={equal <= 1}>
                  <Minus className="size-3.5" />
                </button>
                <span className="tabular w-6 text-center font-semibold">{equal}</span>
                <button type="button" className="flex size-8 items-center justify-center" aria-label="Una persona más" onClick={() => setEqual(Math.min(30, equal + 1))}>
                  <Plus className="size-3.5" />
                </button>
              </div>
              {equal > 1 ? (
                <span>
                  = <span className="tabular font-semibold">{money(Math.ceil((grand + tipOf(grand)) / equal))}</span> c/u
                </span>
              ) : null}
            </div>
          </>
        )}
        <label className="flex items-center gap-2 pt-1 text-sm">
          <input type="checkbox" checked={withTip} onChange={(e) => setWithTip(e.target.checked)} className="size-4 accent-primary" />
          Incluir propina sugerida (10 %)
        </label>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="outline" size="lg" className="h-12" onClick={onBack}>
          Volver
        </Button>
        <Button size="lg" className="h-12" onClick={() => window.print()} disabled={!sections.length}>
          <Printer />
          Imprimir cuenta
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Sirve para impresoras normales y de boletas (térmicas). Cada persona sale en su propio ticket.</p>

      {typeof document !== "undefined"
        ? createPortal(
            <BillPaper
              businessName={businessName}
              label={comanda.label}
              sections={sections}
              money={money}
              tipOf={tipOf}
              equal={mode === "all" ? equal : 1}
            />,
            document.body,
          )
        : null}
    </div>
  )
}

/** Lo que sale en papel: solo se ve al imprimir. Angosto para que sirva en rollos de 58 y 80 mm, y también en hoja carta o A4. */
function BillPaper({
  businessName,
  label,
  sections,
  money,
  tipOf,
  equal,
}: {
  businessName: string
  label: string
  sections: Section[]
  money: (n: number) => string
  tipOf: (n: number) => number
  equal: number
}) {
  const when = new Date().toLocaleString("es", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
  const row = { display: "flex", justifyContent: "space-between", gap: "2mm" } as const
  return (
    <div id="bill-print">
      <style>{`
@media screen { #bill-print { display: none } }
@media print {
  @page { margin: 4mm }
  body > *:not(#bill-print) { display: none !important }
  html, body { background: #fff !important; margin: 0 !important; padding: 0 !important }
  #bill-print { display: block; color: #000; font: 11pt/1.35 ui-monospace, "Courier New", monospace; width: 100%; max-width: 72mm }
  #bill-print .ticket { break-after: page; page-break-after: always }
  #bill-print .ticket:last-child { break-after: auto; page-break-after: auto }
  #bill-print .ticket:last-child .cut { display: none }
}`}</style>
      {sections.map((s) => {
        const tip = tipOf(s.total)
        return (
          <div key={s.key} className="ticket">
            <div style={{ textAlign: "center", fontWeight: 700, fontSize: "13pt" }}>{businessName}</div>
            <div style={{ textAlign: "center" }}>Detalle de consumo</div>
            <div style={{ textAlign: "center" }}>
              {label} · {when}
            </div>
            {s.title ? <div style={{ textAlign: "center", fontWeight: 700, marginTop: "2mm", fontSize: "12pt" }}>{s.title}</div> : null}
            <div style={{ borderTop: "1px dashed #000", margin: "2mm 0" }} />
            {s.lines.map((l, i) => (
              <div key={i}>
                <div style={row}>
                  <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                    {l.quantity} × {l.description}
                  </span>
                  <span style={{ whiteSpace: "nowrap" }}>{money(l.quantity * l.unitPrice)}</span>
                </div>
                {l.quantity > 1 ? <div style={{ paddingLeft: "4mm" }}>({money(l.unitPrice)} c/u)</div> : null}
              </div>
            ))}
            {s.promos.map((p, i) => (
              <div key={i} style={row}>
                <span>{p.name}</span>
                <span>−{money(p.amount)}</span>
              </div>
            ))}
            <div style={{ borderTop: "1px dashed #000", margin: "2mm 0" }} />
            <div style={{ ...row, fontWeight: 700, fontSize: "12pt" }}>
              <span>Total</span>
              <span>{money(s.total)}</span>
            </div>
            {tip ? (
              <>
                <div style={row}>
                  <span>Propina sugerida 10 %</span>
                  <span>{money(tip)}</span>
                </div>
                <div style={{ ...row, fontWeight: 700 }}>
                  <span>Total con propina</span>
                  <span>{money(s.total + tip)}</span>
                </div>
              </>
            ) : null}
            {equal > 1 ? (
              <div style={{ ...row, marginTop: "1mm" }}>
                <span>Entre {equal} personas</span>
                <span>{money(Math.ceil((s.total + tip) / equal))} c/u</span>
              </div>
            ) : null}
            <div style={{ textAlign: "center", marginTop: "3mm" }}>No válido como boleta</div>
            <div style={{ textAlign: "center" }}>¡Gracias por tu visita!</div>
            {/* En impresoras de rollo que no cortan solas, aquí se corta. */}
            <div className="cut" style={{ textAlign: "center", margin: "6mm 0 4mm", borderTop: "1px dashed #000", lineHeight: 0 }}>
              <span style={{ background: "#fff", padding: "0 2mm" }}>✂</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Borra lo repartido (cuando la comanda ya se cobró completa). */
export function clearBill(comandaId: string) {
  save(comandaId, null)
}
