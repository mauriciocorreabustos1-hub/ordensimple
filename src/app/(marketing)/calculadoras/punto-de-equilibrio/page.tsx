import type { Metadata } from "next"
import { BreakEvenCalculator } from "@/components/tools/break-even-calculator"
import { CalculatorPage, Formula, GuideSection } from "@/components/landing/calculator-page"

export const metadata: Metadata = {
  title: "Calculadora de punto de equilibrio",
  description:
    "Calcula gratis cuánto tienes que vender al mes y al día para no perder plata. Fórmula del punto de equilibrio explicada con ejemplos.",
  alternates: { canonical: "/calculadoras/punto-de-equilibrio" },
}

export default function BreakEvenCalculatorPage() {
  return (
    <CalculatorPage
      current="/calculadoras/punto-de-equilibrio"
      title="Calculadora de punto de equilibrio"
      description="Descubre cuántas unidades tienes que vender al mes para cubrir todos tus gastos y empezar a ganar."
      calculator={
        <BreakEvenCalculator
          currency="CLP"
          defaults={{
            fixedCosts: 600_000,
            unitCost: 1_000,
            price: 1_500,
            fromData: false,
          }}
        />
      }
    >
      <GuideSection title="¿Qué es el punto de equilibrio?">
        <p>
          Es la cantidad que necesitas vender para que tus ventas paguen justo todos tus gastos: ni ganas ni pierdes.
          Todo lo que vendas por encima de ese punto es ganancia.
        </p>
      </GuideSection>

      <GuideSection title="¿Cómo se calcula?">
        <p>
          Primero ve cuánto te deja cada producto que vendes (precio menos costo). Después divide tus gastos fijos del
          mes por esa cantidad:
        </p>
        <Formula>Unidades para no perder = Gastos fijos ÷ (Precio − Costo)</Formula>
        <p>
          Ejemplo: tienes <strong>$600.000</strong> de gastos fijos al mes (arriendo, luz, sueldos). Vendes un producto
          a $1.500 que te cuesta $1.000, así que cada venta te deja <strong>$500</strong>.
        </p>
        <Formula>$600.000 ÷ $500 = 1.200 unidades al mes</Formula>
        <p>
          Eso son ventas por $1.800.000 al mes, o unas <strong>40 unidades al día</strong> si abres los 30 días, solo
          para no perder.
        </p>
      </GuideSection>

      <GuideSection title="¿Qué son los gastos fijos?">
        <p>Son los que pagas aunque no vendas nada:</p>
        <ul>
          <li>Arriendo del local.</li>
          <li>Luz, agua, gas e internet.</li>
          <li>Sueldos (incluido el tuyo).</li>
          <li>Contador, patente y otros pagos mensuales.</li>
        </ul>
        <p>La mercadería que compras para vender no va aquí: ya está en el costo de cada producto.</p>
      </GuideSection>

      <GuideSection title="¿Y si vendo muchos productos distintos?">
        <p>
          En un almacén nadie vende un solo producto. En ese caso usa el precio y costo promedio, o piensa en tu margen
          promedio: si de cada $1.000 que vendes te quedan $300, necesitas vender $600.000 ÷ 0,3 ={" "}
          <strong>$2.000.000</strong> al mes para cubrir $600.000 de gastos fijos. En OrdenSimple este cálculo se hace
          solo con tus ventas y productos reales.
        </p>
      </GuideSection>
    </CalculatorPage>
  )
}
