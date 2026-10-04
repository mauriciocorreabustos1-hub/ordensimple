import type { Metadata } from "next"
import Link from "next/link"
import { GoalCalculator } from "@/components/tools/goal-calculator"
import { CalculatorPage, Formula, GuideSection } from "@/components/landing/calculator-page"

export const metadata: Metadata = {
  title: "Calculadora de meta de ganancia: ¿cuánto tengo que vender?",
  description:
    "Escribe cuánto quieres ganar al mes y calcula gratis cuánto tienes que vender al mes, a la semana y al día.",
  alternates: { canonical: "/calculadoras/meta-de-ganancia" },
}

export default function GoalCalculatorPage() {
  return (
    <CalculatorPage
      current="/calculadoras/meta-de-ganancia"
      title="¿Cuánto tengo que vender para ganar lo que quiero?"
      description="Escribe tu meta de ganancia del mes y te decimos cuánto vender al mes, a la semana y al día."
      calculator={
        <GoalCalculator
          currency="CLP"
          canSave={false}
          showProgress={false}
          monthSales={0}
          monthLabel=""
          daysInMonth={30}
          dayOfMonth={1}
          defaults={{
            targetProfit: 1_000_000,
            marginPct: 30,
            fixedCosts: 500_000,
            marginFromData: false,
          }}
        />
      }
    >
      <GuideSection title="¿Cómo se calcula?">
        <p>
          Tus ventas tienen que alcanzar para dos cosas: pagar los gastos fijos del mes y dejarte la ganancia que
          quieres. Como de cada venta solo te queda una parte (tu margen), se divide por ese margen:
        </p>
        <Formula>Ventas necesarias = (Ganancia que quieres + Gastos fijos) ÷ Margen</Formula>
        <p>
          Ejemplo: quieres ganar <strong>$1.000.000</strong> al mes, tus gastos fijos son <strong>$500.000</strong> y de
          cada venta te queda el <strong>30%</strong>.
        </p>
        <Formula>($1.000.000 + $500.000) ÷ 0,3 = $5.000.000 al mes</Formula>
        <p>
          Si abres los 30 días, eso son unos <strong>$166.667 diarios</strong>. Una meta del día es mucho más fácil de
          seguir que una del mes.
        </p>
      </GuideSection>

      <GuideSection title="¿Qué es el margen?">
        <p>
          Es la parte de cada venta que te queda después de pagar la mercadería. Si vendes a $1.000 algo que te costó
          $700, te quedan $300: tu margen es del 30%. Si no lo sabes, la{" "}
          <Link href="/calculadoras/precio-de-venta" className="text-primary underline-offset-4 hover:underline">
            calculadora de precio de venta
          </Link>{" "}
          te ayuda a entenderlo.
        </p>
      </GuideSection>

      <GuideSection title="Consejos para llegar a tu meta">
        <ul>
          <li>Anota tus ventas todos los días para saber cuánto te falta.</li>
          <li>Si vas atrasado a mitad de mes, todavía puedes ajustar: ofertas, nuevos productos o más horario.</li>
          <li>Revisa los gastos fijos: bajar $50.000 de gastos es tan bueno como vender bastante más.</li>
        </ul>
      </GuideSection>
    </CalculatorPage>
  )
}
