import "server-only"
import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { nextCookies } from "better-auth/next-js"
import { getAppUrl, getTrustedOrigins } from "@/lib/app-url"
import { db } from "@/lib/db"
import { sendEmail } from "@/lib/email"
import { resetPasswordEmail, welcomeEmail } from "@/lib/email-templates"

export const auth = betterAuth({
  appName: "OrdenSimple",
  baseURL: getAppUrl(),
  trustedOrigins: getTrustedOrigins(),
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({ to: user.email, ...resetPasswordEmail({ name: user.name, url }) })
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Correo de bienvenida. Si falla, el registro no se interrumpe.
        after: async (user) => {
          await sendEmail({ to: user.email, ...welcomeEmail({ name: user.name }) }).catch((error) =>
            console.error("[email] No se pudo enviar la bienvenida:", error),
          )
        },
      },
    },
  },
  user: {
    additionalFields: {
      activeBusinessId: { type: "string", required: false, input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  // Límite de intentos guardado en la base de datos: en Vercel hay varias copias del servidor
  // y un contador en memoria no se compartiría entre ellas.
  rateLimit: {
    enabled: process.env.NODE_ENV === "production",
    storage: "database",
    modelName: "rateLimit",
    window: 60,
    max: 60,
    customRules: {
      // Contraseñas: máximo 5 intentos por minuto desde la misma conexión.
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60 * 10, max: 5 },
      // Evita usar "olvidé mi contraseña" para llenar la bandeja de alguien.
      "/request-password-reset": { window: 60 * 15, max: 3 },
      "/reset-password": { window: 60 * 15, max: 5 },
    },
  },
  plugins: [nextCookies()],
})

export type AuthSession = typeof auth.$Infer.Session
