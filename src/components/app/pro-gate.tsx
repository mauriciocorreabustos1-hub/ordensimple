import Link from "next/link"
import { Crown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/app/page-header"
import { formatMoney } from "@/lib/currency"
import { BILLING_ENABLED, PLANS } from "@/lib/plans"

/** Se muestra en lugar de una función Pro cuando el plan del negocio no la incluye. */
export function ProGate({ title, description }: { title: string; description: string }) {
  const price = PLANS.PRO.monthlyPrice
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-primary/30 bg-accent/40 px-6 py-14 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Crown className="size-6" />
        </span>
        <div className="space-y-1">
          <p className="text-lg font-semibold">Esta función es parte del plan Pro</p>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            Mejora tu plan para usar inventario, clientes y fiado, proveedores, reportes, resultados e IVA y consejos
            automáticos.
            {BILLING_ENABLED && price ? ` Pro cuesta ${formatMoney(price, "CLP")} al mes y lo cancelas cuando quieras.` : ""}
          </p>
          <p className="mx-auto max-w-md text-xs text-muted-foreground">Tus datos están a salvo: nada se borra.</p>
        </div>
        <Button asChild>
          <Link href={BILLING_ENABLED ? "/dashboard/configuracion#plan" : "/precios"}>
            {BILLING_ENABLED ? "Contratar Pro" : "Ver planes"}
          </Link>
        </Button>
      </div>
    </div>
  )
}
