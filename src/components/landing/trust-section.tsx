import Link from "next/link"
import { Container } from "@/components/landing/sections"

// Solo lo que OrdenSimple hace de verdad (ver la política de privacidad, sección Seguridad). Sin testimonios ni cifras inventadas.
const FACTS = [
  { title: "Conexión cifrada", text: "Todo viaja por HTTPS, y tu contraseña se guarda cifrada: nadie puede leerla." },
  { title: "Cada negocio, por separado", text: "Los datos de tu negocio no se mezclan con los de otros, y solo los ve quien tú autorices." },
  { title: "Respaldos periódicos", text: "Tu información queda en la nube: si se te pierde o se te rompe el celular, entras desde otro y está todo." },
  { title: "Verificación en dos pasos", text: "Si quieres más seguridad, al iniciar sesión te pedimos un código además de la contraseña." },
  { title: "Tus datos son tuyos", text: "No los vendemos ni los usamos para publicidad. Los descargas en Excel o borras tu cuenta cuando quieras." },
  { title: "Hecho en Chile", text: "En pesos chilenos, con el IVA y el F29 como se usan acá, y con ayuda por WhatsApp en tu idioma." },
]

/** Confianza con hechos verificables: seguridad, privacidad y cuántas personas ya lo usan (el número real). */
export function TrustSection({ users }: { users?: number | null }) {
  return (
    <section aria-labelledby="confianza-titulo" className="border-t">
      <Container className="py-16 md:py-24">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <div className="space-y-4">
            <h2 id="confianza-titulo" className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-[2.6rem] sm:leading-[1.1]">
              Tu negocio, en buenas manos
            </h2>
            <p className="text-lg text-pretty text-muted-foreground">
              Anotas plata, deudas y clientes. Por eso cuidamos tu información como si fuera nuestra.
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
          <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {FACTS.map((f) => (
              <div key={f.title} className="border-t border-foreground/15 pt-4">
                <dt className="font-semibold">{f.title}</dt>
                <dd className="mt-1 text-sm text-pretty text-muted-foreground">{f.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Container>
    </section>
  )
}
