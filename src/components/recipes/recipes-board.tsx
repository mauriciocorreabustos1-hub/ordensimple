"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { BookOpen, Loader2, Package, PackagePlus, Pencil, Plus, Search, ShoppingCart, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { AppModal } from "@/components/app/app-modal"
import { MoneyInput } from "@/components/app/money-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMoney } from "@/lib/currency"
import {
  batchesFromStock,
  compatibleUnits,
  convert,
  formatQuantity,
  isRecipeUnit,
  itemCost,
  parseQuantity,
  recipeTotals,
  RECIPE_UNITS,
  UNIT_LABEL,
  UNIT_NAME,
  type RecipeUnit,
} from "@/lib/recipes"
import { cn } from "@/lib/utils"
import { applyRecipeToProduct, deleteRecipe, deleteRecipeMaterial, registerMaterialPurchase, saveRecipe, saveRecipeMaterial } from "@/server/actions/recipes"

/** expiresAt: día de vencimiento "AAAA-MM-DD" (en la zona del negocio). */
export type MaterialRow = {
  id: string
  name: string
  unit: string
  packQty: number
  packPrice: number
  stock: number | null
  expiresAt: string | null
  /** Lo que se descontó en ventas los últimos 30 días (en su medida). */
  used30?: number
}
export type RecipeRow = {
  id: string
  name: string
  yieldUnits: number
  overheadPct: number
  profitPct: number
  productId: string | null
  productName: string | null
  items: { materialId: string; quantity: number; unit: string }[]
}
export type ProductOption = { id: string; name: string; price: number }

const unitLabel = (u: string) => (isRecipeUnit(u) ? UNIT_LABEL[u] : u)
const fieldClass = "h-10 w-full rounded-md border bg-background px-3 text-sm"

/** Días entre dos fechas "AAAA-MM-DD" (negativo si ya pasó). */
const daysBetween = (from: string, to: string) => {
  const ms = (k: string) => Date.UTC(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1, Number(k.slice(8, 10)))
  return Math.round((ms(to) - ms(from)) / 86_400_000)
}

/** Aviso de vencimiento de un material: vencido, vence hoy, mañana o en pocos días. */
export function ExpiryBadge({ expiresAt, today }: { expiresAt: string | null; today: string }) {
  if (!expiresAt) return null
  const days = daysBetween(today, expiresAt)
  const date = `${Number(expiresAt.slice(8, 10))}/${Number(expiresAt.slice(5, 7))}`
  const text = days < 0 ? "Vencido" : days === 0 ? "Vence hoy" : days === 1 ? "Vence mañana" : days <= 7 ? `Vence en ${days} días` : `Vence el ${date}`
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        days <= 0 ? "bg-danger/15 text-danger" : days <= 7 ? "bg-warning/15 text-foreground" : "bg-muted text-muted-foreground",
      )}
    >
      {text}
    </span>
  )
}

/** Los ingredientes de una receta con su material (para calcular). */
function withMaterials(items: RecipeRow["items"], materials: Map<string, MaterialRow>) {
  return items.flatMap((i) => {
    const material = materials.get(i.materialId)
    return material ? [{ ...i, material }] : []
  })
}

export function RecipesBoard({
  currency,
  materials,
  recipes,
  products,
  initialTab,
  today,
  chargesVat = false,
  canExpense = false,
}: {
  /** El negocio cobra IVA: al registrar una compra se pregunta si tiene factura. */
  chargesVat?: boolean
  /** Puede anotar gastos (la compra se anota como gasto). */
  canExpense?: boolean
  currency: string
  /** Hoy, "AAAA-MM-DD" en la zona del negocio (para los vencimientos). */
  today: string
  materials: MaterialRow[]
  recipes: RecipeRow[]
  products: ProductOption[]
  initialTab: "recetas" | "materiales"
}) {
  const [tab, setTab] = React.useState(initialTab)
  const [query, setQuery] = React.useState("")
  const [editingMaterial, setEditingMaterial] = React.useState<MaterialRow | "new" | null>(null)
  const [editingRecipe, setEditingRecipe] = React.useState<RecipeRow | "new" | null>(null)
  const [buying, setBuying] = React.useState<MaterialRow | null>(null)
  /** Se abrió el formulario de material al querer crear una receta sin tener materiales. */
  const [firstMaterial, setFirstMaterial] = React.useState(false)
  const money = (n: number) => formatMoney(Math.round(n), currency)
  const byId = React.useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials])
  const q = query.trim().toLowerCase()

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 sm:max-w-sm" role="tablist" aria-label="Recetas o materiales">
        {(
          [
            { key: "recetas", label: `Recetas (${recipes.length})` },
            { key: "materiales", label: `Materiales (${materials.length})` },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => {
              setTab(t.key)
              setQuery("")
            }}
            className={cn("rounded-lg py-2 text-sm font-medium transition-colors", tab === t.key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-56">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tab === "recetas" ? "Buscar receta" : "Buscar material"} className="h-10 pl-9" aria-label="Buscar" />
        </div>
        {tab === "recetas" ? (
          <Button
            onClick={() => {
              if (materials.length) return setEditingRecipe("new")
              // Sin materiales no se puede armar la receta: se abre directo el formulario del primero.
              setTab("materiales")
              setFirstMaterial(true)
              setEditingMaterial("new")
            }}
          >
            <Plus />
            Agregar receta
          </Button>
        ) : (
          <Button onClick={() => setEditingMaterial("new")}>
            <Plus />
            Agregar material
          </Button>
        )}
      </div>

      {tab === "recetas" ? (
        recipes.length === 0 ? (
          <Empty
            icon={BookOpen}
            title="Todavía no tienes recetas"
            text={
              materials.length
                ? "Arma tu primera receta: elige los ingredientes y te decimos cuánto te cuesta y a cuánto vender cada unidad."
                : "Primero agrega los materiales que compras (con su precio), y después arma tus recetas con ellos."
            }
          />
        ) : (
          <ul className="divide-y rounded-2xl border bg-card">
            {recipes
              .filter((r) => !q || r.name.toLowerCase().includes(q))
              .map((r) => {
                const items = withMaterials(r.items, byId)
                const t = recipeTotals(items, r.yieldUnits, r.overheadPct, r.profitPct)
                const batches = batchesFromStock(items)
                return (
                  <li key={r.id}>
                    <button type="button" onClick={() => setEditingRecipe(r)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/40">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{r.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          Costo {money(t.totalCost)} · rinde {r.yieldUnits} {r.yieldUnits === 1 ? "unidad" : "unidades"}
                          {batches !== null ? ` · con tu stock alcanza para ${batches} ${batches === 1 ? "vez" : "veces"}` : ""}
                          {r.productName ? ` · precio en “${r.productName}”` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="tabular block font-semibold">{money(t.unitPrice)}</span>
                        <span className="block text-[11px] text-muted-foreground">por unidad</span>
                      </span>
                    </button>
                  </li>
                )
              })}
          </ul>
        )
      ) : materials.length === 0 ? (
        <Empty icon={Package} title="Todavía no tienes materiales" text="Agrega lo que compras para tus recetas: cuánto trae el paquete y cuánto pagas. Ej.: Harina, 1 kg, $1.000." />
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {materials
            .filter((m) => !q || m.name.toLowerCase().includes(q))
            .map((m) => (
              <li key={m.id} className="flex items-center gap-1 pr-2">
                <button type="button" onClick={() => setEditingMaterial(m)} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left hover:bg-accent/40">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{m.name}</span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      {formatQuantity(m.packQty)} {unitLabel(m.unit)} a {money(m.packPrice)}
                      <ExpiryBadge expiresAt={m.expiresAt} today={today} />
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs">
                    <span className={cn("block", m.stock === null ? "text-muted-foreground" : m.stock <= 0 ? "font-medium text-danger" : "font-medium")}>
                      {m.stock === null ? "Sin stock anotado" : m.stock <= 0 ? "Agotado" : `Tienes ${formatQuantity(m.stock)} ${unitLabel(m.unit)}`}
                    </span>
                    {m.used30 ? <span className="block text-muted-foreground">Usaste {formatQuantity(m.used30)} {unitLabel(m.unit)} en 30 días</span> : null}
                  </span>
                  <Pencil className="size-4 shrink-0 text-muted-foreground" />
                </button>
                <Button variant="outline" size="sm" className="shrink-0" onClick={() => setBuying(m)} aria-label={`Registrar compra de ${m.name}`}>
                  <ShoppingCart />
                  <span className="max-sm:hidden">Compra</span>
                </Button>
              </li>
            ))}
        </ul>
      )}

      {buying ? <PurchaseDialog currency={currency} material={buying} today={today} chargesVat={chargesVat} canExpense={canExpense} onClose={() => setBuying(null)} /> : null}
      {editingMaterial ? (
        <MaterialDialog
          currency={currency}
          material={editingMaterial === "new" ? null : editingMaterial}
          usedIn={editingMaterial === "new" ? 0 : recipes.filter((r) => r.items.some((i) => i.materialId === editingMaterial.id)).length}
          intro={firstMaterial && editingMaterial === "new" ? "Para armar una receta, primero agrega los materiales que usas (harina, levadura, aceite…) con lo que trae el paquete y su precio." : undefined}
          onClose={() => {
            setEditingMaterial(null)
            setFirstMaterial(false)
          }}
        />
      ) : null}
      {editingRecipe ? (
        <RecipeDialog
          currency={currency}
          recipe={editingRecipe === "new" ? null : editingRecipe}
          materials={materials}
          products={products}
          onClose={() => setEditingRecipe(null)}
        />
      ) : null}
    </div>
  )
}

function Empty({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <p className="font-medium">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
    </div>
  )
}

/** Agregar o editar un material: cuánto trae el paquete, cuánto cuesta y cuánto tienes. */
function MaterialDialog({
  currency,
  material,
  usedIn,
  intro,
  onClose,
  onSaved,
}: {
  currency: string
  material: MaterialRow | null
  usedIn: number
  /** Explicación arriba del formulario (por ejemplo, la primera vez). */
  intro?: string
  onClose: () => void
  onSaved?: (id: string, unit: RecipeUnit) => void
}) {
  const router = useRouter()
  const [name, setName] = React.useState(material?.name ?? "")
  const [unit, setUnit] = React.useState<RecipeUnit>(material && isRecipeUnit(material.unit) ? material.unit : "kg")
  const [packQty, setPackQty] = React.useState(material ? formatQuantity(material.packQty) : "")
  const [packPrice, setPackPrice] = React.useState(material?.packPrice ?? 0)
  const [stock, setStock] = React.useState(material?.stock === null || material?.stock === undefined ? "" : formatQuantity(material.stock))
  const [expiresAt, setExpiresAt] = React.useState(material?.expiresAt ?? "")
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  function save(e: React.FormEvent) {
    e.preventDefault()
    const qty = parseQuantity(packQty)
    const st = stock.trim() ? parseQuantity(stock) : null
    if (name.trim().length < 2) return void toast.error("Escribe el nombre del material")
    if (!qty || qty <= 0) return void toast.error("¿Cuánto trae el paquete? Ej.: 1 kg, 500 g, 900 mL")
    if (packPrice <= 0) return void toast.error("¿Cuánto pagas por el paquete?")
    if (stock.trim() && (st === null || st < 0)) return void toast.error("Revisa cuánto tienes en stock")
    startTransition(async () => {
      const r = await saveRecipeMaterial(material?.id ?? null, { name, unit, packQty: qty, packPrice, stock: st, expiresAt })
      if (!r.ok) return void toast.error(r.message)
      toast.success(r.message)
      router.refresh()
      if (r.data) onSaved?.(r.data.id, unit)
      onClose()
    })
  }

  function remove() {
    startTransition(async () => {
      const r = await deleteRecipeMaterial(material!.id)
      if (!r.ok) return void toast.error(r.message)
      toast.success(r.message)
      router.refresh()
      onClose()
    })
  }

  return (
    <AppModal open onOpenChange={(o) => (o ? null : onClose())} title={material ? "Editar material" : "Agregar material"} noAutoFocus>
      <form onSubmit={save} className="space-y-4">
        {intro ? <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{intro}</p> : null}
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Nombre</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Harina, Levadura, Aceite" maxLength={60} className="h-10" />
        </label>
        <div className="space-y-1.5">
          <span className="block text-sm font-medium">El paquete que compras</span>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Input value={packQty} onChange={(e) => setPackQty(e.target.value)} inputMode="decimal" placeholder="Cantidad, ej.: 1" className="h-10" aria-label="Cantidad del paquete" />
            <select value={unit} onChange={(e) => setUnit(e.target.value as RecipeUnit)} className={cn(fieldClass, "w-40")} aria-label="Medida">
              {RECIPE_UNITS.map((u) => (
                <option key={u} value={u}>
                  {UNIT_NAME[u]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Precio del paquete</span>
          <MoneyInput value={packPrice} onValueChange={setPackPrice} currency={currency} aria-label="Precio del paquete" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">
            ¿Cuánto tienes ahora? <span className="font-normal text-muted-foreground">(opcional)</span>
          </span>
          <div className="flex items-center gap-2">
            <Input value={stock} onChange={(e) => setStock(e.target.value)} inputMode="decimal" placeholder="Ej.: 3" className="h-10" aria-label="Stock" />
            <span className="shrink-0 text-sm text-muted-foreground">{UNIT_LABEL[unit]}</span>
          </div>
          <span className="block text-xs text-muted-foreground">Con esto te decimos cuántas veces alcanzas a hacer cada receta.</span>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">
            ¿Cuándo vence? <span className="font-normal text-muted-foreground">(opcional)</span>
          </span>
          <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="h-10" aria-label="Fecha de vencimiento" />
          <span className="block text-xs text-muted-foreground">Te avisamos antes de que venza, y lo ves también en Inventario.</span>
        </label>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="submit" className="h-11 flex-1" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Guardar
          </Button>
          {material ? (
            confirmDelete ? (
              <Button type="button" variant="destructive" className="h-11" onClick={remove} disabled={pending}>
                {usedIn ? `Sí, eliminar (se quita de ${usedIn} ${usedIn === 1 ? "receta" : "recetas"})` : "Sí, eliminar"}
              </Button>
            ) : (
              <Button type="button" variant="ghost" className="h-11 text-muted-foreground" onClick={() => setConfirmDelete(true)}>
                <Trash2 />
                Eliminar
              </Button>
            )
          ) : null}
        </div>
      </form>
    </AppModal>
  )
}

/** Registrar una compra de un material: suma el stock, puede actualizar su precio y anota el gasto. */
function PurchaseDialog({
  currency,
  material,
  today,
  chargesVat,
  canExpense,
  onClose,
}: {
  currency: string
  material: MaterialRow
  today: string
  chargesVat: boolean
  canExpense: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const money = (n: number) => formatMoney(Math.round(n), currency)
  const base: RecipeUnit = isRecipeUnit(material.unit) ? material.unit : "u"
  const [quantity, setQuantity] = React.useState("")
  const [unit, setUnit] = React.useState<RecipeUnit>(base)
  const [total, setTotal] = React.useState(0)
  const [date, setDate] = React.useState(today)
  const [updatePrice, setUpdatePrice] = React.useState(true)
  const [addExpense, setAddExpense] = React.useState(canExpense)
  const [hasInvoice, setHasInvoice] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  const qty = parseQuantity(quantity)
  const inBase = qty && qty > 0 ? convert(qty, unit, base) : null
  // Cómo quedaría el precio del paquete con lo que se pagó en esta compra.
  const newPackPrice = inBase && total > 0 ? Math.round((total / inBase) * material.packQty) : null

  function save(e: React.FormEvent) {
    e.preventDefault()
    if (!qty || qty <= 0) return void toast.error("¿Cuánto compraste?")
    if (total <= 0) return void toast.error("¿Cuánto pagaste en total?")
    startTransition(async () => {
      const r = await registerMaterialPurchase(material.id, { quantity: qty, unit, total, updatePrice, addExpense, hasInvoice: chargesVat && addExpense && hasInvoice, date })
      if (!r.ok) return void toast.error(r.message)
      toast.success(r.message)
      router.refresh()
      onClose()
    })
  }

  return (
    <AppModal open onOpenChange={(o) => (o ? null : onClose())} title={`Compra de ${material.name}`} noAutoFocus>
      <form onSubmit={save} className="space-y-4">
        <div className="space-y-1.5">
          <span className="block text-sm font-medium">¿Cuánto compraste?</span>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="decimal" placeholder="Ej.: 10" className="h-10" aria-label="Cantidad comprada" />
            <select value={unit} onChange={(e) => setUnit(e.target.value as RecipeUnit)} className={cn(fieldClass, "w-28")} aria-label="Medida de la compra">
              {compatibleUnits(base).map((u) => (
                <option key={u} value={u}>
                  {UNIT_LABEL[u]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">¿Cuánto pagaste en total?</span>
          <MoneyInput value={total} onValueChange={setTotal} currency={currency} aria-label="Total pagado" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Fecha</span>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10" aria-label="Fecha de la compra" />
        </label>
        <div className="space-y-2 rounded-xl border p-3 text-sm">
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={updatePrice} onChange={(e) => setUpdatePrice(e.target.checked)} className="mt-0.5 size-4 accent-primary" />
            <span>
              Actualizar el precio del material
              <span className="block text-xs text-muted-foreground">
                {newPackPrice !== null
                  ? `El paquete de ${formatQuantity(material.packQty)} ${unitLabel(material.unit)} pasa de ${money(material.packPrice)} a ${money(newPackPrice)}, y tus recetas se recalculan.`
                  : `Hoy: ${formatQuantity(material.packQty)} ${unitLabel(material.unit)} a ${money(material.packPrice)}.`}
              </span>
            </span>
          </label>
          {canExpense ? (
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={addExpense} onChange={(e) => setAddExpense(e.target.checked)} className="mt-0.5 size-4 accent-primary" />
              <span>
                Anotarlo como gasto
                <span className="block text-xs text-muted-foreground">Queda en Gastos, como compra a proveedores.</span>
              </span>
            </label>
          ) : null}
          {chargesVat && canExpense && addExpense ? (
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={hasInvoice} onChange={(e) => setHasInvoice(e.target.checked)} className="mt-0.5 size-4 accent-primary" />
              <span>
                Tiene factura con IVA a nombre del negocio
                <span className="block text-xs text-muted-foreground">Su IVA se descuenta del IVA que tienes que pagar.</span>
              </span>
            </label>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {material.stock === null
            ? `Empiezas a llevar el stock de ${material.name} con lo que compraste.`
            : inBase
              ? `Tendrás ${formatQuantity(material.stock + inBase)} ${unitLabel(material.unit)} de ${material.name}.`
              : `Hoy tienes ${formatQuantity(material.stock)} ${unitLabel(material.unit)}.`}
        </p>
        <Button type="submit" className="h-11 w-full" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <ShoppingCart />}
          Registrar compra
        </Button>
      </form>
    </AppModal>
  )
}

type Line = { key: string; materialId: string; quantity: string; unit: RecipeUnit }

/** Agregar o editar una receta, con el costo y el precio calculados mientras se escribe. */
function RecipeDialog({
  currency,
  recipe,
  materials,
  products,
  onClose,
}: {
  currency: string
  recipe: RecipeRow | null
  materials: MaterialRow[]
  products: ProductOption[]
  onClose: () => void
}) {
  const router = useRouter()
  const money = (n: number) => formatMoney(Math.round(n), currency)
  const byId = new Map(materials.map((m) => [m.id, m]))
  const firstUnit = (materialId: string): RecipeUnit => {
    const u = byId.get(materialId)?.unit
    return u && isRecipeUnit(u) ? (u === "kg" ? "g" : u === "l" ? "ml" : u) : "u"
  }
  const [savedId, setSavedId] = React.useState(recipe?.id ?? null)
  const [name, setName] = React.useState(recipe?.name ?? "")
  const [lines, setLines] = React.useState<Line[]>(
    recipe?.items.map((i) => ({ key: crypto.randomUUID(), materialId: i.materialId, quantity: formatQuantity(i.quantity), unit: isRecipeUnit(i.unit) ? i.unit : "u" })) ?? [
      { key: crypto.randomUUID(), materialId: "", quantity: "", unit: "g" },
    ],
  )
  const [yieldUnits, setYieldUnits] = React.useState(recipe ? String(recipe.yieldUnits) : "1")
  const [overhead, setOverhead] = React.useState(recipe ? formatQuantity(recipe.overheadPct) : "0")
  const [profit, setProfit] = React.useState(recipe ? formatQuantity(recipe.profitPct) : "50")
  const [dirty, setDirty] = React.useState(!recipe)
  const [newMaterialFor, setNewMaterialFor] = React.useState<string | null>(null)
  const [productTarget, setProductTarget] = React.useState(recipe?.productId ?? "")
  const [newProductName, setNewProductName] = React.useState("")
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  const touch = () => setDirty(true)
  const setLine = (key: string, change: Partial<Line>) => {
    touch()
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...change } : l)))
  }
  const pick = (key: string, materialId: string) => setLine(key, { materialId, unit: firstUnit(materialId) })

  const parsedItems = lines.flatMap((l) => {
    const material = byId.get(l.materialId)
    const quantity = parseQuantity(l.quantity)
    return material && quantity && quantity > 0 ? [{ materialId: l.materialId, quantity, unit: l.unit, material }] : []
  })
  const units = Math.max(1, Math.floor(parseQuantity(yieldUnits) ?? 1))
  const overheadPct = Math.max(0, parseQuantity(overhead) ?? 0)
  const profitPct = Math.max(0, parseQuantity(profit) ?? 0)
  const t = recipeTotals(parsedItems, units, overheadPct, profitPct)
  const batches = batchesFromStock(parsedItems)

  /** Guarda la receta y devuelve su id (o null si no se pudo). */
  async function persist() {
    if (name.trim().length < 2) {
      toast.error("Escribe el nombre de la receta")
      return null
    }
    if (!parsedItems.length) {
      toast.error("Agrega al menos un ingrediente con su cantidad")
      return null
    }
    const r = await saveRecipe(savedId, {
      name,
      yieldUnits: units,
      overheadPct,
      profitPct,
      items: parsedItems.map(({ materialId, quantity, unit }) => ({ materialId, quantity, unit })),
    })
    if (!r.ok || !r.data) {
      toast.error(r.ok ? "No se pudo guardar." : r.message)
      return null
    }
    setSavedId(r.data.id)
    setDirty(false)
    router.refresh()
    return r.data.id
  }

  function save() {
    startTransition(async () => {
      if (await persist()) toast.success("Receta guardada")
    })
  }

  function applyToProduct() {
    const target = productTarget === "new" ? { newName: newProductName || name } : productTarget ? { productId: productTarget } : null
    if (!target) return void toast.error("Elige el producto")
    startTransition(async () => {
      const id = dirty || !savedId ? await persist() : savedId
      if (!id) return
      const r = await applyRecipeToProduct(id, target)
      if (!r.ok) return void toast.error(r.message)
      toast.success(r.message)
      router.refresh()
    })
  }

  function remove() {
    startTransition(async () => {
      const r = await deleteRecipe(savedId!)
      if (!r.ok) return void toast.error(r.message)
      toast.success(r.message)
      router.refresh()
      onClose()
    })
  }

  return (
    <AppModal open onOpenChange={(o) => (o ? null : onClose())} title={recipe ? "Editar receta" : "Nueva receta"} className="sm:max-w-2xl" noAutoFocus>
      <div className="space-y-5">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Nombre de la receta</span>
          <Input
            value={name}
            onChange={(e) => {
              touch()
              setName(e.target.value)
            }}
            placeholder="Ej.: Pan amasado, Torta de chocolate"
            maxLength={80}
            className="h-10"
          />
        </label>

        <div className="space-y-2">
          <p className="text-sm font-medium">Ingredientes</p>
          <ul className="space-y-2">
            {lines.map((l) => {
              const material = byId.get(l.materialId)
              const quantity = parseQuantity(l.quantity)
              const cost = material && quantity ? itemCost({ quantity, unit: l.unit, material }) : null
              return (
                <li key={l.key} className="rounded-xl border p-2.5">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1.6fr)_5.5rem_6.5rem_auto]">
                    <select
                      value={l.materialId}
                      onChange={(e) => (e.target.value === "__new" ? setNewMaterialFor(l.key) : pick(l.key, e.target.value))}
                      className={fieldClass}
                      aria-label="Material"
                    >
                      <option value="">Elige el material</option>
                      {materials.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                      <option value="__new">+ Nuevo material…</option>
                    </select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-10 text-muted-foreground sm:order-last"
                      aria-label="Quitar ingrediente"
                      onClick={() => {
                        touch()
                        setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : ls))
                      }}
                      disabled={lines.length === 1}
                    >
                      <X />
                    </Button>
                    <div className="col-span-2 grid grid-cols-[1fr_6.5rem] gap-2 sm:col-span-2">
                      <Input value={l.quantity} onChange={(e) => setLine(l.key, { quantity: e.target.value })} inputMode="decimal" placeholder="Cantidad" className="h-10" aria-label="Cantidad" />
                      <select
                        value={l.unit}
                        onChange={(e) => setLine(l.key, { unit: e.target.value as RecipeUnit })}
                        className={fieldClass}
                        aria-label="Medida del ingrediente"
                        disabled={!material}
                      >
                        {(material && isRecipeUnit(material.unit) ? compatibleUnits(material.unit) : RECIPE_UNITS).map((u) => (
                          <option key={u} value={u}>
                            {UNIT_LABEL[u]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {material ? (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {cost !== null ? <span className="font-medium text-foreground">Cuesta {money(cost)}</span> : "Escribe la cantidad"}
                      {" · "}paquete de {formatQuantity(material.packQty)} {unitLabel(material.unit)} a {money(material.packPrice)}
                    </p>
                  ) : null}
                </li>
              )
            })}
          </ul>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              touch()
              setLines((ls) => [...ls, { key: crypto.randomUUID(), materialId: "", quantity: "", unit: "g" }])
            }}
            disabled={lines.length >= 40}
          >
            <Plus />
            Agregar ingrediente
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">¿Cuántas unidades rinde?</span>
            <Input
              value={yieldUnits}
              onChange={(e) => {
                touch()
                setYieldUnits(e.target.value)
              }}
              inputMode="numeric"
              className="h-10"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">% adicional</span>
            <PercentField value={overhead} onChange={(v) => (touch(), setOverhead(v))} />
            <span className="block text-xs text-muted-foreground">Mano de obra, gas, luz, envases…</span>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">% de ganancia</span>
            <PercentField value={profit} onChange={(v) => (touch(), setProfit(v))} />
          </label>
        </div>

        <div className="space-y-1.5 rounded-2xl bg-accent/50 p-4 text-sm">
          <Row label="Ingredientes" value={money(t.ingredients)} />
          {overheadPct > 0 ? <Row label={`Adicional (${formatQuantity(overheadPct)} %)`} value={money(t.overhead)} /> : null}
          <Row label="Costo total de la receta" value={money(t.totalCost)} strong />
          <Row label={`Costo por unidad (${units} ${units === 1 ? "unidad" : "unidades"})`} value={money(t.unitCost)} />
          <Row label="Ganancia por unidad" value={money(t.unitProfit)} />
          <div className="flex items-baseline justify-between border-t pt-2">
            <span className="font-medium">Precio de venta por unidad</span>
            <span className="tabular font-display text-2xl font-semibold">{money(t.unitPrice)}</span>
          </div>
          {batches !== null ? (
            <p className={cn("pt-1 text-xs", batches === 0 ? "text-danger" : "text-muted-foreground")}>
              {batches === 0
                ? "Con el stock que tienes no alcanza para hacerla: revisa tus materiales."
                : `Con tu stock alcanza para hacerla ${batches} ${batches === 1 ? "vez" : "veces"} (${batches * units} unidades).`}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button className="h-11 flex-1" onClick={save} disabled={pending || (!dirty && Boolean(savedId))}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {!dirty && savedId ? "Guardada" : "Guardar receta"}
          </Button>
          {savedId ? (
            confirmDelete ? (
              <Button variant="destructive" className="h-11" onClick={remove} disabled={pending}>
                Sí, eliminar
              </Button>
            ) : (
              <Button variant="ghost" className="h-11 text-muted-foreground" onClick={() => setConfirmDelete(true)}>
                <Trash2 />
                Eliminar
              </Button>
            )
          ) : null}
        </div>

        {/* Pasar el precio y el costo a un producto del catálogo, para venderlo con ese precio. */}
        <div className="space-y-2 rounded-xl border p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <PackagePlus className="size-4 text-primary" />
            Usar este precio en un producto
          </p>
          <p className="text-xs text-muted-foreground">
            Le ponemos {money(t.unitPrice)} de precio y {money(t.unitCost)} de costo, para que tus ventas muestren la ganancia real. Además, cada vez que lo vendas
            se descuentan solos los materiales de esta receta (los que tienen stock anotado).
          </p>
          {recipe?.productName ? (
            <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
              Al vender “{recipe.productName}” se descuentan los materiales de esta receta.
            </p>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <select value={productTarget} onChange={(e) => setProductTarget(e.target.value)} className={fieldClass} aria-label="Producto">
              <option value="">Elige un producto</option>
              <option value="new">+ Crear un producto nuevo</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (hoy a {formatMoney(p.price, currency)})
                </option>
              ))}
            </select>
            <Button variant="outline" className="h-10" onClick={applyToProduct} disabled={pending || !productTarget || t.unitPrice <= 0}>
              Aplicar precio
            </Button>
          </div>
          {productTarget === "new" ? (
            <Input value={newProductName} onChange={(e) => setNewProductName(e.target.value)} placeholder={`Nombre del producto (ej.: ${name || "Pan amasado"})`} maxLength={100} className="h-10" />
          ) : null}
        </div>
      </div>

      {newMaterialFor ? (
        <MaterialDialog
          currency={currency}
          material={null}
          usedIn={0}
          onClose={() => setNewMaterialFor(null)}
          onSaved={(id, unit) => {
            const key = newMaterialFor
            // La lista de materiales llega con el refresco; mientras tanto se deja elegido, en la medida chica (kg → g).
            const small: RecipeUnit = unit === "kg" ? "g" : unit === "l" ? "ml" : unit
            setLines((ls) => ls.map((l) => (l.key === key ? { ...l, materialId: id, unit: small } : l)))
            touch()
          }}
        />
      ) : null}
    </AppModal>
  )
}

function PercentField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Input value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" className="h-10 pr-8" />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">%</span>
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", strong && "font-semibold")}>
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  )
}
