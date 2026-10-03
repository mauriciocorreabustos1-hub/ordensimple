// URL pública de la app. En Vercel se deduce sola; en otros entornos usa las variables del .env.

function withProtocol(host: string | undefined) {
  return host ? `https://${host}` : undefined
}

export function getAppUrl() {
  return (
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_ENV === "production"
      ? withProtocol(process.env.VERCEL_PROJECT_PRODUCTION_URL)
      : withProtocol(process.env.VERCEL_URL)) ??
    "http://localhost:3000"
  )
}

/** Orígenes desde los que se acepta iniciar sesión (incluye las vistas previas de Vercel). */
export function getTrustedOrigins() {
  return [
    getAppUrl(),
    withProtocol(process.env.VERCEL_URL),
    withProtocol(process.env.VERCEL_BRANCH_URL),
    withProtocol(process.env.VERCEL_PROJECT_PRODUCTION_URL),
  ].filter((o): o is string => Boolean(o))
}
