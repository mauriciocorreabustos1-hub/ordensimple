"use client"

import * as React from "react"
import { Loader2, Plus, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createExpenseCategory, deleteExpenseCategory } from "@/server/actions/settings"

export function ExpenseCategories({
  categories,
  disabled,
}: {
  categories: { id: string; name: string }[]
  disabled: boolean
}) {
  const [name, setName] = React.useState("")
  const [pending, startTransition] = React.useTransition()

  function add(e: React.FormEvent) {
    e.preventDefault()
    if (name.trim().length < 2) return
    startTransition(async () => {
      const r = await createExpenseCategory(name.trim())
      if (r.ok) {
        toast.success(r.message ?? "Categoría creada")
        setName("")
      } else toast.error(r.message)
    })
  }

  function remove(id: string, label: string) {
    if (!window.confirm(`¿Eliminar la categoría "${label}"? Los gastos que la usan quedarán sin categoría.`)) return
    startTransition(async () => {
      const r = await deleteExpenseCategory(id)
      if (r.ok) toast.success(r.message ?? "Eliminada")
      else toast.error(r.message)
    })
  }

  return (
    <div className="space-y-4">
      <ul className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-1 rounded-full border bg-card py-1 pr-1 pl-3 text-sm">
            {c.name}
            {!disabled ? (
              <button
                type="button"
                onClick={() => remove(c.id, c.name)}
                className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-destructive"
                aria-label={`Eliminar ${c.name}`}
                disabled={pending}
              >
                <X className="size-3.5" />
              </button>
            ) : (
              <span className="w-2" />
            )}
          </li>
        ))}
      </ul>
      {!disabled ? (
        <form onSubmit={add} className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nueva categoría" maxLength={40} className="h-9 max-w-xs" aria-label="Nombre de la nueva categoría" />
          <Button type="submit" variant="outline" size="lg" disabled={pending || name.trim().length < 2}>
            {pending ? <Loader2 className="animate-spin" /> : <Plus />}
            Agregar
          </Button>
        </form>
      ) : null}
    </div>
  )
}
