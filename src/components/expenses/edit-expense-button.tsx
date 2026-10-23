"use client"

import * as React from "react"
import { Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppModal } from "@/components/app/app-modal"
import { ExpenseForm, type ExpenseCategoryOption, type ExpenseEdit } from "@/components/expenses/expense-form"

export function EditExpenseButton({
  expense,
  currency,
  timezone,
  categories,
  chargesVat,
  chile,
}: {
  expense: ExpenseEdit
  currency: string
  timezone: string
  categories: ExpenseCategoryOption[]
  chargesVat?: boolean
  chile?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)} aria-label="Editar gasto" className="text-muted-foreground">
        <Pencil />
      </Button>
      <AppModal open={open} onOpenChange={setOpen} title="Editar gasto">
        {open ? (
          <ExpenseForm
            currency={currency}
            timezone={timezone}
            categories={categories}
            chargesVat={chargesVat}
            chile={chile}
            editing={expense}
            onDone={() => setOpen(false)}
          />
        ) : null}
      </AppModal>
    </>
  )
}
