"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { BookOpen, Loader2, Package, PackagePlus, Pencil, Plus, Search, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { AppModal } from "@/components/app/app-modal"
import { MoneyInput } from "@/components/app/money-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMoney } from "@/lib/currency"
import {
  batchesFromStock,
  compatibleUnits,
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
import { applyRecipeToProduct, deleteRecipe, deleteRecipeMaterial, saveRecipe, saveRecipeMaterial } from "@/server/actions/recipes"

export type MaterialRow = { id: string; name: string; unit: string; packQty: number; packPrice: number; stock: number | null }
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
}: {
  currency: string
  materials: MaterialRow[]
  recipes: RecipeRow[]
  products: ProductOption[]
  initialTab: "recetas" | "materiales"
}) {
  const [tab, setTab] = React.useState(initialTab)
  const [query, setQuery] = React.useState("")
  const [editingMaterial, setEditingMaterial] = React.useState<MaterialRow | "new" | null>(null)
  const [editingRecipe, setEditingRecipe] = React.useState<RecipeRow | "new" | null>(null)
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
          <Button onClick={() => (materials.length ? setEditingRecipe("new") : (setTab("materiales"), toast.info("Primero agrega los materiales que usas: harina, levadura, aceite…")))}>
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
              <li key={m.id}>
                <button type="button" onClick={() => setEditingMaterial(m)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/40">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{m.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatQuantity(m.packQty)} {unitLabel(m.unit)} a {money(m.packPrice)}
                    </span>
                  </span>
                  <span className={cn("shrink-0 text-right text-xs", m.stock === null ? "text-muted-foreground" : m.stock === 0 ? "font-medium text-danger" : "font-medium")}>
                    {m.stock === null ? "Sin stock anotado" : `Tienes ${formatQuantity(m.stock)} ${unitLabel(m.unit)}`}
                  </span>
                  <Pencil className="size-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
        </ul>
      )}

      {editingMaterial ? (
        <MaterialDialog
          currency={currency}
          material={editingMaterial === "new" ? null : editingMaterial}
          usedIn={editingMaterial === "new" ? 0 : recipes.filter((r) => r.items.some((i) => i.materialId === editingMaterial.id)).length}
          onClose={() => setEditingMaterial(null)}
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
  onClose,
  onSaved,
}: {
  currency: string
  material: MaterialRow | null
  usedIn: number
  onClose: () => void
  onSaved?: (id: string, unit: RecipeUnit) => void
}) {
  const router = useRouter()
  const [name, setName] = React.useState(material?.name ?? "")
  const [unit, setUnit] = React.useState<RecipeUnit>(material && isRecipeUnit(material.unit) ? material.unit : "kg")
  const [packQty, setPackQty] = React.useState(material ? formatQuantity(material.packQty) : "")
  const [packPrice, setPackPrice] = React.useState(material?.packPrice ?? 0)
  const [stock, setStock] = React.useState(material?.stock === null || material?.stock === undefined ? "" : formatQuantity(material.stock))
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
      const r = await saveRecipeMaterial(material?.id ?? null, { name, unit, packQty: qty, packPrice, stock: st })
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
          <p className="text-xs text-muted-foreground">Le ponemos {money(t.unitPrice)} de precio y {money(t.unitCost)} de costo, para que tus ventas muestren la ganancia real.</p>
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
