import type { Metadata } from "next"
import Link from "next/link"
import { LegalPage, LegalSection } from "@/components/landing/legal"

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Cómo OrdenSimple recopila, usa y protege tus datos personales.",
  alternates: { canonical: "/privacidad" },
}

const CONTACT = "contacto@ordensimple.cl"

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Política de privacidad"
      updated="21 de octubre de 2026"
      intro={
        <p>
          Esta política explica qué datos personales recopila OrdenSimple, para qué los usa, con quién los comparte y cómo
          puedes ejercer tus derechos, de acuerdo con la Ley N° 19.628 sobre Protección de la Vida Privada y la Ley N°
          21.719, que la moderniza. Complementa nuestros{" "}
          <Link href="/terminos" className="text-primary underline-offset-4 hover:underline">
            Términos y condiciones
          </Link>
          .
        </p>
      }
    >
      <LegalSection n={1} title="Quién es responsable de tus datos">
        <p>
          El responsable del tratamiento de los datos de tu cuenta es OrdenSimple. Puedes contactarnos para cualquier tema de
          privacidad en{" "}
          <a href={`mailto:${CONTACT}`} className="text-primary underline-offset-4 hover:underline">
            {CONTACT}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection n={2} title="Qué datos recopilamos">
        <ul>
          <li>
            <strong>Datos de tu cuenta:</strong> nombre, correo electrónico y contraseña. La contraseña se guarda cifrada;
            nadie, ni siquiera nosotros, puede verla.
          </li>
          <li>
            <strong>Datos de tu negocio:</strong> nombre, rubro, país, moneda y la información que registras (ventas, gastos,
            productos, inventario, metas y cierres de caja).
          </li>
          <li>
            <strong>Datos de tus clientes y proveedores</strong> que decidas registrar (nombre, teléfono, correo, notas,
            compras y deudas). Respecto de estos datos, tú eres el responsable y OrdenSimple actúa como encargado del
            tratamiento: solo los usamos para prestarte el servicio.
          </li>
          <li>
            <strong>Pedidos en tiendas online:</strong> si haces un pedido en la tienda de un negocio que usa OrdenSimple,
            guardamos tu nombre, el teléfono y la dirección o comentario que escribas y lo que pediste, para que ese negocio
            lo atienda. El responsable de esos datos es el negocio; OrdenSimple solo los guarda por encargo suyo.
          </li>
          <li>
            <strong>Avisos en el celular:</strong> si los activas, guardamos la dirección que nos da tu navegador para mandarte
            avisos (por ejemplo, un pedido nuevo). Puedes apagarlos cuando quieras en Configuración o en los permisos del navegador.
          </li>
          <li>
            <strong>Datos técnicos:</strong> dirección IP, tipo de navegador y registros de acceso, que usamos para mantener
            tu sesión, proteger tu cuenta (por ejemplo, limitar intentos fallidos de inicio de sesión) y detectar errores.
          </li>
          <li>
            <strong>Cómo nos conociste:</strong> al crear tu cuenta guardamos de qué anuncio o página llegaste y, si fue así,
            quién te invitó. Lo usamos solo para saber qué medios nos funcionan y entregar los premios de «Invita y gana» (ver{" "}
            <a href="#cookies" className="text-primary underline-offset-4 hover:underline">
              Cookies
            </a>
            ).
          </li>
          <li>
            <strong>Estadísticas de visitas:</strong> medimos de forma agregada qué páginas se visitan, desde qué país y tipo
            de dispositivo, sin usar cookies de seguimiento ni identificarte personalmente.
          </li>
        </ul>
      </LegalSection>

      <LegalSection n={3} title="Para qué usamos tus datos">
        <ul>
          <li>Crear y administrar tu cuenta, y prestarte el servicio (base legal: ejecución del contrato).</li>
          <li>Enviarte correos necesarios, como la recuperación de contraseña o avisos importantes del servicio.</li>
          <li>Mantener la seguridad, prevenir abusos y corregir errores (base legal: interés legítimo).</li>
          <li>
            Enviarte novedades y ofertas de OrdenSimple <strong>solo si lo aceptaste</strong> (base legal: consentimiento).
            Puedes dejar de recibirlas cuando quieras desde Configuración o con el enlace incluido en cada correo.
          </li>
        </ul>
        <p>No vendemos tus datos ni los de tu negocio, ni los usamos para publicidad de terceros.</p>
      </LegalSection>

      <LegalSection n={4} title="Con quién compartimos datos">
        <p>Para funcionar, OrdenSimple usa proveedores que tratan datos por nuestra cuenta y bajo nuestras instrucciones:</p>
        <ul>
          <li>
            <strong>Vercel</strong>: alojamiento de la página y estadísticas de visitas.
          </li>
          <li>
            <strong>Neon</strong>: base de datos donde se guarda la información.
          </li>
          <li>
            <strong>Resend</strong>: envío de correos.
          </li>
          <li>
            <strong>Mercado Pago</strong>: cobro de los planes Pro y Empresa. Los datos de tu tarjeta los ingresas
            directamente en Mercado Pago; OrdenSimple no los ve ni los guarda. Solo recibimos el estado de tu suscripción
            (activa, cancelada o pendiente), el monto y el correo de tu cuenta de Mercado Pago.
          </li>
        </ul>
        <p>
          Estos proveedores pueden tener servidores fuera de Chile (por ejemplo, en Estados Unidos o Brasil). Al usarlos,
          exigimos medidas de seguridad adecuadas para proteger tus datos. Solo entregaremos datos a autoridades cuando una
          ley o una orden judicial lo exija.
        </p>
      </LegalSection>

      <LegalSection n={5} title="Cuánto tiempo guardamos los datos">
        <p>
          Guardamos tus datos mientras tengas una cuenta activa. Puedes eliminar tu cuenta tú mismo en Configuración → Tu
          cuenta: se borra al instante junto con tus negocios. Si prefieres pedírnoslo por correo, la borraremos dentro de
          30 días, salvo la información que debamos conservar por obligación legal o para resolver disputas.
        </p>
      </LegalSection>

      <LegalSection n={6} title="Tus derechos">
        <p>Respecto de tus datos personales, tienes derecho a:</p>
        <ul>
          <li>
            <strong>Acceso:</strong> saber qué datos tuyos tenemos.
          </li>
          <li>
            <strong>Rectificación:</strong> corregir datos inexactos o incompletos.
          </li>
          <li>
            <strong>Supresión:</strong> pedir que los eliminemos, o hacerlo tú mismo desde Configuración → Tu cuenta.
          </li>
          <li>
            <strong>Oposición:</strong> oponerte a ciertos usos, como recibir ofertas.
          </li>
          <li>
            <strong>Portabilidad:</strong> recibir tus datos en un formato que puedas usar en otro servicio. Puedes descargarlos
            cuando quieras en Configuración → Tu cuenta → Descargar mis datos.
          </li>
          <li>
            <strong>Bloqueo:</strong> pedir que suspendamos temporalmente su uso mientras se revisa una solicitud.
          </li>
        </ul>
        <p>
          Para ejercerlos, escríbenos a{" "}
          <a href={`mailto:${CONTACT}`} className="text-primary underline-offset-4 hover:underline">
            {CONTACT}
          </a>{" "}
          desde el correo de tu cuenta. Te responderemos dentro de los plazos que establece la ley. Si no quedas conforme,
          puedes recurrir a la autoridad de protección de datos personales.
        </p>
      </LegalSection>

      <LegalSection n={7} title="Seguridad">
        <p>
          Usamos conexiones cifradas (HTTPS), contraseñas cifradas, separación de los datos de cada negocio, límites a los
          intentos de inicio de sesión y respaldos periódicos. Ningún sistema es 100% infalible: si detectamos un incidente
          que afecte tus datos, te avisaremos según lo exige la ley.
        </p>
      </LegalSection>

      <LegalSection n={8} title="Cookies" id="cookies">
        <p>
          Usamos solo cookies propias de OrdenSimple. No usamos cookies de publicidad ni de terceros, y no compartimos esta
          información con nadie. Son estas:
        </p>
        <ul>
          <li>
            <strong>Sesión (necesaria):</strong> mantiene tu sesión iniciada y protege tu cuenta, incluida la verificación en
            dos pasos. Sin ella no podrías usar la app. Dura lo que dure tu sesión.
          </li>
          <li>
            <strong>Cómo nos conociste (os_origen):</strong> la primera vez que entras, guarda de qué anuncio o página llegaste
            (por ejemplo, Instagram o Google). Si creas una cuenta, ese dato se guarda en ella para saber qué medios nos
            funcionan. Dura 60 días.
          </li>
          <li>
            <strong>Invitación de un amigo (os_amigo):</strong> si entras por un enlace de «Invita y gana», guarda el código
            de quien te invitó para darle su premio cuando te registres. Dura 60 días.
          </li>
        </ul>
        <p>
          Además, tu navegador guarda algunas preferencias en tu propio dispositivo (no son cookies y no se envían a nuestros
          servidores): el tema claro u oscuro, el correo para iniciar sesión si eliges recordarlo, los avisos que cerraste,
          las ventas guardadas sin internet y el carro de compras de las tiendas online. Las estadísticas de visitas que usamos no usan cookies.
        </p>
        <p>
          Puedes borrar las cookies desde la configuración de tu navegador cuando quieras. Si borras la de sesión, tendrás que
          volver a iniciar sesión.
        </p>
      </LegalSection>

      <LegalSection n={9} title="Menores de edad">
        <p>OrdenSimple está dirigido a personas mayores de 18 años. No recopilamos datos de menores de forma intencional.</p>
      </LegalSection>

      <LegalSection n={10} title="Cambios a esta política">
        <p>
          Podemos actualizar esta política. Si el cambio es importante, te avisaremos por correo o dentro del servicio antes
          de que entre en vigencia.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
