# OrdenSimple

Web app SaaS para que emprendedores y pymes administren su negocio sin saber contabilidad: ventas, gastos, productos, ganancias y calculadoras explicadas en lenguaje simple.

La arquitectura, el modelo de datos y el plan del MVP están en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

## Stack

Next.js 16 (App Router, Server Actions) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui · Lucide · Prisma 7 + PostgreSQL · Better Auth · Zod 4 · Recharts 3

## Puesta en marcha (local)

Requisitos: Node 20.9 o superior.

```bash
npm install
cp .env.example .env
```

Base de datos local sin Docker (Postgres embebido de Prisma):

```bash
npm run db:local
```

Copia la URL que muestra en `DATABASE_URL` dentro de `.env`, y genera un secreto para `BETTER_AUTH_SECRET` (cualquier cadena aleatoria de 32 bytes o más):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Aplica las migraciones, carga datos de demostración y arranca:

```bash
npm run db:deploy
npm run db:seed
npm run dev
```

Abre http://localhost:3000. El seed crea una cuenta de demostración con 90 días de ventas y gastos (credenciales en `prisma/seed.ts`).

En desarrollo, sin `RESEND_API_KEY`, los correos de recuperación de contraseña se imprimen en la consola del servidor.

## Scripts

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `start` | Build y servidor de producción |
| `npm run lint` / `typecheck` | ESLint / TypeScript |
| `npm run db:local` | Postgres local con `prisma dev` |
| `npm run db:migrate` | Crea y aplica una migración nueva (desarrollo) |
| `npm run db:deploy` | Aplica migraciones pendientes (producción) |
| `npm run db:seed` | Datos de demostración |
| `npm run db:studio` | Explorador de la base de datos |

## Producción

1. Una base PostgreSQL (Neon, Supabase, Prisma Postgres, Railway…).
2. Variables: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` y `NEXT_PUBLIC_APP_URL` (la URL pública), y `RESEND_API_KEY` + `EMAIL_FROM` para enviar correos.
3. `npm run db:deploy` antes de cada despliegue.

## Convenciones importantes

- **Dinero:** enteros en la unidad mínima de la moneda (`15000` = $15.000 CLP). Formato y parseo en `src/lib/currency.ts`.
- **Fechas:** "hoy" y "este mes" se calculan en la zona horaria del negocio (`src/lib/dates.ts`).
- **Seguridad:** toda página o acción del dashboard parte con `requireBusiness()` (`src/server/session.ts`). El `businessId` nunca viene del cliente y toda consulta lo incluye. Los permisos por rol están en `src/lib/roles.ts`.
- **Validación:** los esquemas Zod de `src/lib/validations` se usan en el formulario y en la Server Action.
- **Gastos variables:** las categorías con `isVariable` (por defecto "Proveedores") se tratan como costo de mercadería en las herramientas, para no contarlas dos veces como gasto fijo.
