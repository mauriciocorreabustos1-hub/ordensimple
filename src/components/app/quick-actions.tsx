"use client"

import * as React from "react"
import type { PaymentMethod } from "@/generated/prisma/enums"
import type { PromoRule } from "@/lib/promotions"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AppModal } from "@/components/app/app-modal"
import { QuickSaleForm } from "@/components/sales/quick-sale-form"
import { SaleForm, type ProductOption } from "@/components/sales/sale-form"
import { ExpenseForm, type ExpenseCategoryOption } from "@/components/expenses/expense-form"

type Action = "sale" | "expense"

/** Datos con que se abre el formulario: por ahora, el proveedor de una compra. */
type Preset = { supplierName?: string }
type QuickActionsContextValue = { open: (action: Action, preset?: Preset) => void }

const QuickActionsContext = React.createContext<QuickActionsContextValue | null>(null)

/** Qué permite el plan en pantallas del navegador: vender al fiado y el cierre de caja (Pro). */
const ALL_ALLOWED = { fiado: true, cashClose: true }
const PlanFlagsContext = React.createContext(ALL_ALLOWED)
export function usePlanFlags() {
  return React.useContext(PlanFlagsContext)
}

/** Si quien usa la app puede aplicar descuentos directo (dueño o administrador) o debe pedirlos (empleado). */
const DiscountRoleContext = React.createContext(true)
export function useCanApproveDiscounts() {
  return React.useContext(DiscountRoleContext)
}

/** IVA de las ventas: tasa y nombre si el negocio cobra IVA (los precios lo llevan incluido); null si no. */
const SalesVatContext = React.createContext<{ rate: number; label: string } | null>(null)
export function useSalesVat() {
  return React.useContext(SalesVatContext)
}

/** Proveedores registrados del negocio (para elegirlos al anotar un gasto). */
const SuppliersContext = React.createContext<string[]>([])
export function useSuppliers() {
  return React.useContext(SuppliersContext)
}

/** Promociones vigentes del negocio (para mostrar el descuento al vender; el servidor las recalcula al guardar). */
const PromotionsContext = React.createContext<PromoRule[]>([])
export function usePromotions() {
  return React.useContext(PromotionsContext)
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
  vat = null,
  chile = false,
  customers,
  suppliers = [],
  continuousScan = true,
  fiado = true,
  cashClose = true,
  canApproveDiscounts = true,
  productsOnly = false,
  promotions = [],
}: {
  /** Promociones activas (2×1, %, happy hour). */
  promotions?: PromoRule[]
  children: React.ReactNode
  currency: string
  timezone: string
  defaultPayment: PaymentMethod
  products: ProductOption[]
  categories: ExpenseCategoryOption[]
  chargesVat: boolean
  /** IVA de las ventas (si el negocio cobra IVA): para mostrar el neto de los precios. */
  vat?: { rate: number; label: string } | null
  /** Negocio en Chile: boletas de honorarios con retención. */
  chile?: boolean
  customers: string[]
  /** Proveedores registrados, los más usados primero. */
  suppliers?: string[]
  /** El plan incluye escaneo continuo al vender. */
  continuousScan?: boolean
  /** El plan permite vender al fiado (Pro). */
  fiado?: boolean
  /** El plan incluye el cierre de caja (Pro). */
  cashClose?: boolean
  /** Dueño o administrador: aplica descuentos directo. Empleado: los pide. */
  canApproveDiscounts?: boolean
  /** Empleado que solo vende productos guardados: sin venta rápida ni productos a mano. */
  productsOnly?: boolean
}) {
  const [action, setAction] = React.useState<Action | null>(null)
  const [preset, setPreset] = React.useState<Preset | undefined>()
  const value = React.useMemo(
    () => ({
      open: (a: Action, p?: Preset) => {
        setPreset(p)
        setAction(a)
      },
    }),
    [],
  )
  const close = () => setAction(null)
  const flags = React.useMemo(() => ({ fiado, cashClose }), [fiado, cashClose])

  return (
    <QuickActionsContext.Provider value={value}>
      <PlanFlagsContext.Provider value={flags}>
      <SuppliersContext.Provider value={suppliers}>
      <DiscountRoleContext.Provider value={canApproveDiscounts}>
      <PromotionsContext.Provider value={promotions}>
      <SalesVatContext.Provider value={vat}>
      {children}
      <AppModal open={action === "sale"} onOpenChange={(o) => !o && close()} title="Registrar venta">
        <Tabs defaultValue="detailed" className="gap-5">
          {productsOnly ? null : (
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="detailed">Con detalle</TabsTrigger>
              <TabsTrigger value="quick">Venta rápida</TabsTrigger>
            </TabsList>
          )}
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
              productsOnly={productsOnly}
              onDone={close}
            />
          </TabsContent>
        </Tabs>
      </AppModal>
      <AppModal
        open={action === "expense"}
        onOpenChange={(o) => !o && close()}
        title={preset?.supplierName ? `Compra a ${preset.supplierName}` : "Registrar gasto"}
      >
        <ExpenseForm
          key={preset?.supplierName ?? "gasto"}
          currency={currency}
          timezone={timezone}
          categories={categories}
          chargesVat={chargesVat}
          chile={chile}
          supplierPreset={preset?.supplierName}
          onDone={close}
        />
      </AppModal>
      </SalesVatContext.Provider>
      </PromotionsContext.Provider>
      </DiscountRoleContext.Provider>
      </SuppliersContext.Provider>
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
    <button type="button" onClick={() => open(action)} className={className} data-tour={action === "sale" ? "registrar-venta" : "registrar-gasto"}>
      {children}
    </button>
  )
}
