import type { Metadata } from "next"
import { Formula, GuideSection } from "@/components/landing/calculator-page"
import { GuidePage } from "@/components/landing/guide-page"
import { SignupLink } from "@/components/landing/signup-link"

const HREF = "/guias/como-hacer-el-cierre-de-caja"

export const metadata: Metadata = {
  title: "Cómo hacer el cierre de caja paso a paso",
  description:
    "Aprende a cuadrar la caja al final del día: la fórmula, un ejemplo con números y qué hacer si falta o sobra dinero.",
  alternates: { canonical: HREF },
}

export default function CashGuidePage() {
  return (
    <GuidePage
      href={HREF}
      title="Cómo hacer el cierre de caja paso a paso"
      description="Cuadrar la caja te toma un par de minutos y te dice algo muy importante: si el dinero que hay es el que debería haber."
      updated="4 de octubre de 2026"
      readingMinutes={4}
    >
      <GuideSection title="¿Qué es el cierre de caja?">
        <p>
          Es comparar, al final del día, el efectivo que <strong>debería haber</strong> en la caja con el que{" "}
          <strong>realmente hay</strong> cuando lo cuentas. Si calza, todo bien. Si no, te enteras el mismo día y no a fin
          de mes.
        </p>
        <p>
          Ojo: el cierre de caja es solo del <strong>efectivo</strong>. Lo que te pagaron con débito, crédito o
          transferencia no está en la caja, aunque también es parte de lo que vendiste.
        </p>
      </GuideSection>

      <GuideSection title="La cuenta">
        <Formula>Debería haber = Efectivo inicial + Ventas en efectivo + Abonos en efectivo − Gastos pagados con la caja</Formula>
        <ul>
          <li><strong>Efectivo inicial:</strong> el sencillo con que abriste (el “fondo de caja”).</li>
          <li><strong>Ventas en efectivo:</strong> solo las que te pagaron en billetes y monedas.</li>
          <li><strong>Abonos en efectivo:</strong> lo que te pagaron clientes que te debían (fiado).</li>
          <li><strong>Gastos pagados con la caja:</strong> por ejemplo, si le pagaste al panadero con dinero de la caja.</li>
        </ul>
      </GuideSection>

      <GuideSection title="Un ejemplo con números">
        <ul>
          <li>Abriste con $20.000 de sencillo.</li>
          <li>Vendiste $63.390 en efectivo.</li>
          <li>Un cliente te abonó $5.000 del fiado, en efectivo.</li>
          <li>Le pagaste $10.000 al proveedor del pan con dinero de la caja.</li>
        </ul>
        <Formula>$20.000 + $63.390 + $5.000 − $10.000 = $78.390</Formula>
        <p>
          Cuentas los billetes y monedas y hay $77.890. Te <strong>faltan $500</strong>. No es mucho, pero si pasa todos
          los días son $15.000 al mes.
        </p>
      </GuideSection>

      <GuideSection title="Si falta o sobra dinero">
        <p>Antes de preocuparte, revisa lo más común:</p>
        <ul>
          <li>Una venta que se pagó con tarjeta o transferencia y se anotó como efectivo (o al revés).</li>
          <li>Un vuelto mal entregado.</li>
          <li>Un gasto pagado con la caja que no se anotó.</li>
          <li>Dinero que se sacó para la casa sin anotarlo.</li>
          <li>Una venta que no se registró (en ese caso, sobra dinero).</li>
        </ul>
        <p>Si las diferencias se repiten, haz el cierre todos los días a la misma hora: así es más fácil encontrar el error.</p>
      </GuideSection>

      <GuideSection title="Hazlo en un minuto">
        <p>
          En <SignupLink className="text-primary underline-offset-4 hover:underline">OrdenSimple</SignupLink> el cierre
          de caja ya tiene la cuenta hecha: te muestra cuánto vendiste con cada medio de pago y cuánto debería haber.
          Solo escribes cuánto contaste y te dice si falta o sobra. Además, puedes compartir el cierre por WhatsApp y ver los
          cierres de días anteriores.
        </p>
      </GuideSection>
    </GuidePage>
  )
}
