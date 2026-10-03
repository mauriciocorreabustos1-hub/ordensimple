import { NextResponse, type NextRequest } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

// Chequeo optimista: solo mira si existe la cookie de sesión.
// La validación real se hace en el servidor con requireUser() / requireBusiness().
// Las páginas de login/registro redirigen al dashboard desde el servidor, con la sesión ya validada,
// para no crear bucles cuando la cookie existe pero la sesión expiró.
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const { pathname, search } = request.nextUrl
    const url = new URL("/login", request.url)
    url.searchParams.set("next", pathname + search)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding/:path*"],
}
