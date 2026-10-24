"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"

export type QrCard = { key: string; title: string; subtitle: string; qr: string; url: string }

/** Tarjetas con el QR de la carta (una general y una por mesa), para imprimir y pegar en las mesas. */
export function QrSheet({ cards, businessName, logoUrl }: { cards: QrCard[]; businessName: string; logoUrl: string | null }) {
  const card = (c: QrCard, print: boolean) => (
    <div
      key={c.key}
      className={print ? "qr-card" : "flex flex-col items-center gap-2 rounded-2xl border bg-white p-5 text-center text-black shadow-sm"}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "2mm", justifyContent: "center" }}>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" style={{ width: print ? "9mm" : 28, height: print ? "9mm" : 28, objectFit: "contain", borderRadius: 6 }} />
        ) : null}
        <span style={{ fontWeight: 700, fontSize: print ? "12pt" : 15 }}>{businessName}</span>
      </div>
      <div style={{ fontWeight: 800, fontSize: print ? "22pt" : 26, lineHeight: 1.1 }}>{c.title}</div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={c.qr} alt={`Código QR: ${c.title}`} style={{ width: print ? "52mm" : 180, height: print ? "52mm" : 180 }} />
      <div style={{ fontSize: print ? "10.5pt" : 13 }}>{c.subtitle}</div>
    </div>
  )

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {cards.length} {cards.length === 1 ? "tarjeta" : "tarjetas"} · 6 por hoja, en papel carta o A4. Imprime, recorta por la línea punteada y pega cada una en su mesa.
        </p>
        <Button onClick={() => window.print()}>
          <Printer />
          Imprimir
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards.map((c) => card(c, false))}</div>

      {typeof document !== "undefined"
        ? createPortal(
            <div id="qr-print">
              <style>{`
@media screen { #qr-print { display: none } }
@media print {
  @page { size: auto; margin: 10mm }
  body > *:not(#qr-print) { display: none !important }
  html, body { background: #fff !important }
  #qr-print { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0; color: #000; font-family: system-ui, sans-serif }
  #qr-print .qr-card { height: 86mm; box-sizing: border-box; border: 1px dashed #999; padding: 4mm; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2mm; text-align: center; break-inside: avoid }
  #qr-print .qr-card:nth-child(6n) { break-after: page }
}`}</style>
              {cards.map((c) => card(c, true))}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
