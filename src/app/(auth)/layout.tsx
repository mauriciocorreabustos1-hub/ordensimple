import { CheckCircle2 } from "lucide-react"
import { Logo } from "@/components/app/logo"

const points = [
  "Registra una venta en menos de 10 segundos",
  "Sabe cuánto ganas, sin fórmulas ni Excel",
  "Calculadoras para poner precios y metas",
]

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-4 py-6 sm:px-8">
        <Logo />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-primary lg:flex lg:flex-col lg:justify-end lg:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,oklch(1_0_0/0.18),transparent_55%)]" />
        <div className="relative space-y-6 text-primary-foreground">
          <p className="text-3xl leading-tight font-semibold tracking-tight">
            Administra tu negocio
            <br />
            sin complicarte.
          </p>
          <ul className="space-y-3">
            {points.map((p) => (
              <li key={p} className="flex items-center gap-3 text-primary-foreground/90">
                <CheckCircle2 className="size-5 shrink-0" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
