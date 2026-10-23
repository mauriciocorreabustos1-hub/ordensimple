"use client"

import * as React from "react"
import { Minus, Plus, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"
import { RollPaper, RollWidthSelect } from "@/components/print/roll-print"
import { applyPromotions, type PromoRule } from "@/lib/promotions"
import type { ComandaData, ComandaLine } from "@/components/comandas/comandas-board"

// La cuenta de la mesa para imprimir: todo junto (o en partes iguales) o separada por persona,
// según de quién se anotó cada plato al tomar el pedido.

const TIP_RATE = 0.1
const leftOf = (i: ComandaLine) => Math.max(0, i.quantity - i.paidQty)

export type PersonGroup = {
  key: string
  person: number | null
  title: string
  /** Qué falta pagar de cada plato de esta persona (id del plato → cantidad). */
  counts: Record<string, number>
  /** "2 × Lomo, 1 × Bebida" */
  summary: string
}

/** Lo que falta pagar, separado por persona. Vacío si no se anotó de quién es cada plato. */
export function personGroups(items: ComandaLine[]): PersonGroup[] {
  const left = items.filter((i) => leftOf(i) > 0)
  if (!left.some((i) => i.person)) return []
  const people = [...new Set(left.map((i) => i.person))].sort((a, b) => (a ?? 99) - (b ?? 99))
  return people.map((person) => {
    const mine = left.filter((i) => i.person === person)
    return {
      key: String(person ?? "mesa"),
      person,
      title: person ? `Persona ${person}` : "Para compartir",
      counts: Object.fromEntries(mine.map((i) => [i.id, leftOf(i)])),
      summary: mine.map((i) => `${leftOf(i)} × ${i.description}`).join(", "),
    }
  })
}

type Section = {
  key: string
  title: string
  counts: Record<string, number>
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
  onCharge: (counts: Record<string, number>) => void
}) {
  const money = (n: number) => formatMoney(n, currency)
  const groups = personGroups(comanda.items)
  const [mode, setMode] = React.useState<"all" | "people">(groups.length ? "people" : "all")
  const [equal, setEqual] = React.useState(1)
  const [withTip, setWithTip] = React.useState(true)
  const [separate, setSeparate] = React.useState(false)

  function section(key: string, title: string, counts: Record<string, number>): Section {
    const lines = comanda.items.filter((i) => counts[i.id])
    const promo = applyPromotions(
      lines.map((i) => ({ key: i.id, productId: i.productId, categoryId: i.productId ? (categoryOf.get(i.productId) ?? null) : null, quantity: counts[i.id], unitPrice: i.unitPrice })),
      promotions,
      { now: new Date(), timezone, channel: "store" },
    )
    const subtotal = lines.reduce((s, i) => s + counts[i.id] * i.unitPrice, 0)
    return {
      key,
      title,
      counts,
      lines: lines.map((i) => ({ description: i.description, quantity: counts[i.id], unitPrice: i.unitPrice })),
      promos: promo.applied.map((a) => ({ name: a.name, amount: a.amount })),
      total: subtotal - promo.discount,
    }
  }

  const all = Object.fromEntries(comanda.items.filter((i) => leftOf(i) > 0).map((i) => [i.id, leftOf(i)]))
  const byPerson = mode === "people" && groups.length > 0
  const sections: Section[] = byPerson ? groups.map((g) => section(g.key, g.title, g.counts)) : [section("all", "", all)]
  const tipOf = (n: number) => (withTip ? Math.round(n * TIP_RATE) : 0)
  const grand = sections.reduce((s, x) => s + x.total, 0)
  const grandTip = sections.reduce((s, x) => s + tipOf(x.total), 0)

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

      {mode === "people" && !groups.length ? (
        <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
          Para separarla, al tomar el pedido toca <strong>Separar por persona</strong> y elige de quién es cada plato.
        </p>
      ) : null}

      <div className="space-y-2 rounded-2xl bg-accent/50 p-4">
        {byPerson ? (
          <>
            {sections.map((s) => (
              <div key={s.key} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{s.title}</span>
                <span className="tabular font-semibold">{money(s.total + tipOf(s.total))}</span>
                <Button size="sm" variant="outline" className="h-8" onClick={() => onCharge(s.counts)}>
                  Cobrar
                </Button>
              </div>
            ))}
            <div className="flex items-baseline justify-between border-t pt-2 text-sm">
              <span className="text-muted-foreground">Total de la mesa</span>
              <span className="tabular font-semibold">{money(grand + grandTip)}</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">{withTip ? "Total con propina" : "Total de la mesa"}</span>
              <span className="tabular font-display text-2xl font-semibold">{money(grand + grandTip)}</span>
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
                  = <span className="tabular font-semibold">{money(Math.ceil((grand + grandTip) / equal))}</span> c/u
                </span>
              ) : null}
            </div>
          </>
        )}
        <label className="flex items-center gap-2 pt-1 text-sm">
          <input type="checkbox" checked={withTip} onChange={(e) => setWithTip(e.target.checked)} className="size-4 accent-primary" />
          Incluir propina sugerida (10 %)
        </label>
        {byPerson && sections.length > 1 ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={separate} onChange={(e) => setSeparate(e.target.checked)} className="size-4 accent-primary" />
            Un ticket aparte para cada persona
          </label>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="outline" size="lg" className="h-12" onClick={onBack}>
          Volver
        </Button>
        <Button size="lg" className="h-12" onClick={() => window.print()} disabled={!grand}>
          <Printer />
          Imprimir cuenta
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Para impresoras de boletas (rollo). Elige el ancho de tu papel:</span>
        <RollWidthSelect />
      </div>

      <BillPaper
        businessName={businessName}
        label={comanda.label}
        sections={sections}
        money={money}
        tipOf={tipOf}
        equal={byPerson ? 1 : equal}
        separate={separate && byPerson && sections.length > 1}
      />
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
  separate,
}: {
  businessName: string
  label: string
  sections: Section[]
  money: (n: number) => string
  tipOf: (n: number) => number
  equal: number
  /** Cada persona en su propio ticket (si no, una sola boleta con todos). */
  separate: boolean
}) {
  const when = new Date().toLocaleString("es", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
  const row = { display: "flex", justifyContent: "space-between", gap: "2mm" } as const
  const rule = <div style={{ borderTop: "1px dashed #000", margin: "2mm 0" }} />
  const header = (
    <>
      <div style={{ textAlign: "center", fontWeight: 700, fontSize: "1.2em" }}>{businessName}</div>
      <div style={{ textAlign: "center" }}>Detalle de consumo</div>
      <div style={{ textAlign: "center" }}>
        {label} · {when}
      </div>
    </>
  )
  const footer = (
    <>
      <div style={{ textAlign: "center", marginTop: "3mm" }}>No válido como boleta</div>
      <div style={{ textAlign: "center" }}>¡Gracias por tu visita!</div>
    </>
  )
  /** Lo de una persona (o de toda la mesa). "own": va en su propio ticket, con el nombre centrado. */
  const body = (s: Section, own: boolean) => {
    const tip = tipOf(s.total)
    return (
      <>
        {s.title ? <div style={{ fontWeight: 700, marginTop: "2mm", fontSize: own ? "1.1em" : "1em", textAlign: own ? "center" : "left" }}>{s.title}</div> : null}
        {own ? rule : null}
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
        {own ? rule : null}
        <div style={{ ...row, fontWeight: 700, fontSize: own ? "1.1em" : "1em" }}>
          <span>{own || !s.title ? "Total" : `Paga ${s.title}`}</span>
          <span>{money(s.total)}</span>
        </div>
        {tip ? (
          <>
            <div style={row}>
              <span>Propina sugerida 10 %</span>
              <span>{money(tip)}</span>
            </div>
            <div style={{ ...row, fontWeight: 700 }}>
              <span>Con propina</span>
              <span>{money(s.total + tip)}</span>
            </div>
          </>
        ) : null}
      </>
    )
  }
  const grand = sections.reduce((s, x) => s + x.total + tipOf(x.total), 0)

  return (
    <RollPaper id="bill-print">
      {separate ? (
        sections.map((s) => (
          <div key={s.key} className="ticket">
            {header}
            {body(s, true)}
            {footer}
          </div>
        ))
      ) : sections.length > 1 ? (
        // Una sola boleta: lo de cada persona y, al final, cuánto paga cada uno y el total de la mesa.
        <div className="ticket">
          {header}
          {sections.map((s) => (
            <div key={s.key}>
              {rule}
              {body(s, false)}
            </div>
          ))}
          <div style={{ borderTop: "2px solid #000", margin: "3mm 0 2mm" }} />
          <div style={{ textAlign: "center", fontWeight: 700 }}>Lo que paga cada uno</div>
          {sections.map((s) => (
            <div key={s.key} style={row}>
              <span>{s.title}</span>
              <span>{money(s.total + tipOf(s.total))}</span>
            </div>
          ))}
          <div style={{ ...row, fontWeight: 700, fontSize: "1.1em", marginTop: "1mm" }}>
            <span>Total mesa</span>
            <span>{money(grand)}</span>
          </div>
          {footer}
        </div>
      ) : (
        <div className="ticket">
          {header}
          {sections.map((s) => (
            <div key={s.key}>
              {body(s, true)}
              {equal > 1 ? (
                <div style={{ ...row, marginTop: "1mm" }}>
                  <span>Entre {equal} personas</span>
                  <span>{money(Math.ceil((s.total + tipOf(s.total)) / equal))} c/u</span>
                </div>
              ) : null}
            </div>
          ))}
          {footer}
        </div>
      )}
    </RollPaper>
  )
}
