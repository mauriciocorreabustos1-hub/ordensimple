# Ficha de OrdenSimple en Microsoft Store

Última actualización: envío 4 (22 de noviembre de 2026), solo la ficha y una captura nueva (`07-links.png`), con el mismo paquete de la versión 1.0.0. La app abre www.ordensimple.cl, así que OrdenSimple Links ya está dentro de la app instalada: no hace falta un paquete nuevo.

Copiar en Partner Center (Apps y juegos, OrdenSimple, envío nuevo). Las capturas están en `capturas/` (1920 x 1080); en el envío 4 se suma `07-links.png`.

## Precios y disponibilidad
- **Precio:** Gratis.
- **Mercados:** Chile (y los demás de Latinoamérica si se quiere).
- **Visibilidad:** Pública.

## Propiedades
- **Categoría:** Negocios. Subcategoría: Contabilidad y finanzas (o Administración).
- **Política de privacidad:** https://www.ordensimple.cl/privacidad
- **Sitio web:** https://www.ordensimple.cl
- **Contacto de soporte:** el correo de soporte de OrdenSimple.
- **Requisitos del sistema:** Windows 10 versión 1809 o superior, 64 bits. Internet.

## Clasificación por edades
Cuestionario de IARC: categoría “Productividad / Negocios”; responder “No” a todo (sin violencia, sin chat público, sin compras de contenido digital dentro de la app de parte de Microsoft). Si pregunta por compras: “Sí, la app permite comprar suscripciones a través del sitio web del desarrollador”.

## Ficha (español)
- **Nombre:** OrdenSimple
- **Descripción breve:** Ventas, caja, inventario y fiado de tu negocio, con comprobantes que salen impresos al instante en tu impresora de siempre.
- **Descripción:**

Cobra, imprime y atiende al siguiente. OrdenSimple es la forma simple de llevar las cuentas de tu negocio: cuánto vendiste, cuánto gastaste y cuánto te quedó, sin planillas ni cuadernos.

Con la app para PC, el comprobante sale impreso en el mismo segundo en que registras la venta, en tu impresora de siempre: térmica, USB o de red. La comanda llega impresa a la cocina, con letra grande.

EMPIEZA EN MINUTOS
- Una guía te ayuda a configurar tu negocio y a practicar una venta, sin tocar tus datos reales.
- Carga todo tu catálogo de una vez desde un archivo Excel o CSV.

VENTAS Y CAJA
- Registra cada venta en segundos: efectivo, débito, tarjeta, transferencia o fiado.
- Cierre de caja al final del día, con turnos para cada persona.

INVENTARIO Y PRODUCTOS
- Stock al día, con avisos cuando algo se está acabando o está por vencer.
- Códigos de barra y etiquetas.

CLIENTES Y FIADO
- Quién te debe, cuánto y desde cuándo, con recordatorio por WhatsApp.

PARA TU LOCAL
- Comandas por mesa, pantalla de cocina y cuenta separada por persona.
- Tienda online, agenda, cotizaciones, promociones y tarjetas de fidelidad.

TU PÁGINA DE ENLACES
- OrdenSimple Links: una página con tu WhatsApp, tus redes, tu tienda, tus reservas y tus productos con el precio al día, para poner en Instagram y TikTok.
- Diseños listos para elegir, código QR para tu mostrador y estadísticas de visitas y clics.

Empieza gratis. Usa la misma cuenta en el computador, el celular y la web.

- **Características del producto (una por línea):**
  - Comprobantes y comandas impresos al instante, sin ventanas de impresión
  - Funciona con impresoras térmicas, USB y de red
  - Ventas, caja, inventario, fiado y reportes
  - Importa tus productos desde Excel o CSV
  - Comandas por mesa y pantalla de cocina
  - Tu página de enlaces con QR y estadísticas (OrdenSimple Links)
  - Gratis, con tu misma cuenta, y se actualiza sola
- **Palabras clave:** ventas, caja, inventario, boletas, pyme, punto de venta, fiado (si se puede una más: link en bio)
- **Notas de la versión:** Nuevo: OrdenSimple Links. Arma en minutos una página con tu WhatsApp, tus redes, tu tienda, tus reservas y tus productos, con su propio código QR y estadísticas de visitas y clics. Elige un diseño, publícala y ponla en tu biografía de Instagram o TikTok.
- **Envío 3 (6 de noviembre de 2026):** Ahora puedes importar todos tus productos desde un archivo Excel o CSV. Y si recién empiezas, una guía te ayuda a configurar tu negocio y a practicar una venta.
- **Versión anterior (30 de octubre de 2026):** Primera versión de OrdenSimple para PC.

## Opciones de envío (notas para la certificación, en inglés)
OrdenSimple is a business management web app (sales, cash register, inventory) wrapped in a desktop shell that adds direct printing to thermal receipt printers. A free account can be created inside the app (Crear cuenta). Test account: [escribir el correo y la contraseña de una cuenta de prueba aquí, en Partner Center]. Paid plans are sold through the developer's website using its own payment provider, as allowed for non-game apps (policy 10.8.1).

## Paquete
- Archivo: `OrdenSimple-Store.appx` (de GitHub, Actions, "Microsoft Store (MSIX)", Artifacts).
- La app declara la capacidad `runFullTrust` (es una app de escritorio): Partner Center pide justificarla: "Desktop app built with Electron; needs full trust to print to locally installed printers."
