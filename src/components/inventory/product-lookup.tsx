"use client"

import * as React from "react"
import { CalendarClock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { AppModal } from "@/components/app/app-modal"
import { ScanButton } from "@/components/app/barcode-scanner"
import { MovementDialog, type MovementProduct } from "@/components/inventory/movement-dialog"
import { findByCode } from "@/lib/barcodes"
import { formatMoney, formatNumber, formatPercent } from "@/lib/currency"
import { marginRatio } from "@/lib/calculations"

export type LookupProduct = {
  id: string
  name: string
  codes: string[]
  price: number
  /** Solo para quien puede ver costos. */
  cost: number | null
  stock: number
  minStock: number
  trackStock: boolean
  sold30: number
  expires: { label: string; days: number } | null
}

/** "Consultar producto": escaneas y ves precio, stock y vencimiento sin hacer ningún movimiento. */
export function ProductLookup({
  products,
  currency,
  movementProducts,
}: {
  products: LookupProduct[]
  currency: string
  /** Si viene, se puede registrar un movimiento desde la ficha. */
  movementProducts?: MovementProduct[]
}) {
  const [found, setFound] = React.useState<LookupProduct | null>(null)
  const money = (n: number) => formatMoney(n, currency)

  return (
    <>
      <ScanButton
        label="Consultar producto"
        onResult={(code) => {
          const p = findByCode(products, code)
          if (!p) return { ok: false, message: `No hay un producto con el código ${code}.` }
          setFound(p)
        }}
      />
      <AppModal open={Boolean(found)} onOpenChange={(o) => !o && setFound(null)} title={found?.name ?? "Producto"} description={found?.codes.join(" · ")}>
        {found ? (
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Precio de venta" value={money(found.price)} />
              {found.trackStock ? (
                <Stat
                  label="Stock"
                  value={`${formatNumber(found.stock)} u.`}
                  badge={
                    found.stock <= 0 ? (
                      <Badge variant="destructive">Agotado</Badge>
                    ) : found.stock <= found.minStock ? (
                      <Badge className="border-warning/40 bg-warning/15 text-foreground">Bajo</Badge>
                    ) : (
                      <Badge variant="secondary">OK</Badge>
                    )
                  }
                />
              ) : (
                <Stat label="Stock" value="Sin control" />
              )}
              {found.cost !== null ? (
                <Stat
                  label="Costo"
                  value={money(found.cost)}
                  hint={found.cost > 0 ? `Ganas ${money(found.price - found.cost)} · margen ${formatPercent(marginRatio(found.price, found.cost), 0)}` : undefined}
                />
              ) : null}
              <Stat label="Vendidos (30 días)" value={`${formatNumber(found.sold30)} u.`} hint={found.trackStock ? `Avisamos con menos de ${formatNumber(found.minStock)}` : undefined} />
            </div>
            {found.expires ? (
              <p className={`flex items-center gap-2 rounded-lg p-3 text-sm ${found.expires.days <= 7 ? "bg-warning/15" : "bg-muted/50"}`}>
                <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
                {found.expires.days < 0
                  ? `Venció el ${found.expires.label}`
                  : found.expires.days === 0
                    ? "Vence hoy"
                    : `Vence el ${found.expires.label} (en ${found.expires.days} ${found.expires.days === 1 ? "día" : "días"})`}
              </p>
            ) : null}
            {movementProducts && found.trackStock ? (
              <div className="flex justify-end">
                <MovementDialog products={movementProducts} defaultProductId={found.id} compact label="Registrar movimiento" />
              </div>
            ) : null}
          </div>
        ) : null}
      </AppModal>
    </>
  )
}

function Stat({ label, value, hint, badge }: { label: string; value: string; hint?: string; badge?: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        {badge}
      </div>
      <p className="tabular mt-1 text-lg font-semibold">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
