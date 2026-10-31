import type { Metadata } from "next"
import Link from "next/link"
import { Monitor, Printer, RefreshCw, Wifi } from "lucide-react"
import { CtaSection, PageHero, Section } from "@/components/landing/sections"
import { DESKTOP_DOWNLOAD_URL } from "@/lib/desktop"
import { MsStoreBadge } from "@/components/landing/ms-store-badge"

export const metadata: Metadata = {
  title: "OrdenSimple para PC",
  description: "Descarga OrdenSimple para Windows: tu negocio en su propia ventana, con boletas y comandas que salen directo en tus impresoras, sin la ventana de impresión.",
  alternates: { canonical: "/descargar" },
}

const FEATURES = [
  { icon: Printer, title: "Imprime al instante", text: "Un clic y la boleta, la cuenta o la comanda sale en la impresora que elijas. Sin ventanas ni configuraciones: la térmica corta el papel sola." },
  { icon: Wifi, title: "Impresoras USB y de red", text: "Cualquier impresora instalada en Windows y las de cocina conectadas por Wi-Fi o cable, por su dirección IP." },
  { icon: Monitor, title: "Su propia ventana", text: "Un ícono en el escritorio que abre tu negocio al tiro, separado del navegador." },
  { icon: RefreshCw, title: "Segura y siempre al día", text: "Verificada por Microsoft y se actualiza sola desde la tienda. Todo lo nuevo aparece sin reinstalar nada." },
]

export default function DownloadPage() {
  return (
    <>
      <PageHero
        title="Cobra, imprime y atiende al siguiente"
        description="OrdenSimple para el computador de tu caja: la boleta sale impresa en el mismo segundo en que registras la venta, y la comanda llega impresa a la cocina."
      />
      <Section className="border-t-0">
        <div className="mx-auto max-w-3xl space-y-10 px-4 py-12">
          <div className="flex flex-col items-start gap-3">
            <MsStoreBadge height={56} />
            <p className="text-sm text-muted-foreground">Gratis · Windows 10 y 11 · verificada por Microsoft · usa tu misma cuenta de OrdenSimple.</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="space-y-2 rounded-2xl border p-5">
                <f.icon className="size-5 text-primary" />
                <h2 className="font-semibold">{f.title}</h2>
                <p className="text-sm text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight">Cómo instalarla</h2>
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>
                Toca <strong>Descargar desde Microsoft Store</strong>. Se abre la tienda de tu computador: toca <strong>Obtener</strong>.
              </li>
              <li>Se instala sola en un minuto. Abre OrdenSimple desde el menú Inicio e inicia sesión con tu cuenta.</li>
              <li>
                En Configuración, sección Impresoras, elige <strong>Impresora de este PC</strong> y tu impresora. Toca <strong>Imprimir prueba</strong>.
              </li>
            </ol>
          </div>

          <p className="text-sm text-muted-foreground">
            ¿Tu computador no tiene Microsoft Store (por ejemplo, uno de empresa)?{" "}
            <a href={DESKTOP_DOWNLOAD_URL} className="text-primary underline-offset-2 hover:underline">
              Descarga el instalador directo
            </a>
            . Si Windows muestra “Windows protegió su PC”, toca “Más información” y luego “Ejecutar de todas formas”.
          </p>

          <p className="text-sm text-muted-foreground">
            ¿Usas celular o tablet? <Link href="/instalar" className="text-primary underline-offset-2 hover:underline">Instálala en tu celular</Link>.
          </p>
        </div>
      </Section>
      <CtaSection title="¿Todavía no tienes cuenta?" text="Créala gratis y después descarga la app para tu PC." />
    </>
  )
}
