"use client"

import * as React from "react"
import type { PaymentMethod } from "@/generated/prisma/enums"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AppModal } from "@/components/app/app-modal"
import { QuickSaleForm } from "@/components/sales/quick-sale-form"
import { SaleForm, type ProductOption } from "@/components/sales/sale-form"
import { ExpenseForm, type ExpenseCategoryOption } from "@/components/expenses/expense-form"

type Action = "sale" | "expense"

type QuickActionsContextValue = { open: (action: Action) => void }

const QuickActionsContext = React.createContext<QuickActionsContextValue | null>(null)

/** Qué permite el plan en los formularios de venta (por ahora: vender al fiado). */
const ALL_ALLOWED = { fiado: true }
const NO_FIADO = { fiado: false }
const PlanFlagsContext = React.createContext(ALL_ALLOWED)
export function usePlanFlags() {
  return React.useContext(PlanFlagsContext)
}

export function useQuickActions() {
  const ctx = React.useContext(QuickActionsContext)
  if (!ctx) throw new Error("useQuickActions debe usarse dentro de QuickActionsProvider")
  return ctx
}

/** Permite abrir "Registrar venta" o "Registrar gasto" desde cualquier pantalla del dashboard. */
export function QuickActionsProvider({
  children,
  currency,
  timezone,
  defaultPayment,
  products,
  categories,
  chargesVat,
  customers,
  continuousScan = true,
  fiado = true,
}: {
  children: React.ReactNode
  currency: string
  timezone: string
  defaultPayment: PaymentMethod
  products: ProductOption[]
  categories: ExpenseCategoryOption[]
  chargesVat: boolean
  customers: string[]
  /** El plan incluye escaneo continuo al vender. */
  continuousScan?: boolean
  /** El plan permite vender al fiado (Pro). */
  fiado?: boolean
}) {
  const [action, setAction] = React.useState<Action | null>(null)
  const value = React.useMemo(() => ({ open: (a: Action) => setAction(a) }), [])
  const close = () => setAction(null)

  return (
    <QuickActionsContext.Provider value={value}>
      <PlanFlagsContext.Provider value={fiado ? ALL_ALLOWED : NO_FIADO}>
      {children}
      <AppModal open={action === "sale"} onOpenChange={(o) => !o && close()} title="Registrar venta">
        <Tabs defaultValue="detailed" className="gap-5">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="detailed">Con detalle</TabsTrigger>
            <TabsTrigger value="quick">Venta rápida</TabsTrigger>
          </TabsList>
          <TabsContent value="quick">
            <QuickSaleForm
              currency={currency}
              timezone={timezone}
              defaultPayment={defaultPayment}
              customers={customers}
              onDone={close}
            />
          </TabsContent>
          <TabsContent value="detailed">
            <SaleForm
              currency={currency}
              timezone={timezone}
              defaultPayment={defaultPayment}
              products={products}
              customers={customers}
              continuousScan={continuousScan}
              onDone={close}
            />
          </TabsContent>
        </Tabs>
      </AppModal>
      <AppModal open={action === "expense"} onOpenChange={(o) => !o && close()} title="Registrar gasto">
        <ExpenseForm currency={currency} timezone={timezone} categories={categories} chargesVat={chargesVat} onDone={close} />
      </AppModal>
      </PlanFlagsContext.Provider>
    </QuickActionsContext.Provider>
  )
}

export function QuickActionButton({
  action,
  children,
  className,
}: {
  action: Action
  children: React.ReactNode
  className?: string
}) {
  const { open } = useQuickActions()
  return (
    <button type="button" onClick={() => open(action)} className={className}>
      {children}
    </button>
  )
}
