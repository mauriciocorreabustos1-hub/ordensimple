import "server-only"
import { db } from "@/lib/db"

/**
 * Cuántas personas tienen cuenta en OrdenSimple (sin las cuentas de prueba). La portada se regenera cada
 * 10 minutos, así que el número sube solo a medida que la gente se registra. Si la base de datos no
 * responde, devuelve null y la línea no se muestra.
 */
export async function getUserCount() {
  try {
    return await db.user.count({ where: { NOT: { email: { endsWith: ".test" } } } })
  } catch {
    return null
  }
}
