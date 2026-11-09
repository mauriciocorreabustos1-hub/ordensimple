import Link from "next/link"
import { Container } from "@/components/landing/sections"

// Solo lo que OrdenSimple hace de verdad (ver la política de privacidad, sección Seguridad). Sin testimonios ni cifras inventadas.
const FACTS = [
  { title: "Seguridad de la información", text: "Todo viaja cifrado por HTTPS. Tus contraseñas se almacenan de forma segura mediante un sistema de protección criptográfica." },
  { title: "Cada negocio, por separado", text: "Los datos de tu negocio no se mezclan con los de otros negocios que usan OrdenSimple." },
  { title: "Tú decides quién entra", text: "Invitas a cada trabajador con su propio acceso, y le quitas el acceso cuando quieras." },
  { title: "Verificación en dos pasos", text: "Si la activas, al iniciar sesión te pedimos un código además de la contraseña. También limitamos los intentos fallidos." },
  { title: "Respaldos periódicos", text: "Tu información queda en la nube con respaldos periódicos: si cambias o pierdes el celular, entras desde otro con tu cuenta." },
  { title: "Tus datos son tuyos", text: "No los vendemos ni los usamos para publicidad. Descargas tus ventas y gastos en Excel, o borras tu cuenta cuando quieras." },
]

/** Confianza con hechos verificables: seguridad, privacidad y cuántas personas ya lo usan (el número real). */
export function TrustSection({ users }: { users?: number | null }) {
  return (
    <section aria-labelledby="confianza-titulo" className="border-t">
      <Container className="py-16 md:py-24">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <div className="space-y-4">
            <h2 id="confianza-titulo" className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-[3.25rem] sm:leading-[1.04]">
              Tu negocio, en buenas manos
            </h2>
            <p className="text-lg text-pretty text-muted-foreground">
              Anotas plata, deudas y clientes. Por eso cuidamos tu información con estas medidas, y te contamos cuáles son.
            </p>
            {users ? (
              <p className="text-pretty">
                <span className="tabular font-display text-4xl font-semibold text-primary">{users.toLocaleString("es-CL")}</span>
                <span className="block text-muted-foreground">personas ya tienen su cuenta en OrdenSimple.</span>
              </p>
            ) : null}
            <Link href="/privacidad" className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline">
              Leer la política de privacidad
            </Link>
          </div>
          <dl className="border-t border-foreground/80">
            {FACTS.map((f) => (
              <div key={f.title} className="grid gap-1 border-b py-4 sm:grid-cols-[12.5rem_minmax(0,1fr)] sm:gap-6">
                <dt className="font-semibold text-pretty">{f.title}</dt>
                <dd className="text-sm text-pretty text-muted-foreground">{f.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Container>
    </section>
  )
}
