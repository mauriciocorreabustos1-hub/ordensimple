import type { Metadata } from "next"
import { Formula, GuideSection } from "@/components/landing/calculator-page"
import { GuidePage } from "@/components/landing/guide-page"
import { SignupLink } from "@/components/landing/signup-link"

const HREF = "/guias/como-llevar-el-fiado"

export const metadata: Metadata = {
  title: "Cómo llevar el fiado de tu almacén sin perder plata",
  description:
    "Guía práctica para fiar con orden: qué anotar, reglas para no perder plata, cómo cobrar sin discusiones y cómo dejar el cuaderno atrás.",
  alternates: { canonical: HREF },
}

export default function FiadoGuidePage() {
  return (
    <GuidePage
      href={HREF}
      title="Cómo llevar el fiado de tu almacén sin perder plata"
      description="Fiar es parte del negocio de barrio. El problema no es fiar: es no saber cuánto te deben. Aquí tienes reglas simples para hacerlo con orden."
      updated="4 de octubre de 2026"
      readingMinutes={5}
    >
      <GuideSection title="¿Por qué se pierde plata con el fiado?">
        <p>Casi nunca es porque el cliente no quiera pagar. La plata se pierde por desorden:</p>
        <ul>
          <li>Se anota tarde, “cuando haya un rato”, y algunas ventas se olvidan.</li>
          <li>El cuaderno se moja, se pierde una hoja o nadie entiende la letra.</li>
          <li>Los abonos no se anotan y después no calza lo que el cliente dice con lo que dice el cuaderno.</li>
          <li>No hay un límite, y la deuda crece hasta que es difícil de pagar.</li>
        </ul>
      </GuideSection>

      <GuideSection title="Qué anotar cada vez que fías">
        <p>Para que no haya dudas después, cada fiado tiene que tener cuatro datos:</p>
        <ul>
          <li><strong>Quién:</strong> el nombre del cliente, siempre escrito igual (“Juan Pérez”, no a veces “Juan” y a veces “don Juan”).</li>
          <li><strong>Cuánto:</strong> el monto total de lo que se llevó.</li>
          <li><strong>Cuándo:</strong> la fecha.</li>
          <li><strong>Qué</strong> (opcional): lo que se llevó, por si hay dudas.</li>
        </ul>
        <p>Y cuando te paga, anota el <strong>abono</strong> con su fecha. La cuenta del cliente es simple:</p>
        <Formula>Lo que te debe = Todo lo fiado − Todos los abonos</Formula>
        <p>
          Ejemplo: a Juan le fiaste $12.000 el lunes y $8.000 el miércoles ($20.000 en total). El viernes te abona
          $5.000. Te debe <strong>$15.000</strong>.
        </p>
      </GuideSection>

      <GuideSection title="5 reglas para fiar sin problemas">
        <ul>
          <li><strong>Anota al momento.</strong> Antes de que el cliente salga del local. Lo que se deja para después, se olvida.</li>
          <li><strong>Pon un límite por cliente.</strong> Por ejemplo, $30.000. Si llega al límite, primero un abono y después más fiado.</li>
          <li><strong>Cobra en un día fijo.</strong> Por ejemplo, el viernes o el día de pago. Tus clientes se acostumbran y tú no persigues a nadie.</li>
          <li><strong>Anota cada abono.</strong> Aunque sea poco. Así siempre saben los dos cuánto queda.</li>
          <li><strong>Revisa el total una vez por semana.</strong> Lo que te deben es plata tuya que no está en la caja: no debería crecer sin control.</li>
        </ul>
      </GuideSection>

      <GuideSection title="Cómo cobrar sin pelear">
        <p>
          Lo que más evita discusiones es tener el detalle a mano: qué día se fió, cuánto y qué abonos hizo. Con eso no es
          tu palabra contra la del cliente. Un mensaje amable por WhatsApp también ayuda:
        </p>
        <Formula>“Hola Juan, te escribo de Almacén Don Pedro. Te recuerdo que tienes $15.000 pendientes. ¡Que tengas buen día!”</Formula>
      </GuideSection>

      <GuideSection title="Del cuaderno al celular">
        <p>
          En <SignupLink className="text-primary underline-offset-4 hover:underline">OrdenSimple</SignupLink> el fiado
          es una forma de pago más:
        </p>
        <ul>
          <li>Registras la venta, eliges “Fiado” y escribes el nombre del cliente.</li>
          <li>En Clientes ves cuánto te debe cada uno y cuánto te deben en total.</li>
          <li>Cuando te pagan, tocas “Registrar abono”: puede ser todo o una parte.</li>
          <li>Cada cliente tiene su historial con lo fiado y lo abonado, con fechas.</li>
        </ul>
        <p>No se moja, no se pierde y siempre suma bien.</p>
      </GuideSection>
    </GuidePage>
  )
}
