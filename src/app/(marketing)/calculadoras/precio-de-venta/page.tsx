import type { Metadata } from "next"
import Link from "next/link"
import { PriceCalculator } from "@/components/tools/price-calculator"
import { CalculatorPage, Formula, GuideSection } from "@/components/landing/calculator-page"

export const metadata: Metadata = {
  title: "Calculadora de precio de venta y margen de ganancia",
  description:
    "Calcula gratis a cuánto vender un producto para ganar el margen que quieres. Con la fórmula explicada y ejemplos en pesos chilenos.",
  alternates: { canonical: "/calculadoras/precio-de-venta" },
}

export default function PriceCalculatorPage() {
  return (
    <CalculatorPage
      current="/calculadoras/precio-de-venta"
      title="Calculadora de precio de venta"
      description="Escribe cuánto te cuesta un producto y cuánto quieres ganar. Te decimos a cuánto venderlo."
      calculator={<PriceCalculator currency="CLP" />}
    >
      <GuideSection title="¿Cómo se calcula el precio de venta?">
        <p>
          Para ganar un porcentaje de lo que vendes (el <strong>margen</strong>
          ), divide lo que te cuesta el producto por lo que te queda de cada venta:
        </p>
        <Formula>Precio de venta = Costo ÷ (1 − margen)</Formula>
        <p>
          Por ejemplo, si un producto te cuesta <strong>$1.000</strong> y quieres ganar el <strong>30%</strong> de lo
          que vendes: $1.000 ÷ 0,7 = <strong>$1.429</strong>. De cada venta te quedan $429, que es el 30% de $1.429.
        </p>
      </GuideSection>

      <GuideSection title="El error más común: sumarle el 30% al costo">
        <p>
          Muchos negocios ponen el precio sumando un porcentaje al costo: $1.000 + 30% = $1.300. Parece lo mismo, pero
          no lo es. De esos $1.300 te quedan $300, que es solo el <strong>23%</strong> de lo que vendes.
        </p>
        <p>
          La diferencia se nota a fin de mes: si haces tus cuentas pensando que ganas el 30% y en realidad ganas el 23%,
          te va a faltar plata para cubrir el arriendo, la luz y tu sueldo.
        </p>
      </GuideSection>

      <GuideSection title="No olvides los otros costos">
        <p>Antes de calcular, suma todo lo que te cuesta vender ese producto, no solo lo que pagas al proveedor:</p>
        <ul>
          <li>Bolsas, envases o etiquetas.</li>
          <li>Flete o el pasaje para ir a buscar la mercadería.</li>
          <li>La comisión de la máquina de tarjetas.</li>
        </ul>
        <p>
          Ejemplo: un producto de $2.500 más $300 en envase y comisión cuesta $2.800. Para ganar el 40%: $2.800 ÷ 0,6 ={" "}
          <strong>$4.667</strong>.
        </p>
      </GuideSection>

      <GuideSection title="¿Qué margen debería usar?">
        <p>
          Depende del rubro y de cuánto se vende. Los productos que se venden mucho (como bebidas o pan) suelen tener
          márgenes más bajos, y los que se venden poco o son más especiales, márgenes más altos. Lo importante es que,
          al sumar todas tus ventas del mes, el margen alcance para pagar tus gastos fijos y te deje ganancia. Para eso
          sirve la{" "}
          <Link href="/calculadoras/punto-de-equilibrio" className="text-primary underline-offset-4 hover:underline">
            calculadora de punto de equilibrio
          </Link>
          .
        </p>
      </GuideSection>
    </CalculatorPage>
  )
}
