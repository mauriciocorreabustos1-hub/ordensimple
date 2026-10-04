import type { Instrumentation } from "next"

// Errores del servidor: se guardan para verlos en /admin y se avisa por correo (ver src/server/error-log.ts).
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  // El registro usa la base de datos, disponible solo en el entorno Node.js.
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const { recordError } = await import("@/server/error-log")
  const error = err as { message?: string; digest?: string; stack?: string }
  const userAgent = request.headers["user-agent"]
  await recordError({
    source: "servidor",
    message: `${error.message ?? String(err)} [${context.routeType} ${context.routePath}]`,
    digest: error.digest,
    path: request.path,
    method: request.method,
    stack: error.stack,
    userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
  })
}
