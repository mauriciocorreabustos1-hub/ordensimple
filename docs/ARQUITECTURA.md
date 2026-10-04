# OrdenSimple — Arquitectura y plan del MVP

Este documento cubre los 10 puntos que pidió el brief original, más los ajustes que hice al plan.

## 0. Cambios respecto al brief original

| Brief original | Decisión | Motivo |
| --- | --- | --- |
| Auth.js | **Better Auth** | Auth.js v5 lleva años en beta y su equipo ahora es parte de Better Auth. Better Auth trae email + contraseña, recuperación de contraseña, rate limiting y adaptador Prisma de fábrica. |
| Montos en cualquier formato | **Enteros en la unidad mínima de la moneda** (`Int`) | CLP no tiene decimales: `$15.000` se guarda como `15000`. USD/EUR se guardarían en centavos. Así no hay errores de punto flotante y agregar monedas es solo configuración (`src/lib/currency.ts`). |
| "Ventas hoy" | **"Hoy" según la zona horaria del negocio** (`America/Santiago` por defecto) | Si el servidor está en UTC, una venta a las 22:00 en Chile caería en "mañana". |
| "Ganancia" | **Ganancia aproximada = ventas − gastos registrados** | Es el cálculo más honesto y fácil de entender. No restamos además el costo de los productos, porque normalmente las compras a proveedores ya se registran como gasto y se contaría dos veces. |
| "¿Cómo va tu negocio?" del mes | **Ventana móvil de 30 días** vs. los 30 anteriores | Con el mes calendario, el arriendo pagado el día 1 deja a todos los negocios en 🔴 los primeros días de cada mes. |
| Todos los gastos iguales | **Categorías de gasto variables** (`isVariable`, por defecto "Proveedores") | En el simulador y las calculadoras, la compra de mercadería es costo de lo vendido, no gasto fijo. Si no, se cuenta dos veces. |
| Entregar archivos por chat | **Archivos escritos directamente en el proyecto** | Trabajo dentro del repo; no hace falta copiar y pegar. |
| Módulos fuera del MVP en el sidebar | **Visibles como "Próximamente"** | El sidebar queda completo sin construir módulos a medias. |

## 1. Arquitectura general

```
Navegador (React 19, mobile-first)
   │  Server Components renderizan los datos
   │  Client Components solo para formularios, gráficos y navegación
   ▼
Next.js 16 (App Router)
   ├─ proxy.ts ............ chequeo optimista de cookie (redirige a /login)
   ├─ Server Actions ...... todas las mutaciones (Zod + autorización por negocio)
   ├─ /api/auth/[...all] .. endpoints de Better Auth
   └─ src/server/* ........ lógica de negocio y consultas (solo servidor)
   ▼
Prisma 7 (driver adapter pg) ──► PostgreSQL
```

Reglas:

- **Toda consulta lleva `businessId`.** El `businessId` nunca viene del cliente: sale de `requireBusiness()`, que valida la sesión y la membresía del usuario.
- **Permisos por rol** en el servidor (`OWNER`, `ADMIN`, `EMPLOYEE`), no solo ocultando botones.
- **Validación doble:** el mismo esquema Zod valida en el formulario y en la Server Action.
- Los secretos solo viven en `.env` y en código de servidor (`import "server-only"`).

## 2. Estructura de carpetas

```
prisma/
  schema.prisma            Modelo de datos
  seed.ts                  Datos de demostración
prisma.config.ts
docs/ARQUITECTURA.md
src/
  proxy.ts                 Protección optimista de rutas
  app/
    (marketing)/           Landing pública (/)
    (auth)/                /login /registro /recuperar-password /restablecer-password
    onboarding/            Asistente inicial
    dashboard/
      layout.tsx           Shell: sidebar (desktop) + bottom nav (móvil)
      page.tsx             Inicio
      ventas/ gastos/ productos/
      herramientas/        precio/ punto-equilibrio/ meta/ simulador/
      configuracion/
      inventario/ clientes/ proveedores/ reportes/   (Próximamente)
    api/auth/[...all]/     Handler de Better Auth
    manifest.ts            Manifest PWA
  components/
    ui/                    shadcn/ui
    app/                   Shell, navegación, tarjetas, inputs de dinero
    dashboard/ sales/ expenses/ products/ tools/ settings/ landing/ auth/
  lib/
    currency.ts            Monedas y formato
    dates.ts               Fechas por zona horaria
    calculations.ts        Fórmulas puras (margen, punto de equilibrio, etc.)
    plans.ts roles.ts constants.ts utils.ts
    validations/           Esquemas Zod compartidos
    auth.ts auth-client.ts db.ts
  server/
    session.ts             requireUser / requireBusiness
    queries/               Lecturas (dashboard, ventas, gastos, productos)
    actions/               Server Actions (mutaciones)
  generated/prisma/        Cliente Prisma generado (no se edita)
```

## 3. Modelo Prisma

Ver `prisma/schema.prisma`. Resumen:

- Auth (Better Auth): `User`, `Session`, `Account`, `Verification`.
- Multi-negocio: `Business` ← `BusinessMember` (rol) → `User`. Un usuario puede tener varios negocios; `User.activeBusinessId` recuerda el último usado.
- Configuración: `BusinessSettings` (1 a 1).
- Catálogo: `Category`, `Product`.
- Movimientos: `Sale` → `SaleItem`, `Expense` → `ExpenseCategory`, `InventoryMovement`.
- Contactos: `Customer`, `Supplier`.
- Otros: `Goal`, `Notification`.

Todas las tablas tienen `id` (cuid), `createdAt`, `updatedAt` e índices por `businessId` (y por fecha en ventas y gastos).

## 4. Diagrama lógico

```
User ─┬─< BusinessMember >─┬─ Business ─┬─ BusinessSettings (1:1)
      ├─< Session          │            ├─< Category ─< Product ─< InventoryMovement
      └─< Account          │            ├─< Product ─< SaleItem
                           │            ├─< Sale ─< SaleItem
                           │            │     └── Customer (opcional)
                           │            ├─< Expense ── ExpenseCategory, Supplier (opcionales)
                           │            ├─< Customer   ├─< Supplier
                           │            ├─< Goal       └─< Notification
```

`SaleItem` guarda copia de la descripción, precio y costo al momento de vender: si después cambias el precio de un producto, el historial no se altera.

## 5. Rutas

| Ruta | Acceso | Contenido |
| --- | --- | --- |
| `/` | Público | Landing |
| `/login` `/registro` `/recuperar-password` `/restablecer-password` | Público (redirige al dashboard si ya hay sesión) | Autenticación |
| `/onboarding` | Sesión | Crear el primer negocio |
| `/dashboard` | Sesión + negocio | Inicio |
| `/dashboard/ventas` `/gastos` | Todos los roles | Registro e historial |
| `/dashboard/productos` | Ver: todos · Editar: OWNER/ADMIN | Catálogo |
| `/dashboard/herramientas/*` | Todos los roles | Calculadoras (no modifican datos) |
| `/dashboard/configuracion` | OWNER/ADMIN | Ajustes |
| `/api/auth/*` | — | Better Auth |

## 6. Componentes reutilizables

- `AppSidebar`, `MobileNav`, `QuickActionSheet`: navegación.
- `PageHeader`: título + descripción + acciones.
- `StatCard`: métrica con explicación en lenguaje simple.
- `MoneyInput`: escribe `25000` y muestra `25.000` según la moneda.
- `Explainer`: bloque "¿Qué significa esto?".
- `EmptyState`, `ComingSoon`, `DateRangeFilter`, `ConfirmDelete`.
- `SaleForm`, `QuickSaleForm`, `ExpenseForm`, `ProductForm`.
- `SalesExpensesChart` (Recharts).

## 7. Flujo de autenticación

1. `/registro` → `authClient.signUp.email` (nombre, correo, contraseña ≥ 8) → sesión creada → `/onboarding`.
2. `/onboarding` → Server Action crea `Business` + `BusinessMember (OWNER)` + `BusinessSettings` + categorías de gasto iniciales → `/dashboard`.
3. `/login` → `authClient.signIn.email` → `/dashboard` (o `/onboarding` si aún no tiene negocio).
4. `/recuperar-password` → `requestPasswordReset` → correo con enlace (en desarrollo, el enlace se imprime en la consola del servidor; con `RESEND_API_KEY` se envía de verdad) → `/restablecer-password?token=…`.
5. `proxy.ts` hace una revisión rápida de la cookie; la verificación real ocurre en el servidor en cada página y acción (`requireUser` / `requireBusiness`).

## 8. Diseño del dashboard

Móvil (de arriba a abajo):

1. Saludo + estado del negocio en los últimos 30 días (🟢 / 🟡 / 🔴 con explicación).
2. Dos botones grandes: **Registrar venta** · **Registrar gasto**.
3. Hoy: ventas, gastos, ganancia aproximada.
4. Este mes: ventas, gastos, ganancia + comparación con el mismo período del mes anterior.
5. Gráfico de los últimos 7 días (ventas vs gastos).
6. Gráfico de los últimos 6 meses.
7. Esta semana vs semana pasada.

En computador se reorganiza en una grilla de 3 columnas. Con **Modo Fácil** activo solo se muestran los puntos 1 a 3.

## 9. MVP exacto

Incluido: landing, registro, login, recuperación de contraseña, onboarding, dashboard, ventas (detallada y rápida), gastos, productos, las 4 herramientas, configuración (negocio, moneda, país, categorías, Modo Fácil, tema, usuarios en modo lectura) y la base de PWA (manifest + íconos).

Fase Pro (ya construida): inventario (movimientos, alertas, más vendidos, dinero inmovilizado), clientes (ficha, frecuentes, nuevos, top, historial), proveedores (ficha, total comprado, comparador), reportes (período vs. período anterior, rankings, exportación CSV para Excel) y consejos automáticos calculados con datos reales.

Mientras no existan los cobros, las funciones Pro están abiertas para todos. Para exigir el plan basta con definir `ENFORCE_PLANS=true` (ver `src/lib/plans.ts`, función `canUseFeature`).

Pendiente: cobros (Mercado Pago o Flow) y códigos de descuento, invitar usuarios, sucursales, reportes en PDF y service worker.

## 10. Orden de implementación

1. ✅ Base del proyecto (Next, Tailwind, shadcn, tema, utilidades de moneda y fechas).
2. ✅ Base de datos (schema, cliente, seed).
3. ✅ Autenticación (Better Auth, páginas, proxy, helpers de sesión).
4. ✅ Onboarding.
5. ✅ Shell del dashboard + inicio.
6. ✅ Ventas → Gastos → Productos.
7. ✅ Herramientas.
8. ✅ Configuración.
9. ✅ Landing.
10. ✅ Inventario, clientes, proveedores, reportes y consejos automáticos.
11. Siguiente fase: cobros, descuentos y correos masivos.
