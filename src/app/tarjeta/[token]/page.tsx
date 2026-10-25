import type { Metadata, Viewport } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { cache } from "react"
import QRCode from "qrcode"
import { Check, Gift } from "lucide-react"
import { AutoRefresh } from "@/components/app/auto-refresh"
import { BusinessLogo, businessLogoUrl } from "@/components/app/business-logo"
import { SaveCardHint } from "@/components/loyalty/save-card-hint"
import { db } from "@/lib/db"
import { formatMoney } from "@/lib/currency"
import { formatDate } from "@/lib/dates"
import { getAppUrl } from "@/lib/app-url"
import { loyaltyPath, progressText, rewardText, ruleText, units } from "@/lib/loyalty"
import { canUseFeature, effectivePlan } from "@/lib/plans"
import { cn } from "@/lib/utils"
import { loyaltyConfig, LOYALTY_SETTINGS } from "@/server/loyalty"

// Tarjeta de fidelidad del cliente: sus sellos o puntos, el premio y un QR para que el negocio la escanee.
// El enlace es aleatorio (solo lo tiene el cliente) y la página no aparece en buscadores.

const TOKEN_RE = /^[\w-]{16,64}$/
/** Hasta cuántos sellos se dibujan como círculos (más que eso, una barra). */
const MAX_DOTS = 20

const getCard = cache(async (token: string) => {
  if (!TOKEN_RE.test(token)) return null
  return db.loyaltyCard.findUnique({
    where: { token },
    select: {
      id: true,
      balance: true,
      rewards: true,
      customer: { select: { name: true } },
      movements: { orderBy: { createdAt: "desc" }, take: 6, select: { id: true, kind: true, amount: true, note: true, createdAt: true } },
      business: {
        select: { id: true, name: true, currency: true, timezone: true, plan: true, planExpiresAt: true, logoUpdatedAt: true, settings: { select: LOYALTY_SETTINGS } },
      },
    },
  })
})

export async function generateMetadata({ params }: PageProps<"/tarjeta/[token]">): Promise<Metadata> {
  const { token } = await params
  const card = await getCard(token)
  const name = card ? `Tarjeta ${card.business.name}` : "Tarjeta de fidelidad"
  const logo = card ? businessLogoUrl(card.business.id, card.business.logoUpdatedAt) : null
  return {
    title: { absolute: name },
    robots: { index: false, follow: false },
    // Al agregarla a la pantalla de inicio, se abre esta tarjeta (no el panel de OrdenSimple).
    manifest: `/tarjeta/${token}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: card ? card.business.name : "Tarjeta", statusBarStyle: "default" },
    icons: logo ? { apple: logo } : undefined,
  }
}

export const viewport: Viewport = { themeColor: "#007653" }

export default async function LoyaltyCardPage({ params }: PageProps<"/tarjeta/[token]">) {
  const { token } = await params
  const card = await getCard(token)
  const s = card?.business.settings
  if (!card || !s) notFound()
  const b = card.business
  const cfg = loyaltyConfig(s)
  const active = s.loyaltyEnabled && canUseFeature(effectivePlan(b), "loyalty")
  const money = (n: number) => formatMoney(n, b.currency)
  const ready = card.balance >= cfg.goal
  const dots = cfg.mode === "STAMPS" && cfg.goal <= MAX_DOTS
  const qr = await QRCode.toDataURL(`${getAppUrl()}${loyaltyPath(token)}`, { margin: 1, width: 360, errorCorrectionLevel: "M" })
  const first = card.customer.name.split(" ")[0] || card.customer.name

  return (
    <div className="min-h-dvh bg-muted/40">
      <AutoRefresh seconds={30} />
      <main className="mx-auto max-w-md space-y-4 px-4 py-6">
        {/* La tarjeta */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-emerald-800 p-5 text-primary-foreground shadow-xl">
          <div aria-hidden className="absolute -top-16 -right-16 size-48 rounded-full bg-white/10" />
          <div className="relative flex items-center gap-3">
            <BusinessLogo businessId={b.id} name={b.name} logoUpdatedAt={b.logoUpdatedAt} className="size-12 rounded-xl border-2 border-white/30 bg-white" />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{b.name}</p>
              <p className="text-sm text-white/80">Tarjeta de {first}</p>
            </div>
          </div>

          <div className="relative mt-5">
            {dots ? (
              <div className={cn("grid gap-2", cfg.goal <= 10 ? "grid-cols-5" : "grid-cols-5 sm:grid-cols-10")}>
                {Array.from({ length: cfg.goal }, (_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "flex aspect-square items-center justify-center rounded-full border-2",
                      i < card.balance ? "border-white bg-white text-primary" : "border-white/40 border-dashed",
                    )}
                  >
                    {i < card.balance ? <Check className="size-5" strokeWidth={3} /> : null}
                  </span>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-4xl font-semibold tabular">
                  {Math.min(card.balance, 9_999_999).toLocaleString("es-CL")}
                  <span className="ml-2 text-base font-normal text-white/80">
                    de {cfg.goal.toLocaleString("es-CL")} {cfg.mode === "STAMPS" ? "sellos" : "puntos"}
                  </span>
                </p>
                <div className="h-3 overflow-hidden rounded-full bg-white/25">
                  <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, (card.balance / cfg.goal) * 100)}%` }} />
                </div>
              </div>
            )}
          </div>

          <p className="relative mt-4 flex items-center gap-2 text-sm font-medium">
            <Gift className="size-4" />
            {ready ? `¡Premio listo! Muestra esta tarjeta y pide ${rewardText(cfg)}.` : progressText(cfg, card.balance)}
          </p>
        </section>

        {!active ? (
          <p className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            Por ahora {b.name} no está sumando {cfg.mode === "STAMPS" ? "sellos" : "puntos"}. Tu saldo se mantiene.
          </p>
        ) : null}

        {/* QR para que el negocio la escanee */}
        <section className="space-y-2 rounded-2xl border bg-background p-4 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="Código de tu tarjeta" className="mx-auto size-44" />
          <p className="text-sm text-muted-foreground">Muéstrale este código a {b.name} al pagar. Ganas {ruleText(cfg, money)}.</p>
        </section>

        <SaveCardHint />

        {card.movements.length ? (
          <section className="space-y-2 rounded-2xl border bg-background p-4 text-sm">
            <p className="font-medium">Últimos movimientos</p>
            <ul className="divide-y">
              {card.movements.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    {m.kind === "REDEEM" ? `🎁 Canjeaste ${m.note || "tu premio"}` : m.kind === "EARN" ? "Compra" : m.amount > 0 ? "Sumado por el negocio" : "Corrección"}
                    <span className="block text-xs text-muted-foreground">{formatDate(m.createdAt, b.timezone, { day: "numeric", month: "short", year: "numeric" })}</span>
                  </span>
                  <span className={cn("tabular shrink-0 font-medium", m.amount > 0 ? "text-primary" : "text-muted-foreground")}>
                    {m.amount > 0 ? "+" : "−"}
                    {units(cfg.mode, Math.abs(m.amount))}
                  </span>
                </li>
              ))}
            </ul>
            {card.rewards ? <p className="text-xs text-muted-foreground">Premios canjeados: {card.rewards}</p> : null}
          </section>
        ) : null}

        <p className="pt-2 text-center text-xs text-muted-foreground">
          Tarjeta hecha con{" "}
          <Link href="/?utm_source=tarjeta" className="font-medium text-primary hover:underline">
            OrdenSimple
          </Link>
        </p>
      </main>
    </div>
  )
}
