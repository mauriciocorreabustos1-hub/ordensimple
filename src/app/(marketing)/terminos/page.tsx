import type { Metadata } from "next"
import Link from "next/link"
import { BILLING_ENABLED } from "@/lib/plans"
import { LegalPage, LegalSection } from "@/components/landing/legal"

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description: "Condiciones de uso de OrdenSimple.",
  alternates: { canonical: "/terminos" },
}

const CONTACT = "contacto@ordensimple.cl"

export default function TermsPage() {
  return (
    <LegalPage
      title="Términos y condiciones"
      updated="4 de octubre de 2026"
      intro={
        <p>
          Estos términos regulan el uso de OrdenSimple, disponible en ordensimple.cl. Al crear una cuenta o usar el servicio,
          aceptas estos términos y nuestra{" "}
          <Link href="/privacidad" className="text-primary underline-offset-4 hover:underline">
            Política de privacidad
          </Link>
          . Si no estás de acuerdo, no uses el servicio.
        </p>
      }
    >
      <LegalSection n={1} title="Qué es OrdenSimple">
        <p>
          OrdenSimple es una herramienta en línea para que emprendedores y pequeñas empresas registren sus ventas, gastos,
          productos, inventario, clientes y proveedores, y obtengan resúmenes, cálculos y consejos sobre su negocio.
        </p>
      </LegalSection>

      <LegalSection n={2} title="Tu cuenta">
        <ul>
          <li>Debes ser mayor de 18 años o contar con autorización de tu representante legal.</li>
          <li>La información que entregues al registrarte debe ser verdadera y estar actualizada.</li>
          <li>
            Eres responsable de mantener tu contraseña en secreto y de todo lo que se haga desde tu cuenta. Si crees que
            alguien entró sin permiso, escríbenos de inmediato a {CONTACT}.
          </li>
          <li>Puedes dar acceso a otras personas de tu negocio; eres responsable de los permisos que les asignes.</li>
        </ul>
      </LegalSection>

      <LegalSection n={3} title="Planes y precios">
        <ul>
          <li>El plan Gratis no tiene costo ni requiere tarjeta.</li>
          {BILLING_ENABLED ? (
            <li>
              Los planes Pro ($6.990 al mes) y Empresa ($14.990 al mes) se pagan con Mercado Pago y se renuevan
              automáticamente cada mes. Puedes cancelar en cualquier momento desde Configuración: no se te vuelve a cobrar
              y el plan sigue vigente hasta el final del período pagado. Si dejas de pagar o vence un acceso de regalo,
              vuelves al plan Gratis sin perder tus datos.
            </li>
          ) : (
            <li>
              Durante el período de lanzamiento, algunas funciones del plan Pro están disponibles para todos sin costo.
              Antes de empezar a cobrar por ellas te avisaremos con al menos 5 días de anticipación, y podrás decidir si
              contratas un plan pagado o sigues en el plan Gratis.
            </li>
          )}
          <li>
            Cuando existan planes pagados, sus precios, forma de pago, renovación y condiciones de término se informarán
            claramente antes de contratarlos, conforme a la Ley N° 19.496 sobre Protección de los Derechos de los
            Consumidores.
          </li>
        </ul>
      </LegalSection>

      <LegalSection n={4} title="Uso aceptable">
        <p>Te comprometes a no:</p>
        <ul>
          <li>Usar el servicio para actividades ilegales o para registrar información obtenida de forma ilícita.</li>
          <li>Intentar acceder a cuentas o datos de otros negocios, o vulnerar la seguridad del servicio.</li>
          <li>Sobrecargar el servicio de forma intencional, copiarlo, revenderlo o usarlo para crear un producto competidor.</li>
        </ul>
        <p>Podemos suspender cuentas que incumplan estos puntos, avisándote cuando sea posible.</p>
      </LegalSection>

      <LegalSection n={5} title="Tus datos y los de tu negocio">
        <ul>
          <li>
            La información que registras (ventas, gastos, productos, clientes, proveedores) es tuya. No la vendemos ni la
            usamos para fines distintos a prestarte el servicio.
          </li>
          <li>
            Si registras datos personales de tus clientes o proveedores (por ejemplo, nombre, teléfono o correo), tú eres
            responsable de contar con una base legal para hacerlo, y OrdenSimple actúa como encargado del tratamiento de esos
            datos por cuenta tuya.
          </li>
          <li>
            Puedes descargar tus ventas y gastos en cualquier momento desde Reportes. Más detalles en la{" "}
            <Link href="/privacidad" className="text-primary underline-offset-4 hover:underline">
              Política de privacidad
            </Link>
            .
          </li>
        </ul>
      </LegalSection>

      <LegalSection n={6} title="Lo que OrdenSimple no es">
        <ul>
          <li>
            OrdenSimple <strong>no es un servicio de contabilidad ni de asesoría tributaria, financiera o legal</strong>. Los
            cálculos (ganancia aproximada, márgenes, punto de equilibrio, metas, simulaciones y consejos) son estimaciones
            basadas en la información que tú registras, y su objetivo es ayudarte a entender tu negocio.
          </li>
          <li>
            OrdenSimple <strong>no emite boletas ni facturas</strong> y no reemplaza tus obligaciones ante el Servicio de
            Impuestos Internos (SII). Para eso, consulta a un contador.
          </li>
          <li>Las decisiones que tomes con base en la información del servicio son de tu responsabilidad.</li>
        </ul>
      </LegalSection>

      <LegalSection n={7} title="Disponibilidad del servicio">
        <p>
          Trabajamos para que OrdenSimple esté disponible y funcione bien, y respaldamos la información periódicamente. Aun
          así, el servicio puede tener interrupciones por mantención, fallas técnicas o causas fuera de nuestro control. En
          la medida que lo permita la ley, no somos responsables por pérdidas derivadas de esas interrupciones ni por daños
          indirectos.
        </p>
      </LegalSection>

      <LegalSection n={8} title="Término">
        <p>
          Puedes dejar de usar OrdenSimple cuando quieras y pedir que eliminemos tu cuenta escribiendo a {CONTACT}. Al
          eliminarla se borrarán tus datos, salvo los que debamos conservar por obligación legal. Te recomendamos descargar
          antes tus reportes.
        </p>
      </LegalSection>

      <LegalSection n={9} title="Cambios a estos términos">
        <p>
          Podemos actualizar estos términos para reflejar cambios en el servicio o en la ley. Si el cambio es importante, te
          avisaremos por correo o dentro del servicio antes de que entre en vigencia. Seguir usando OrdenSimple después de
          esa fecha significa que aceptas los nuevos términos.
        </p>
      </LegalSection>

      <LegalSection n={10} title="Ley aplicable y contacto">
        <p>
          Estos términos se rigen por las leyes de la República de Chile. Para cualquier consulta o reclamo, escríbenos a{" "}
          <a href={`mailto:${CONTACT}`} className="text-primary underline-offset-4 hover:underline">
            {CONTACT}
          </a>
          . Esto no limita tu derecho a recurrir al Servicio Nacional del Consumidor (SERNAC) o a los tribunales
          competentes.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
