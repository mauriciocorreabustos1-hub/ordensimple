import "server-only"
import { db } from "@/lib/db"
import { getAppUrl } from "@/lib/app-url"
import { sendEmail } from "@/lib/email"

export type ErrorReport = {
  source: "servidor" | "navegador"
  message: string
  digest?: string
  path?: string
  method?: string
  stack?: string
  userAgent?: string
}

const cut = (value: string | undefined, max: number) => (value ? value.slice(0, max) : undefined)

/** Quita parámetros de la URL (pueden traer enlaces de recuperación u otros datos sensibles). */
function cleanPath(path: string | undefined) {
  if (!path) return undefined
  try {
    return new URL(path, "http://x").pathname
  } catch {
    return path.split("?")[0]
  }
}

/**
 * Guarda un error para verlo en /admin y avisa por correo al primer error de cada hora.
 * Nunca lanza excepciones: si algo falla aquí, se ignora para no empeorar el problema original.
 */
export async function recordError(report: ErrorReport) {
  try {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const recent = await db.errorLog.count({ where: { createdAt: { gte: hourAgo } } })
    // Protección contra avalanchas de errores (o envíos maliciosos desde el navegador).
    if (recent >= 300) return

    await db.errorLog.create({
      data: {
        source: report.source,
        message: cut(report.message, 1000) ?? "Error sin mensaje",
        digest: cut(report.digest, 100),
        path: cut(cleanPath(report.path), 300),
        method: cut(report.method, 10),
        stack: cut(report.stack, 4000),
        userAgent: cut(report.userAgent, 300),
      },
    })

    if (recent === 0) await alertAdmins(report)
  } catch (error) {
    console.error("[error-log] No se pudo registrar el error:", error)
  }
}

async function alertAdmins(report: ErrorReport) {
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean)
  if (!admins.length || process.env.NODE_ENV !== "production") return
  const url = `${getAppUrl()}/admin#errores`
  await Promise.all(
    admins.map((to) =>
      sendEmail({
        to,
        subject: "⚠️ OrdenSimple: se registró un error",
        text: [
          "Se registró un error en OrdenSimple.",
          "",
          `Dónde: ${cleanPath(report.path) ?? "desconocido"} (${report.source})`,
          `Mensaje: ${cut(report.message, 300)}`,
          "",
          `Revisa el detalle en: ${url}`,
          "",
          "Solo te avisamos el primer error de cada hora para no llenar tu bandeja.",
        ].join("\n"),
      }),
    ),
  )
}
