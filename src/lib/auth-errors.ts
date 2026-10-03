// Traduce los códigos de error de Better Auth a mensajes simples.
const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "El correo o la contraseña no son correctos.",
  USER_ALREADY_EXISTS: "Ya existe una cuenta con ese correo. Prueba iniciar sesión.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Ya existe una cuenta con ese correo. Prueba iniciar sesión.",
  PASSWORD_TOO_SHORT: "La contraseña es muy corta. Usa al menos 8 caracteres.",
  PASSWORD_TOO_LONG: "La contraseña es demasiado larga.",
  INVALID_EMAIL: "El correo no es válido.",
  INVALID_TOKEN: "El enlace no es válido o ya expiró. Pide uno nuevo.",
  TOO_MANY_REQUESTS: "Demasiados intentos. Espera un minuto y vuelve a intentarlo.",
}

export function authErrorMessage(error: { code?: string; message?: string; status?: number } | null | undefined) {
  if (!error) return "Algo salió mal. Inténtalo de nuevo."
  if (error.status === 429) return MESSAGES.TOO_MANY_REQUESTS
  if (error.code && MESSAGES[error.code]) return MESSAGES[error.code]
  return "Algo salió mal. Inténtalo de nuevo."
}

/** Solo permite redirigir a rutas internas. */
export function safeNext(next: string | null | undefined, fallback = "/dashboard") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback
  return next
}
