import "server-only"
import { z } from "zod"
import { PermissionError } from "@/server/session"

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[] | undefined> }

export function validationError(error: z.ZodError): ActionResult<never> {
  return {
    ok: false,
    message: "Revisa los datos marcados.",
    fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[] | undefined>,
  }
}

/** Convierte errores inesperados en un mensaje simple sin filtrar detalles internos. */
export function toActionError(error: unknown): ActionResult<never> {
  if (error instanceof PermissionError) return { ok: false, message: error.message }
  console.error(error)
  return { ok: false, message: "Algo salió mal. Inténtalo de nuevo en unos segundos." }
}
