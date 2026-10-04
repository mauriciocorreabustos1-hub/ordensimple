import type { Metadata } from "next"
import Link from "next/link"
import { CheckCircle2, MailX, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Container } from "@/components/landing/sections"
import { verifyUnsubscribe } from "@/lib/unsubscribe"
import { confirmUnsubscribe } from "@/server/actions/unsubscribe"

export const metadata: Metadata = {
  title: "Dejar de recibir correos",
  robots: { index: false, follow: false },
}

function Panel({ icon: Icon, title, children }: { icon: typeof MailX; title: string; children: React.ReactNode }) {
  return (
    <Container className="flex max-w-lg flex-col items-center gap-4 py-20 text-center md:py-28">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-7" />
      </span>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {children}
    </Container>
  )
}

// La baja se confirma con un botón: así los antivirus de correo que abren los enlaces no dan de baja a nadie.
export default async function UnsubscribePage({ searchParams }: PageProps<"/baja">) {
  const params = await searchParams

  if (params.listo) {
    return (
      <Panel icon={CheckCircle2} title="Listo, ya no te enviaremos estos correos">
        <p className="text-muted-foreground">
          Seguirás recibiendo solo los correos necesarios de tu cuenta, como el de recuperar tu contraseña. Si cambias de
          opinión, puedes volver a activar las ofertas en Configuración.
        </p>
        <Button asChild variant="outline">
          <Link href="/">Ir a OrdenSimple</Link>
        </Button>
      </Panel>
    )
  }

  const u = typeof params.u === "string" ? params.u : ""
  const t = typeof params.t === "string" ? params.t : ""
  if (params.error || !verifyUnsubscribe(u, t)) {
    return (
      <Panel icon={TriangleAlert} title="Este enlace no es válido">
        <p className="text-muted-foreground">
          Puede que se haya cortado al copiarlo. También puedes desactivar las ofertas entrando a tu cuenta, en
          Configuración, o escribiéndonos a contacto@ordensimple.cl.
        </p>
        <Button asChild variant="outline">
          <Link href="/login">Iniciar sesión</Link>
        </Button>
      </Panel>
    )
  }

  return (
    <Panel icon={MailX} title="¿Dejar de recibir estos correos?">
      <p className="text-muted-foreground">
        No te enviaremos más consejos, novedades ni promociones de OrdenSimple. Tu cuenta y tus datos siguen igual.
      </p>
      <form action={confirmUnsubscribe}>
        <input type="hidden" name="u" value={u} />
        <input type="hidden" name="t" value={t} />
        <Button type="submit" size="lg" className="h-11 px-6">
          Sí, dejar de recibirlos
        </Button>
      </form>
    </Panel>
  )
}
