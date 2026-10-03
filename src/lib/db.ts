import "server-only"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@/generated/prisma/client"

function createClient() {
  // "sslmode=require" ya se trata como verificación completa; se declara explícito para evitar el aviso de pg.
  const connectionString = process.env.DATABASE_URL?.replace("sslmode=require", "sslmode=verify-full")
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createClient>
}

// Reutiliza la conexión durante el hot reload en desarrollo.
export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db
