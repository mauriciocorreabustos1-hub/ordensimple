# Ficha de OrdenSimple en Microsoft Store

Copiar en Partner Center (Apps y juegos, OrdenSimple, envío nuevo). Las capturas están en `capturas/` (1920 x 1080).

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
- **Descripción breve:** Ventas, caja, inventario y fiado de tu negocio, con boletas que salen impresas al instante.
- **Descripción:**

Cobra, imprime y atiende al siguiente. OrdenSimple es la forma simple de llevar las cuentas de tu negocio: cuánto vendiste, cuánto gastaste y cuánto te quedó, sin planillas ni cuadernos.

Con la app para PC, la boleta sale impresa en el mismo segundo en que registras la venta, en tu impresora de siempre: térmica de boletas, USB o de red. La comanda llega impresa a la cocina, con letra grande.

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

Empieza gratis. Usa la misma cuenta en el computador, el celular y la web.

- **Características del producto (una por línea):**
  - Boletas y comandas impresas al instante, sin ventanas de impresión
  - Funciona con impresoras térmicas, USB y de red
  - Ventas, caja, inventario, fiado y reportes
  - Comandas por mesa y pantalla de cocina
  - Se actualiza sola
- **Palabras clave:** ventas, caja, inventario, boletas, pyme, punto de venta, fiado
- **Notas de la versión:** Primera versión de OrdenSimple para PC.

## Opciones de envío (notas para la certificación, en inglés)
OrdenSimple is a business management web app (sales, cash register, inventory) wrapped in a desktop shell that adds direct printing to thermal receipt printers. A free account can be created inside the app (Crear cuenta). Test account: [escribir el correo y la contraseña de una cuenta de prueba aquí, en Partner Center]. Paid plans are sold through the developer's website using its own payment provider, as allowed for non-game apps (policy 10.8.1).

## Paquete
- Archivo: `OrdenSimple-Store.appx` (de GitHub, Actions, "Microsoft Store (MSIX)", Artifacts).
- La app declara la capacidad `runFullTrust` (es una app de escritorio): Partner Center pide justificarla: "Desktop app built with Electron; needs full trust to print to locally installed printers."
