// Datos de demostración para desarrollo local.
// Uso: npm run db:seed
// Crea (o reinicia) la cuenta demo@ordensimple.test / demo12345 con un negocio y 90 días de movimientos.

import "dotenv/config"
import { randomUUID } from "node:crypto"
import { PrismaPg } from "@prisma/adapter-pg"
import { hashPassword } from "better-auth/crypto"
import { PrismaClient, type Prisma } from "../src/generated/prisma/client"
import { DEFAULT_EXPENSE_CATEGORIES } from "../src/lib/constants"
import { addDays, startOfDay, zonedTimeToUtc, zonedParts } from "../src/lib/dates"

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })

const DEMO_EMAIL = "demo@ordensimple.test"
const DEMO_PASSWORD = "demo12345"
const TZ = "America/Santiago"

// Generador pseudoaleatorio con semilla para que los datos sean siempre iguales.
let seed = 42
function rand() {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]
const roundTo = (n: number, step: number) => Math.round(n / step) * step

const PRODUCTS = [
  { name: "Coca-Cola 1.5L", category: "Bebidas", cost: 1150, price: 1990, stock: 4, minStock: 10 },
  { name: "Agua mineral 1.6L", category: "Bebidas", cost: 550, price: 1000, stock: 36, minStock: 12 },
  { name: "Pan amasado (kg)", category: "Panadería", cost: 1300, price: 2400, stock: 0, minStock: 0, trackStock: false },
  { name: "Leche entera 1L", category: "Lácteos", cost: 890, price: 1290, stock: 24, minStock: 10 },
  { name: "Huevos (docena)", category: "Abarrotes", cost: 2700, price: 3990, stock: 15, minStock: 6 },
  { name: "Arroz 1kg", category: "Abarrotes", cost: 1050, price: 1590, stock: 30, minStock: 8 },
  { name: "Aceite maravilla 1L", category: "Abarrotes", cost: 2100, price: 2990, stock: 0, minStock: 5 },
  { name: "Café instantáneo 170g", category: "Abarrotes", cost: 4200, price: 6490, stock: 9, minStock: 4 },
  { name: "Papas fritas 230g", category: "Snacks", cost: 1400, price: 2490, stock: 22, minStock: 8 },
  { name: "Detergente 3L", category: "Aseo", cost: 5200, price: 7990, stock: 7, minStock: 3 },
]

async function main() {
  console.log("Preparando cuenta demo…")

  // Usuario y contraseña (formato Better Auth).
  let user = await db.user.findUnique({ where: { email: DEMO_EMAIL } })
  if (!user) {
    user = await db.user.create({
      data: { id: randomUUID(), name: "Demo Pyme", email: DEMO_EMAIL, emailVerified: true },
    })
  }
  const password = await hashPassword(DEMO_PASSWORD)
  const account = await db.account.findFirst({ where: { userId: user.id, providerId: "credential" } })
  if (account) await db.account.update({ where: { id: account.id }, data: { password } })
  else
    await db.account.create({
      data: { id: randomUUID(), accountId: user.id, providerId: "credential", userId: user.id, password },
    })

  // Reinicia los negocios de la cuenta demo.
  const memberships = await db.businessMember.findMany({ where: { userId: user.id, role: "OWNER" } })
  await db.business.deleteMany({ where: { id: { in: memberships.map((m) => m.businessId) } } })

  const business = await db.business.create({
    data: {
      name: "Almacén Don Pedro",
      type: "Almacén o minimarket",
      country: "CL",
      currency: "CLP",
      timezone: TZ,
      hasProducts: true,
      hasEmployees: false,
      managesInventory: true,
      onboardingCompleted: true,
      members: { create: { userId: user.id, role: "OWNER" } },
      settings: { create: {} },
      expenseCategories: {
        create: DEFAULT_EXPENSE_CATEGORIES.map((c) => ({
          name: c.name,
          icon: c.icon,
          isDefault: true,
          isVariable: c.isVariable ?? false,
        })),
      },
    },
    include: { expenseCategories: true },
  })
  await db.user.update({ where: { id: user.id }, data: { activeBusinessId: business.id } })

  const products: Awaited<ReturnType<typeof db.product.create>>[] = []
  for (const p of PRODUCTS) {
    const category = await db.category.upsert({
      where: { businessId_name: { businessId: business.id, name: p.category } },
      create: { businessId: business.id, name: p.category },
      update: {},
    })
    products.push(
      await db.product.create({
        data: {
          businessId: business.id,
          name: p.name,
          categoryId: category.id,
          cost: p.cost,
          price: p.price,
          stock: p.stock,
          minStock: p.minStock,
          trackStock: p.trackStock ?? true,
          saleUnit: p.name.includes("(kg)") ? "kg" : "u",
        },
      }),
    )
  }

  const cat = (name: string) => business.expenseCategories.find((c) => c.name === name)!.id
  const supplier = await db.supplier.create({ data: { businessId: business.id, name: "Distribuidora Central" } })
  const customers = await Promise.all(
    ["María Soto", "Juan Pérez", "Carla Muñoz", "Pedro Rojas"].map((name) =>
      db.customer.create({ data: { businessId: business.id, name } }),
    ),
  )

  const today = startOfDay(new Date(), TZ)
  const sales: Prisma.SaleUncheckedCreateInput[] = []
  const expenses: Prisma.ExpenseCreateManyInput[] = []

  for (let i = 89; i >= 0; i--) {
    const day = addDays(today, -i, TZ)
    const p = zonedParts(day, TZ)
    const weekday = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()
    const weekendBoost = weekday === 5 || weekday === 6 ? 1.4 : weekday === 0 ? 0.7 : 1
    const growth = 0.85 + ((89 - i) / 89) * 0.3
    const count = Math.max(2, Math.round((6 + rand() * 6) * weekendBoost * growth))
    const isToday = i === 0
    const maxHour = isToday ? Math.max(9, zonedParts(new Date(), TZ).hour) : 21

    for (let s = 0; s < count; s++) {
      const hour = 9 + Math.floor(rand() * (maxHour - 9 + 1))
      const date = zonedTimeToUtc(p.year, p.month, p.day, TZ, Math.min(hour, 23), Math.floor(rand() * 60))
      if (date > new Date()) continue
      const method = pick(["CASH", "CASH", "DEBIT", "DEBIT", "CREDIT", "TRANSFER"] as const)

      if (rand() < 0.35) {
        const amount = roundTo(2000 + rand() * 18000, 100)
        sales.push({
          businessId: business.id,
          date,
          total: amount,
          paymentMethod: method,
          isQuick: true,
          createdById: user.id,
          items: { create: { description: "Venta rápida", quantity: 1, unitPrice: amount, subtotal: amount } },
        })
      } else {
        const lines = Array.from({ length: 1 + Math.floor(rand() * 3) }, () => {
          const prod = pick(products)
          const quantity = 1 + Math.floor(rand() * 3)
          return {
            productId: prod.id,
            description: prod.name,
            quantity,
            unitPrice: prod.price,
            unitCost: prod.cost,
            subtotal: quantity * prod.price,
          }
        })
        sales.push({
          businessId: business.id,
          date,
          total: lines.reduce((sum, l) => sum + l.subtotal, 0),
          paymentMethod: method,
          customerId: rand() < 0.2 ? pick(customers).id : null,
          createdById: user.id,
          items: { create: lines },
        })
      }
    }

    // Gastos: fijos al inicio de mes y compras a proveedor 2 veces por semana.
    const at = zonedTimeToUtc(p.year, p.month, p.day, TZ, 12)
    if (p.day === 1) {
      expenses.push(
        { businessId: business.id, description: "Arriendo del local", amount: 450000, date: at, categoryId: cat("Arriendo"), createdById: user.id },
        { businessId: business.id, description: "Internet y teléfono", amount: 32990, date: at, categoryId: cat("Internet"), createdById: user.id },
      )
    }
    if (p.day === 5) {
      expenses.push(
        { businessId: business.id, description: "Cuenta de luz", amount: roundTo(68000 + rand() * 20000, 10), date: at, categoryId: cat("Luz"), createdById: user.id },
        { businessId: business.id, description: "Cuenta de agua", amount: roundTo(18000 + rand() * 6000, 10), date: at, categoryId: cat("Agua"), createdById: user.id },
      )
    }
    if (weekday === 2 || weekday === 5) {
      expenses.push({
        businessId: business.id,
        description: "Compra de mercadería",
        amount: roundTo(180000 + rand() * 120000, 100),
        date: at,
        categoryId: cat("Proveedores"),
        supplierId: supplier.id,
        createdById: user.id,
      })
    }
    if (weekday === 3 && rand() < 0.5) {
      expenses.push({ businessId: business.id, description: "Bencina reparto", amount: roundTo(15000 + rand() * 15000, 100), date: at, categoryId: cat("Transporte"), createdById: user.id })
    }
  }

  // Sin transacción interactiva: más compatible con el Postgres local de `prisma dev`.
  for (const data of sales) await db.sale.create({ data })
  await db.expense.createMany({ data: expenses })

  console.log(`Listo: ${sales.length} ventas, ${expenses.length} gastos, ${products.length} productos.`)
  console.log(`Entra con ${DEMO_EMAIL} / ${DEMO_PASSWORD}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
