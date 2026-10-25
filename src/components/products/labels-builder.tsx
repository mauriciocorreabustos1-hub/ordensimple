"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Loader2, Minus, Plus, Printer, Search } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { BarcodeSvg } from "@/components/products/barcode-svg"
import { formatMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"
import { assignInternalCodes } from "@/server/actions/labels"

export type LabelProduct = { id: string; name: string; price: number; sku: string | null; stock: number | null; category: string | null }

type Sheet = { kind: "sheet"; label: string; cols: number; rows: number; w: number; h: number; top: number; left: number; gapX: number; gapY: number }
type Roll = { kind: "roll"; label: string; w: number; h: number }

/** Formatos más comunes: hojas de stickers A4 (impresora normal) y rollos de etiquetas (impresora térmica). */
const FORMATS: Record<string, Sheet | Roll> = {
  "a4-24": { kind: "sheet", label: "Hoja A4 · 24 etiquetas (70 × 37 mm)", cols: 3, rows: 8, w: 70, h: 37, top: 0.5, left: 0, gapX: 0, gapY: 0 },
  "a4-40": { kind: "sheet", label: "Hoja A4 · 40 etiquetas (52,5 × 29,7 mm)", cols: 4, rows: 10, w: 52.5, h: 29.7, top: 0, left: 0, gapX: 0, gapY: 0 },
  "a4-65": { kind: "sheet", label: "Hoja A4 · 65 etiquetas (38 × 21 mm)", cols: 5, rows: 13, w: 38.1, h: 21.2, top: 10.7, left: 4.7, gapX: 2.5, gapY: 0 },
  "t-50x25": { kind: "roll", label: "Impresora térmica · 50 × 25 mm", w: 50, h: 25 },
  "t-40x30": { kind: "roll", label: "Impresora térmica · 40 × 30 mm", w: 40, h: 30 },
  "t-58x40": { kind: "roll", label: "Impresora térmica · 58 × 40 mm", w: 58, h: 40 },
}
const PREF_KEY = "ordensimple-etiquetas"

type Prefs = { format: string; price: boolean; business: boolean }

/** Una etiqueta: nombre, precio y código de barras, con tamaños según el alto de la etiqueta. */
function Label({ p, code, f, prefs, businessName, money }: { p: LabelProduct; code: string; f: Sheet | Roll; prefs: Prefs; businessName: string; money: (n: number) => string }) {
  const small = f.h < 25
  return (
    <div
      style={{ width: `${f.w}mm`, height: `${f.h}mm`, padding: small ? "1mm 1.5mm" : "1.8mm 2.2mm" }}
      className="flex flex-col overflow-hidden bg-white text-black"
    >
      {prefs.business ? <p style={{ fontSize: small ? "5pt" : "6pt" }} className="truncate leading-tight text-neutral-600">{businessName}</p> : null}
      <p style={{ fontSize: small ? "6.5pt" : "8pt" }} className="line-clamp-2 leading-tight font-semibold">{p.name}</p>
      {prefs.price ? <p style={{ fontSize: small ? "9pt" : "12pt" }} className="leading-tight font-bold">{money(p.price)}</p> : null}
      <div className="mt-auto">
        <BarcodeSvg value={code} height={small ? "6mm" : f.h >= 35 ? "11mm" : "8mm"} />
        <p style={{ fontSize: small ? "5.5pt" : "6.5pt", letterSpacing: "0.08em" }} className="text-center leading-tight tabular-nums">{code}</p>
      </div>
    </div>
  )
}

export function LabelsBuilder({ products: initial, currency, businessName }: { products: LabelProduct[]; currency: string; businessName: string }) {
  const money = (n: number) => formatMoney(n, currency)
  const [products, setProducts] = React.useState(initial)
  const [qty, setQty] = React.useState<Record<string, number>>({})
  const [query, setQuery] = React.useState("")
  const [onlyMissing, setOnlyMissing] = React.useState(false)
  const [prefs, setPrefs] = React.useState<Prefs>({ format: "a4-24", price: true, business: false })
  const [skip, setSkip] = React.useState(0)
  const [printing, setPrinting] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)

  // La impresora y las opciones se recuerdan en este aparato.
  React.useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PREF_KEY) ?? "null") as Prefs | null
      // eslint-disable-next-line react-hooks/set-state-in-effect -- se lee una sola vez al abrir (localStorage no existe en el servidor)
      if (saved && FORMATS[saved.format]) setPrefs(saved)
    } catch {}
    setMounted(true)
  }, [])
  const savePrefs = (next: Prefs) => {
    setPrefs(next)
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(next))
    } catch {}
  }

  const f = FORMATS[prefs.format]
  const q = query.trim().toLowerCase()
  const shown = products.filter((p) => (!onlyMissing || !p.sku) && (!q || p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)))
  const chosen = products.filter((p) => (qty[p.id] ?? 0) > 0)
  const total = chosen.reduce((s, p) => s + qty[p.id], 0)
  const missing = chosen.filter((p) => !p.sku).length
  const perSheet = f.kind === "sheet" ? f.cols * f.rows : 1
  const sheets = f.kind === "sheet" ? Math.ceil((total + skip) / perSheet) : total

  const setOne = (id: string, n: number) => setQty((s) => ({ ...s, [id]: Math.max(0, Math.min(999, n)) }))
  const selectShown = (mode: "one" | "stock" | "none") =>
    setQty((s) => {
      const next = { ...s }
      for (const p of shown) next[p.id] = mode === "none" ? 0 : mode === "stock" ? Math.max(1, Math.min(999, p.stock ?? 1)) : Math.max(1, next[p.id] ?? 0)
      return next
    })

  async function print() {
    if (!total) return void toast.error("Elige al menos un producto.")
    setPrinting(true)
    try {
      // Los productos sin código reciben uno interno (empieza con 20) antes de imprimir.
      if (missing) {
        const r = await assignInternalCodes(chosen.filter((p) => !p.sku).map((p) => p.id))
        if (!r.ok || !r.data) return void toast.error(r.message ?? "No se pudieron crear los códigos.")
        const codes = r.data
        setProducts((list) => list.map((p) => (codes[p.id] ? { ...p, sku: codes[p.id] } : p)))
        toast.success(`Creamos ${Object.keys(codes).length} ${Object.keys(codes).length === 1 ? "código" : "códigos"} para tus productos`)
        await new Promise((r) => setTimeout(r, 150))
      }
      window.print()
    } finally {
      setPrinting(false)
    }
  }

  // Lo que se imprime: cada etiqueta repetida según la cantidad, con espacios vacíos al inicio si la hoja ya está usada.
  const cells: (LabelProduct | null)[] = [...(f.kind === "sheet" ? Array<null>(skip).fill(null) : []), ...chosen.flatMap((p) => Array<LabelProduct>(qty[p.id]).fill(p))]
  const pages: (LabelProduct | null)[][] = []
  for (let i = 0; i < cells.length; i += perSheet) pages.push(cells.slice(i, i + perSheet))
  const sample = chosen[0] ?? products[0]

  const printCss =
    f.kind === "sheet"
      ? `@page { size: A4; margin: 0 } `
      : `@page { size: ${f.w}mm ${f.h}mm; margin: 0 } `

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 basis-56">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar producto o código" className="pl-9" aria-label="Buscar producto" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={onlyMissing} onCheckedChange={setOnlyMissing} aria-label="Solo productos sin código" />
            Solo sin código
          </label>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Button variant="outline" size="sm" onClick={() => selectShown("one")}>
            Una de cada uno
          </Button>
          <Button variant="outline" size="sm" onClick={() => selectShown("stock")}>
            Una por unidad en stock
          </Button>
          <Button variant="ghost" size="sm" onClick={() => selectShown("none")}>
            Quitar todas
          </Button>
        </div>
        <ul className="divide-y rounded-xl border bg-card">
          {shown.length === 0 ? <li className="p-4 text-center text-sm text-muted-foreground">No hay productos que coincidan.</li> : null}
          {shown.map((p) => {
            const n = qty[p.id] ?? 0
            return (
              <li key={p.id} className={cn("flex items-center gap-3 px-3 py-2.5", n > 0 && "bg-accent/30")}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {money(p.price)} · {p.sku ? <span className="tabular-nums">{p.sku}</span> : <span className="text-amber-700 dark:text-amber-400">sin código (se crea al imprimir)</span>}
                  </p>
                </div>
                <div className="flex items-center rounded-lg border">
                  <button type="button" className="flex size-9 items-center justify-center disabled:opacity-30" onClick={() => setOne(p.id, n - 1)} disabled={!n} aria-label={`Una etiqueta menos de ${p.name}`}>
                    <Minus className="size-3.5" />
                  </button>
                  <input
                    value={n}
                    onChange={(e) => setOne(p.id, Number(e.target.value.replace(/\D/g, "")) || 0)}
                    inputMode="numeric"
                    className="tabular w-10 bg-transparent text-center text-sm font-semibold outline-none"
                    aria-label={`Etiquetas de ${p.name}`}
                  />
                  <button type="button" className="flex size-9 items-center justify-center" onClick={() => setOne(p.id, n + 1)} aria-label={`Una etiqueta más de ${p.name}`}>
                    <Plus className="size-3.5" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className="space-y-4 rounded-2xl border bg-card p-4">
          <div className="space-y-1.5">
            <label htmlFor="label-format" className="text-sm font-medium">
              ¿En qué vas a imprimir?
            </label>
            <select
              id="label-format"
              value={prefs.format}
              onChange={(e) => {
                savePrefs({ ...prefs, format: e.target.value })
                setSkip(0)
              }}
              className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
            >
              <optgroup label="Impresora normal (hojas de stickers)">
                {Object.entries(FORMATS)
                  .filter(([, v]) => v.kind === "sheet")
                  .map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Impresora de etiquetas (rollo)">
                {Object.entries(FORMATS)
                  .filter(([, v]) => v.kind === "roll")
                  .map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>
          <label className="flex items-center justify-between gap-3 text-sm">
            Mostrar el precio
            <Switch checked={prefs.price} onCheckedChange={(v) => savePrefs({ ...prefs, price: v })} />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            Mostrar el nombre del negocio
            <Switch checked={prefs.business} onCheckedChange={(v) => savePrefs({ ...prefs, business: v })} />
          </label>
          {f.kind === "sheet" ? (
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                Empezar en la etiqueta n.º
                <span className="block text-xs text-muted-foreground">Para usar una hoja que ya tiene etiquetas usadas.</span>
              </span>
              <Input
                type="number"
                min={1}
                max={f.cols * f.rows}
                value={skip + 1}
                onChange={(e) => setSkip(Math.max(0, Math.min(f.cols * f.rows - 1, (Number(e.target.value) || 1) - 1)))}
                className="w-20"
              />
            </label>
          ) : null}

          {sample ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Así se ve (tamaño real)</p>
              <div className="flex justify-center overflow-hidden rounded-lg border bg-muted/40 p-3">
                <div className="shadow-md ring-1 ring-black/10">
                  <Label p={sample} code={sample.sku || "2000000000008"} f={f} prefs={prefs} businessName={businessName} money={money} />
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
            {total ? (
              <>
                <span className="font-semibold">{total}</span> {total === 1 ? "etiqueta" : "etiquetas"}
                {f.kind === "sheet" ? ` · ${sheets} ${sheets === 1 ? "hoja" : "hojas"}` : ""}
                {missing ? <span className="block text-xs text-muted-foreground">A {missing} {missing === 1 ? "producto" : "productos"} sin código le creamos uno.</span> : null}
              </>
            ) : (
              <span className="text-muted-foreground">Elige productos y cuántas etiquetas de cada uno.</span>
            )}
          </div>
          <Button size="lg" className="h-11 w-full" onClick={() => void print()} disabled={!total || printing}>
            {printing ? <Loader2 className="animate-spin" /> : <Printer />}
            Imprimir etiquetas
          </Button>
          <p className="text-xs text-muted-foreground">
            En la ventana de impresión elige <strong>Tamaño real / escala 100 %</strong> y <strong>sin márgenes</strong>.
            {f.kind === "roll" ? " Elige tu impresora de etiquetas y el tamaño de papel igual al de tus etiquetas." : ""}
          </p>
          {f.kind === "roll" ? (
            <details className="rounded-lg border px-3 py-2 text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium text-foreground">¿Sale chica, corrida o al centro?</summary>
              <div className="mt-2 space-y-1.5">
                <p>
                  Pasa cuando tu impresora no tiene el tamaño {f.w} × {f.h} mm. Créalo una vez en Windows: Configuración, sección Impresoras, tu impresora,{" "}
                  <strong>Preferencias de impresión</strong>, Papel o Stock, <strong>Nuevo</strong> (a veces “USER”): ancho {f.w} mm y alto {f.h} mm.
                </p>
                <p>
                  Luego, en la ventana de impresión de Chrome, en <strong>Más opciones</strong>: Tamaño del papel {f.w} × {f.h} mm, Márgenes{" "}
                  <strong>Ninguno</strong>, Escala <strong>100</strong> y sin encabezados ni pies de página.
                </p>
                <p>
                  Si cada etiqueta se corre un poco, calibra la impresora para que detecte el espacio entre etiquetas (en la mayoría se mantiene apretado el botón
                  FEED unos segundos).
                </p>
                <p>Las impresoras de boletas (rollo de 58 u 80 mm sin stickers) no imprimen etiquetas adhesivas: para eso usa una impresora de etiquetas o las hojas A4.</p>
              </div>
            </details>
          ) : null}
        </div>
      </aside>

      {/* Lo que sale en papel: solo se ve al imprimir. */}
      {mounted
        ? createPortal(
            <div id="label-print">
              <style>{`${printCss}
@media screen { #label-print { display: none } }
@media print {
  body > *:not(#label-print) { display: none !important }
  html, body { background: #fff !important; margin: 0 !important; padding: 0 !important }
  #label-print { display: block }
  #label-print * { -webkit-print-color-adjust: exact; print-color-adjust: exact }
}`}</style>
              {f.kind === "sheet"
                ? pages.map((page, i) => (
                    <div
                      key={i}
                      style={{
                        width: "210mm",
                        height: "296mm",
                        paddingTop: `${f.top}mm`,
                        paddingLeft: `${f.left}mm`,
                        display: "grid",
                        gridTemplateColumns: `repeat(${f.cols}, ${f.w}mm)`,
                        gridAutoRows: `${f.h}mm`,
                        columnGap: `${f.gapX}mm`,
                        rowGap: `${f.gapY}mm`,
                        breakAfter: i < pages.length - 1 ? "page" : "auto",
                        overflow: "hidden",
                      }}
                    >
                      {page.map((p, k) => (p ? <Label key={k} p={p} code={p.sku || ""} f={f} prefs={prefs} businessName={businessName} money={money} /> : <div key={k} />))}
                    </div>
                  ))
                : cells.map((p, k) =>
                    p ? (
                      <div key={k} style={{ breakAfter: k < cells.length - 1 ? "page" : "auto" }}>
                        <Label p={p} code={p.sku || ""} f={f} prefs={prefs} businessName={businessName} money={money} />
                      </div>
                    ) : null,
                  )}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
