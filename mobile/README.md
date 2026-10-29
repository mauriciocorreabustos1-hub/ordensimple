# App de OrdenSimple para iPhone y Android

La app abre www.ordensimple.cl dentro de una app nativa (Capacitor). Todo lo que se publica en la web aparece al
tiro en la app, sin volver a enviarla a revisión. Lo propio de la app:

- **Impresión por Bluetooth** en impresoras térmicas, también en iPhone (Safari no puede).
- **Sin contratar planes en el iPhone:** Apple exige su sistema de pago para las suscripciones, así que en la app de
  iPhone no aparecen el pago del plan ni el canje de códigos. El plan se contrata en la web.
- Íconos, pantalla de inicio y permisos (Bluetooth, cámara y fotos) con textos en español.

Datos de la app: nombre **OrdenSimple**, identificador **cl.ordensimple.app**, versión 1.0.

---

## Lo que tienes que hacer tú (una sola vez)

### 1. Cuenta de desarrollador de Apple (USD 99 al año)

1. Entra a developer.apple.com/programs/enroll con tu Apple ID (con verificación en dos pasos activada).
2. Elige **Persona** (a tu nombre) u **Organización** (a nombre de la empresa; pide el número D-U-N-S, que es
   gratis y demora unos días).
3. Paga y espera la aprobación (de horas a un par de días).

### 2. Crear la app en App Store Connect

1. Entra a appstoreconnect.apple.com, sección Apps, botón “+”, **Nueva app**.
2. Plataforma iOS, nombre **OrdenSimple**, idioma principal **Español (México)** o el que prefieras, identificador
   **cl.ordensimple.app** (si no aparece, créalo antes en developer.apple.com, sección Identifiers), SKU
   `ordensimple`.
3. Anota el **Apple ID** numérico de la app (sección Información de la app).

### 3. Llave para que Codemagic suba la app

1. En App Store Connect, sección Usuarios y acceso, pestaña Integraciones, **App Store Connect API**.
2. Genera una llave con acceso **App Manager** y descarga el archivo .p8 (solo se descarga una vez).
3. Anota el **Issuer ID** y el **Key ID**.

### 4. Codemagic (compila la app en un Mac en la nube)

1. Crea una cuenta en codemagic.io (hay un plan gratis con minutos al mes) y conecta el repositorio de GitHub.
2. En Teams, sección Integrations, **Developer Portal**: agrega la llave del paso 3 con el nombre exacto
   **OrdenSimple App Store Connect**.
3. En la sección Code signing identities: deja que Codemagic genere el certificado de distribución de iOS y el
   perfil App Store para `cl.ordensimple.app`.
4. En la app de Codemagic, sección Environment variables, agrega `APP_STORE_APP_ID` con el Apple ID numérico del
   paso 2.3.
5. Inicia el flujo **iPhone (App Store)**. Al terminar, la app aparece en TestFlight para probarla en tu iPhone.

### 5. Enviar a revisión

En App Store Connect completa la ficha (las capturas y los textos los preparo yo), las etiquetas de privacidad y
una **cuenta de prueba** para el revisor de Apple; luego elige la compilación de TestFlight y envíala a revisión.

---

## Android (Google Play, pago único de USD 25)

1. Crea la cuenta en play.google.com/console.
2. En Codemagic, sección Code signing identities, Android keystores: genera o sube una llave con el nombre
   **ordensimple_keystore**. Guarda una copia: sin ella no se pueden publicar actualizaciones.
3. Inicia el flujo **Android (Google Play)** y sube el archivo .aab a Google Play Console.

---

## Para quien programa

```bash
cd mobile
npm ci
npx cap sync          # después de cambiar capacitor.config.json o los plugins
npm run assets        # regenera íconos y pantallas desde mobile/assets
```

- La web sabe que está dentro de la app por `OrdenSimpleApp` en el user agent (`src/lib/native-app.ts`).
- La impresión nativa usa el plugin `@capacitor-community/bluetooth-le` (`src/lib/bluetooth-print.ts`). En iPhone
  solo funcionan impresoras **Bluetooth LE (BLE)**; las que son solo Bluetooth clásico no se pueden usar desde
  apps de iPhone.
- La compilación está en `codemagic.yaml`, en la raíz del repositorio.
