import Link from "next/link"
import { BookOpen } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ExpiryBadge } from "@/components/recipes/recipes-board"
import { formatQuantity, isRecipeUnit, UNIT_LABEL } from "@/lib/recipes"

export type InventoryMaterial = {
  id: string
  name: string
  unit: string
  stock: number | null
  /** Lo que vale lo que hay, según el precio del paquete. */
  value: number
  /** "AAAA-MM-DD" */
  expiresAt: string | null
}

/** Materiales de las recetas dentro del Inventario: cuánto hay, cuánto vale y cuándo vence. Se editan en Recetas. */
export function MaterialsCard({
  materials,
  today,
  money,
  showCosts,
  canEdit,
}: {
  materials: InventoryMaterial[]
  today: string
  money: (n: number) => string
  showCosts: boolean
  canEdit: boolean
}) {
  const total = materials.reduce((sum, m) => sum + m.value, 0)
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="size-4 text-primary" />
            Materiales de recetas
          </CardTitle>
          <CardDescription>Lo que compras para tus recetas.{showCosts && total > 0 ? ` Lo que tienes vale ${money(Math.round(total))}.` : ""}</CardDescription>
        </div>
        {canEdit ? (
          <Link href="/dashboard/recetas?pestana=materiales" className="text-sm font-medium text-primary hover:underline">
            Editar en Recetas
          </Link>
        ) : null}
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {materials.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium">{m.name}</span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  {m.stock === null ? (
                    "Sin stock anotado"
                  ) : m.stock <= 0 ? (
                    <span className="font-medium text-danger">Agotado</span>
                  ) : (
                    `Tienes ${formatQuantity(m.stock)} ${isRecipeUnit(m.unit) ? UNIT_LABEL[m.unit] : m.unit}`
                  )}
                  <ExpiryBadge expiresAt={m.expiresAt} today={today} />
                </span>
              </span>
              {showCosts && m.value > 0 ? <span className="tabular shrink-0 text-xs text-muted-foreground">{money(Math.round(m.value))}</span> : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
