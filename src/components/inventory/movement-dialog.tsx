"use client"

import * as React from "react"
import { ArrowDownToLine, ArrowUpFromLine, ClipboardCheck, Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AppModal } from "@/components/app/app-modal"
import { Field } from "@/components/app/field"
import { ScanButton } from "@/components/app/barcode-scanner"
import { findByCode } from "@/lib/barcodes"
import { formatNumber } from "@/lib/currency"
import { cn } from "@/lib/utils"
import { createInventoryMovement } from "@/server/actions/inventory"

export type MovementProduct = { id: string; name: string; stock: number; trackStock: boolean; codes?: string[] }
type MovementType = "IN" | "OUT" | "ADJUSTMENT" | "WASTE"

const TYPES: { value: MovementType; label: string; help: string; icon: typeof Plus }[] = [
  { value: "IN", label: "Entrada", help: "Llegó mercadería", icon: ArrowDownToLine },
  { value: "WASTE", label: "Merma", help: "Vencido, dañado o perdido", icon: Trash2 },
  { value: "OUT", label: "Salida", help: "Préstamo, traslado u otro", icon: ArrowUpFromLine },
  { value: "ADJUSTMENT", label: "Ajuste", help: "Contaste y corriges", icon: ClipboardCheck },
]

/** Motivos de merma: así después se sabe cuánto se pierde por vencimientos, daños o robos. */
const WASTE_REASONS = ["Vencido", "Dañado o roto", "Robo o pérdida", "Consumo propio"]

export function MovementDialog({
  products,
  defaultProductId,
  defaultType = "IN",
  compact = false,
  label,
  allowWaste = true,
}: {
  /** El plan incluye merma y vencidos (si no, la opción aparece con la etiqueta Pro). */
  allowWaste?: boolean
  products: MovementProduct[]
  defaultProductId?: string
  defaultType?: MovementType
  /** Botón pequeño para usar dentro de una fila de producto. */
  compact?: boolean
  /** Texto del botón compacto. */
  label?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [productId, setProductId] = React.useState(defaultProductId ?? "")
  const [type, setType] = React.useState<MovementType>(defaultType)
  const [quantity, setQuantity] = React.useState("")
  const [reason, setReason] = React.useState(defaultType === "WASTE" ? WASTE_REASONS[0] : "")
  const [pending, startTransition] = React.useTransition()

  const product = products.find((p) => p.id === productId)
  const qty = Number(quantity) || 0
  const result = product
    ? type === "IN"
      ? product.stock + qty
      : type === "OUT" || type === "WASTE"
        ? product.stock - qty
        : qty
    : null

  function reset() {
    setProductId(defaultProductId ?? "")
    setType(defaultType)
    setQuantity("")
    setReason(defaultType === "WASTE" ? WASTE_REASONS[0] : "")
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!productId) return toast.error("Elige un producto")
    if (quantity === "" || (type !== "ADJUSTMENT" && qty < 1)) return toast.error("Ingresa la cantidad")
    startTransition(async () => {
      const r = await createInventoryMovement({ productId, type, quantity: qty, reason })
      if (!r.ok) return void toast.error(r.message)
      toast.success(r.message ?? "Movimiento registrado")
      setOpen(false)
      reset()
    })
  }

  return (
    <>
      {compact ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          {label ?? "Mover stock"}
        </Button>
      ) : (
        <Button size="lg" className="h-10 px-4" onClick={() => setOpen(true)}>
          <Plus />
          Registrar movimiento
        </Button>
      )}
      <AppModal open={open} onOpenChange={setOpen} title="Movimiento de inventario">
        <form onSubmit={submit} className="grid gap-5">
          <Field label="¿Qué tipo de movimiento?">
            <div role="radiogroup" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={type === t.value}
                  disabled={t.value === "WASTE" && !allowWaste}
                  title={t.value === "WASTE" && !allowWaste ? "Merma y vencidos es parte del plan Pro" : undefined}
                  onClick={() => {
                    setType(t.value)
                    if (t.value === "WASTE" && !reason) setReason(WASTE_REASONS[0])
                    if (t.value !== "WASTE" && WASTE_REASONS.includes(reason)) setReason("")
                  }}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border bg-card px-2 py-3 text-center text-sm font-medium transition-colors hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-50",
                    type === t.value && "border-primary bg-accent text-accent-foreground ring-1 ring-primary",
                  )}
                >
                  <t.icon className="size-4" />
                  {t.label}
                  <span className="text-[11px] font-normal text-muted-foreground">{t.value === "WASTE" && !allowWaste ? "Plan Pro" : t.help}</span>
                </button>
              ))}
            </div>
          </Field>
          <Field label="Producto">
            <div className="flex gap-2">
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="h-10 w-full min-w-0 flex-1">
                <SelectValue placeholder="Elige un producto" />
              </SelectTrigger>
              <SelectContent position="popper" className="max-h-72">
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    {p.trackStock ? ` · ${formatNumber(p.stock)} en stock` : " · sin control de stock"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ScanButton
              size="icon"
              label="Escanear producto"
              onResult={(code) => {
                const found = findByCode(products, code)
                if (found) {
                  setProductId(found.id)
                  toast.success(found.name)
                } else toast.error(`No hay un producto con el código ${code}. Agrégalo en Productos con ese código.`)
              }}
            />
            </div>
          </Field>
          {type === "WASTE" ? (
            <Field label="¿Por qué?">
              <div className="flex flex-wrap gap-2">
                {WASTE_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={reason === r}
                    onClick={() => setReason(r)}
                    className={cn(
                      "rounded-full border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary/50",
                      reason === r && "border-primary bg-accent text-accent-foreground ring-1 ring-primary",
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </Field>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <Field label={type === "ADJUSTMENT" ? "¿Cuántas unidades contaste?" : "Cantidad"} htmlFor="mv-qty">
              <Input
                id="mv-qty"
                inputMode="numeric"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ""))}
                className="tabular h-10"
                placeholder="0"
              />
            </Field>
            <Field label="Motivo" htmlFor="mv-reason" optional>
              <Input id="mv-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={120} className="h-10" />
            </Field>
          </div>
          {product && quantity !== "" && result !== null ? (
            <p
              className={cn(
                "rounded-xl bg-muted px-4 py-3 text-sm",
                result < 0 && "bg-danger/10 text-danger",
              )}
            >
              {result < 0
                ? `No alcanza: solo tienes ${formatNumber(product.stock)} unidades.`
                : `Stock de ${product.name}: pasa de ${formatNumber(product.trackStock ? product.stock : 0)} a ${formatNumber(result)} unidades`}
            </p>
          ) : null}
          {product && !product.trackStock ? (
            <p className="text-xs text-muted-foreground">Al registrar este movimiento se activará el control de stock del producto.</p>
          ) : null}
          <Button type="submit" size="lg" className="h-11 text-base" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Guardar movimiento
          </Button>
        </form>
      </AppModal>
    </>
  )
}
