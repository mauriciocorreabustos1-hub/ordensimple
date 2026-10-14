import "server-only"
import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { nextCookies } from "better-auth/next-js"
import { twoFactor } from "better-auth/plugins"
import { createAuthEndpoint } from "better-auth/api"
import type { BetterAuthPlugin } from "better-auth"
import { getAppUrl, getTrustedOrigins } from "@/lib/app-url"
import { db } from "@/lib/db"
import { sendEmail } from "@/lib/email"
import { parseOrigin } from "@/lib/signup-source"
import { parseReferralCookie } from "@/lib/referrals"
import { resetPasswordEmail, twoFactorCodeEmail, verifyEmail, welcomeEmail } from "@/lib/email-templates"

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
  // Verificación "suave": se puede usar la app sin confirmar, pero se pide confirmar el correo.
  // Al registrarse, el enlace va dentro del correo de bienvenida (no se gasta un correo aparte).
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24 * 7,
    sendVerificationEmail: async ({ user, url }) => {
      const isNew = Date.now() - new Date(user.createdAt).getTime() < 10 * 60_000
      // Si la cuenta tiene más de 2 días, el correo dice "te falta confirmar" (recordatorio).
      const reminder = !isNew && Date.now() - new Date(user.createdAt).getTime() > 2 * 86_400_000
      await sendEmail({
        to: user.email,
        ...(isNew ? welcomeEmail({ name: user.name, verifyUrl: url }) : verifyEmail({ name: user.name, url, reminder })),
      }).catch((error) => console.error("[email] No se pudo enviar la confirmación:", error))
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Registrarse implica aceptar los términos: se guarda la fecha como respaldo.
        // También se guarda de qué anuncio o página llegó (cookie que deja el script de src/app/layout.tsx).
        before: async (user, context) => {
          const cookie = context?.headers?.get("cookie") ?? context?.request?.headers.get("cookie")
          // Si llegó con un enlace de "Invita a un amigo", se guarda el código (se usa al crear su negocio).
          return { data: { ...user, termsAcceptedAt: new Date(), ...(parseOrigin(cookie) ?? {}), invitedByCode: parseReferralCookie(cookie) } }
        },
      },
    },
  },
  user: {
    // Quien todavía no confirma su correo puede corregirlo (por ejemplo si lo escribió mal al registrarse).
    changeEmail: { enabled: true, updateEmailWithoutVerification: true },
    additionalFields: {
      activeBusinessId: { type: "string", required: false, input: false },
      // Consentimiento para recibir promociones: lo marca la persona al registrarse (desmarcado por defecto).
      marketingOptIn: { type: "boolean", required: false, input: true, defaultValue: false },
      termsAcceptedAt: { type: "date", required: false, input: false },
      // De dónde llegó (los llena el registro desde la cookie de origen; la persona no los puede mandar).
      signupSource: { type: "string", required: false, input: false },
      signupMedium: { type: "string", required: false, input: false },
      signupCampaign: { type: "string", required: false, input: false },
      signupReferrer: { type: "string", required: false, input: false },
      invitedByCode: { type: "string", required: false, input: false },
      // Método del segundo paso que eligió la persona ("email" o "app"); lo guarda la app, no el navegador.
      twoFactorMethod: { type: "string", required: false, input: false },
      // Cuándo vio el tutorial de bienvenida (lo marca la app al cerrarlo).
      welcomeTourAt: { type: "date", required: false, input: false },
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
      // "Reenviar correo de confirmación" y "corregir correo": pocas veces por hora.
      "/send-verification-email": { window: 60 * 60, max: 3 },
      "/change-email": { window: 60 * 60, max: 3 },
    },
  },
  plugins: [
    // Verificación en dos pasos: código por correo o app de códigos (Google Authenticator), más códigos de respaldo.
    twoFactor({
      issuer: "OrdenSimple",
      otpOptions: {
        period: 5,
        storeOTP: "hashed",
        async sendOTP({ user, otp }) {
          // Quien eligió la app de códigos no recibe códigos por correo: así, aunque le roben el correo, no pueden entrar.
          const method = (user as { twoFactorMethod?: string | null }).twoFactorMethod
          if (method === "app") throw new Error("Esta cuenta usa la app de códigos.")
          await sendEmail({ to: user.email, ...twoFactorCodeEmail({ name: user.name, code: otp }) })
        },
      },
      backupCodeOptions: { amount: 8 },
    }),
    twoFactorMethod(),
    nextCookies(),
  ],
})

export type AuthSession = typeof auth.$Infer.Session

/**
 * Durante el segundo paso (antes de tener sesión) dice qué método usa la cuenta, para que /verificar
 * muestre solo ese. Lee la misma cookie firmada que usa la verificación; sin ella no responde nada.
 */
function twoFactorMethod() {
  return {
    id: "dos-pasos-metodo",
    endpoints: {
      twoFactorPendingMethod: createAuthEndpoint("/dos-pasos/metodo", { method: "GET" }, async (ctx) => {
        const cookie = ctx.context.createAuthCookie("two_factor")
        const token = await ctx.getSignedCookie(cookie.name, ctx.context.secret)
        if (!token) return ctx.json({ method: null })
        const pending = await ctx.context.internalAdapter.findVerificationValue(token)
        if (!pending || pending.expiresAt < new Date()) return ctx.json({ method: null })
        const user = await db.user.findUnique({ where: { id: pending.value }, select: { twoFactorMethod: true } })
        return ctx.json({ method: user?.twoFactorMethod === "app" ? "app" : "email" })
      }),
    },
  } satisfies BetterAuthPlugin
}
