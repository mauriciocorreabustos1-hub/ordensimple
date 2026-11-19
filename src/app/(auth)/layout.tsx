import { Logo } from "@/components/app/logo"
import { MadeBy } from "@/components/landing/made-by"
import { ClosingReceipt } from "@/components/landing/closing-receipt"
import { CookieNotice } from "@/components/landing/cookie-notice"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-4 py-6 sm:px-8">
        <Logo className="self-center lg:self-start" />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
        <MadeBy className="self-center lg:self-start" />
      </div>

      {/* Panel de marca: verde oscuro liso (el de las franjas de la portada) con el cierre de caja del día. */}
      <div className="hidden bg-deep text-deep-foreground lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div className="flex flex-1 items-center justify-center py-8">
          <ClosingReceipt />
        </div>
        <div className="max-w-md space-y-4">
          <p className="font-display text-3xl leading-[1.1] font-semibold tracking-tight text-balance xl:text-4xl">
            Cierras la caja en un minuto y sabes cuánto ganaste.
          </p>
          <p className="text-deep-foreground/75">Ventas, gastos, fiado y productos, desde el celular. Sin planillas ni fórmulas.</p>
        </div>
      </div>
      <CookieNotice />
    </div>
  )
}
