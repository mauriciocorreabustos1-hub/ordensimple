import "server-only"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@/generated/prisma/client"

function createClient() {
  // "sslmode=require" ya se trata como verificación completa; se declara explícito para evitar el aviso de pg.
  const connectionString = process.env.DATABASE_URL?.replace("sslmode=require", "sslmode=verify-full")
  // En desarrollo, la base local (prisma dev) cierra las conexiones inactivas: se sueltan de inmediato para no reusar
  // una cerrada ("Server has closed the connection").
  // En producción (Vercel), la función se congela entre visitas y la base puede cortar las conexiones que quedaron
  // abiertas: al reusarlas fallaba con "Connection terminated unexpectedly". Se sueltan a los 10 s sin uso, se usan
  // pocas por función (para no saturar la base) y se le da más tiempo a conectarse.
  const dev = process.env.NODE_ENV !== "production"
  const pool = dev
    ? { max: 1, idleTimeoutMillis: 1, connectionTimeoutMillis: 0 }
    : { max: 5, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 15_000, keepAlive: true }
  const adapter = new PrismaPg({ connectionString, ...pool })
  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createClient>
}

// Reutiliza la conexión durante el hot reload en desarrollo.
export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db
