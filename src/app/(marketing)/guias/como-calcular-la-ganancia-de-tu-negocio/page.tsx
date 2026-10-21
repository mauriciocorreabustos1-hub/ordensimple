import type { Metadata } from "next"
import Link from "next/link"
import { Formula, GuideSection } from "@/components/landing/calculator-page"
import { GuidePage } from "@/components/landing/guide-page"
import { SignupLink } from "@/components/landing/signup-link"

const HREF = "/guias/como-calcular-la-ganancia-de-tu-negocio"

export const metadata: Metadata = {
  title: "Cómo calcular la ganancia de tu negocio (con ejemplos)",
  description:
    "Cómo saber cuánto gana realmente tu negocio: la fórmula de la ganancia, un ejemplo en pesos chilenos y los errores más comunes.",
  alternates: { canonical: HREF },
}

export default function ProfitGuidePage() {
  return (
    <GuidePage
      href={HREF}
      title="Cómo calcular la ganancia de tu negocio"
      description="Muchos negocios venden harto y aun así no les alcanza. La diferencia está entre lo que vendes y lo que te queda. Así se calcula."
      updated="4 de octubre de 2026"
      readingMinutes={5}
    >
      <GuideSection title="Vender no es lo mismo que ganar">
        <p>
          Lo que vendes es la plata que entra. La <strong>ganancia</strong> es lo que te queda después de pagar todo: la
          mercadería, el arriendo, la luz, los sueldos y todos los demás gastos.
        </p>
        <Formula>Ganancia = Ventas − Lo que pagaste por la mercadería − Gastos del negocio</Formula>
      </GuideSection>

      <GuideSection title="Un ejemplo con números">
        <p>En un mes, un almacén:</p>
        <ul>
          <li>Vendió <strong>$3.000.000</strong>.</li>
          <li>Pagó <strong>$2.000.000</strong> en mercadería a sus proveedores.</li>
          <li>Tuvo <strong>$600.000</strong> de otros gastos: arriendo, luz, internet y un sueldo.</li>
        </ul>
        <Formula>$3.000.000 − $2.000.000 − $600.000 = $400.000 de ganancia</Formula>
        <p>
          Dicho en simple: de cada $1.000 que vendió, le quedaron unos <strong>$133</strong>. Vendió tres millones, pero
          ganó cuatrocientos mil.
        </p>
      </GuideSection>

      <GuideSection title="Los errores más comunes">
        <ul>
          <li>
            <strong>No contar tu propio sueldo.</strong> Si trabajas en el negocio, tu sueldo es un gasto. Si no lo
            cuentas, crees que ganas más de lo que realmente ganas.
          </li>
          <li>
            <strong>Mezclar la plata de la casa con la del negocio.</strong> Si sacas de la caja sin anotarlo, los números
            nunca van a cuadrar.
          </li>
          <li>
            <strong>Olvidar los gastos chicos.</strong> Bolsas, gas, pasajes y la comisión de la máquina de tarjetas suman
            mucho a fin de mes.
          </li>
          <li>
            <strong>Confundir margen con ganancia.</strong> Ganarle $300 a un producto no significa que el negocio gane: con
            ese margen todavía hay que pagar los gastos fijos. Para eso sirve el{" "}
            <Link href="/calculadoras/punto-de-equilibrio" className="text-primary underline-offset-4 hover:underline">
              punto de equilibrio
            </Link>
            .
          </li>
        </ul>
      </GuideSection>

      <GuideSection title="¿Cada cuánto calcularla?">
        <p>
          Lo ideal es mirar la ganancia del <strong>mes</strong> y compararla con la del mes anterior, en las mismas
          fechas. Un día malo no dice mucho; un mes completo sí. Si la ganancia baja, revisa primero los gastos: muchas
          veces es más fácil gastar menos que vender más.
        </p>
      </GuideSection>

      <GuideSection title="Que la cuenta se haga sola">
        <p>
          En <SignupLink className="text-primary underline-offset-4 hover:underline">OrdenSimple</SignupLink> anotas
          tus ventas y gastos (incluidas las compras de mercadería) y el panel te muestra la ganancia aproximada de hoy y
          del mes, comparada con el período anterior. Cada lunes, además, te llega al correo el resumen de tu semana.
        </p>
      </GuideSection>
    </GuidePage>
  )
}
