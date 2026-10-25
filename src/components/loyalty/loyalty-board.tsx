"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Copy, ExternalLink, Gift, Loader2, Minus, Plus, Search, Send, Settings2, Trash2, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { AppModal } from "@/components/app/app-modal"
import { ScanButton } from "@/components/app/barcode-scanner"
import { EmptyState } from "@/components/app/empty-state"
import { Field } from "@/components/app/field"
import { LoyaltySettingsForm } from "@/components/loyalty/loyalty-settings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatMoney } from "@/lib/currency"
import { loyaltyPath, loyaltyWhatsappText, rewardText, ruleText, units, type LoyaltyConfig } from "@/lib/loyalty"
import { cn } from "@/lib/utils"
import { whatsappLink } from "@/lib/whatsapp"
import { adjustLoyalty, deleteLoyaltyCard, issueLoyaltyCard, redeemLoyalty } from "@/server/actions/loyalty"

export type LoyaltyCardRow = {
  id: string
  token: string
  customerName: string
  customerPhone: string | null
  balance: number
  rewards: number
  updatedAt: string
  movements: { id: string; kind: "EARN" | "REDEEM" | "ADJUST"; amount: number; createdAt: string }[]
}

export function LoyaltyBoard({
  cards,
  customers,
  cfg,
  enabled,
  currency,
  timezone,
  businessName,
  canConfigure,
  canDelete,
}: {
  cards: LoyaltyCardRow[]
  /** Clientes guardados que todavía no tienen tarjeta. */
  customers: { id: string; name: string }[]
  cfg: LoyaltyConfig
  enabled: boolean
  currency: string
  timezone: string
  businessName: string
  canConfigure: boolean
  canDelete: boolean
}) {
  const router = useRouter()
  const money = (n: number) => formatMoney(n, currency)
  const [query, setQuery] = React.useState("")
  const [openId, setOpenId] = React.useState<string | null>(null)
  const [issuing, setIssuing] = React.useState(false)
  const [configuring, setConfiguring] = React.useState(false)
  const open = cards.find((c) => c.id === openId) ?? null
  const shown = cards.filter((c) => c.customerName.toLowerCase().includes(query.trim().toLowerCase()))
  const ready = cards.filter((c) => c.balance >= cfg.goal).length
  const redeemed = cards.reduce((s, c) => s + c.rewards, 0)
  const url = (c: LoyaltyCardRow) => `${window.location.origin}${loyaltyPath(c.token)}`

  function onScan(code: string) {
    const token = code.trim().match(/([\w-]{16,64})\/?$/)?.[1]
    const card = token ? cards.find((c) => c.token === token) : undefined
    if (!card) return { ok: false, message: "Esa tarjeta no es de este negocio." }
    setOpenId(card.id)
    return { ok: true, message: `Tarjeta de ${card.customerName}` }
  }

  if (!enabled && !cards.length) {
    return canConfigure ? (
      <div className="max-w-xl space-y-4 rounded-2xl border bg-card p-5">
        <div className="space-y-1">
          <p className="font-semibold">Activa tu tarjeta de fidelidad</p>
          <p className="text-sm text-muted-foreground">
            Elige si das sellos (por ejemplo, 10 cafés y el siguiente gratis) o puntos según lo que compran. Cada cliente la guarda en su celular y se le suma sola al
            venderle.
          </p>
        </div>
        <LoyaltySettingsForm cfg={cfg} enabled={false} currency={currency} onDone={() => router.refresh()} />
      </div>
    ) : (
      <EmptyState icon={Gift} title="La tarjeta de fidelidad no está activa" description="Pídele al dueño o a un administrador que la active." />
    )
  }

  return (
    <div className="space-y-5">
      {!enabled ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          La tarjeta está desactivada: no se suman {cfg.mode === "STAMPS" ? "sellos" : "puntos"} al vender. Los saldos se mantienen.
        </p>
      ) : null}

      <div className="rounded-2xl border bg-card p-4">
        <p className="text-sm">
          <span className="font-medium">{ruleText(cfg, money)}.</span> Con {units(cfg.mode, cfg.goal)}, {rewardText(cfg)}.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Se suma solo al registrar una venta a un cliente con tarjeta (también en comandas, citas, pedidos web y cotizaciones).
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat label="Tarjetas" value={cards.length} />
          <Stat label="Premios listos" value={ready} highlight={ready > 0} />
          <Stat label="Premios canjeados" value={redeemed} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setIssuing(true)}>
          <UserPlus />
          Entregar tarjeta
        </Button>
        {cards.length ? <ScanButton label="Escanear tarjeta" onResult={onScan} /> : null}
        {canConfigure ? (
          <Button variant="ghost" onClick={() => setConfiguring(true)}>
            <Settings2 />
            Cómo funciona
          </Button>
        ) : null}
      </div>

      {cards.length ? (
        <>
          {cards.length > 8 ? (
            <div className="relative max-w-sm">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar cliente" className="h-10 pl-9" aria-label="Buscar cliente" />
            </div>
          ) : null}
          <ul className="divide-y rounded-2xl border bg-card">
            {shown.map((c) => {
              const done = c.balance >= cfg.goal
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => setOpenId(c.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{c.customerName}</span>
                      <span className="mt-1.5 block h-1.5 max-w-48 overflow-hidden rounded-full bg-muted">
                        <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (c.balance / cfg.goal) * 100)}%` }} />
                      </span>
                    </span>
                    {done ? <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">🎁 Premio listo</span> : null}
                    <span className="tabular shrink-0 text-sm text-muted-foreground">
                      {c.balance.toLocaleString("es-CL")} / {cfg.goal.toLocaleString("es-CL")}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      ) : (
        <EmptyState icon={Gift} title="Todavía no entregas tarjetas" description="Entrégale una a tu cliente y envíasela por WhatsApp: la guarda en su celular y se le suma sola cada vez que le vendes." />
      )}

      {issuing ? (
        <IssueDialog
          customers={customers}
          onClose={() => setIssuing(false)}
          onIssued={(id) => {
            setIssuing(false)
            setOpenId(id)
            router.refresh()
          }}
        />
      ) : null}

      {configuring ? (
        <AppModal open onOpenChange={(o) => !o && setConfiguring(false)} title="Tarjeta de fidelidad" description="Cómo ganan tus clientes y cuál es el premio." noAutoFocus>
          <LoyaltySettingsForm
            cfg={cfg}
            enabled={enabled}
            currency={currency}
            onDone={() => {
              setConfiguring(false)
              router.refresh()
            }}
          />
        </AppModal>
      ) : null}

      {open ? (
        <CardDialog
          card={open}
          cfg={cfg}
          timezone={timezone}
          canDelete={canDelete}
          onClose={() => setOpenId(null)}
          onShare={() => {
            const text = loyaltyWhatsappText({ businessName, customerName: open.customerName, cfg, url: url(open), money })
            window.open(whatsappLink(open.customerPhone, text), "_blank", "noopener,noreferrer")
          }}
          onCopy={async () => {
            try {
              await navigator.clipboard.writeText(url(open))
              toast.success("Enlace copiado")
            } catch {
              toast.error("No se pudo copiar el enlace.")
            }
          }}
        />
      ) : null}
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={cn("rounded-xl bg-muted/60 px-2 py-2", highlight && "bg-primary/10 text-primary")}>
      <p className="tabular text-xl font-semibold">{value.toLocaleString("es-CL")}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

const NEW = "__nuevo__"

function IssueDialog({ customers, onClose, onIssued }: { customers: { id: string; name: string }[]; onClose: () => void; onIssued: (id: string) => void }) {
  const [customerId, setCustomerId] = React.useState(customers.length ? "" : NEW)
  const [name, setName] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [pending, startTransition] = React.useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!customerId) return void toast.error("Elige el cliente.")
    if (customerId === NEW && name.trim().length < 2) return void toast.error("Escribe el nombre del cliente.")
    startTransition(async () => {
      const r = await issueLoyaltyCard(customerId === NEW ? { name, phone: phone || undefined } : { customerId })
      if (!r.ok || !r.data) return void toast.error(r.message)
      toast.success(r.message)
      onIssued(r.data.id)
    })
  }

  return (
    <AppModal open onOpenChange={(o) => !o && onClose()} title="Entregar tarjeta" description="Después se la envías por WhatsApp y la guarda en su celular." noAutoFocus>
      <form onSubmit={submit} className="grid gap-4">
        {customers.length ? (
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger className="h-10 w-full" aria-label="Cliente">
              <SelectValue placeholder="Elige un cliente" />
            </SelectTrigger>
            <SelectContent position="popper" className="max-h-72">
              <SelectItem value={NEW}>Cliente nuevo</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {customerId === NEW ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre" htmlFor="lc-name">
              <Input id="lc-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="h-10" />
            </Field>
            <Field label="WhatsApp" htmlFor="lc-phone" optional>
              <Input id="lc-phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} inputMode="tel" className="h-10" placeholder="+56 9 1234 5678" />
            </Field>
          </div>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Crear tarjeta
        </Button>
      </form>
    </AppModal>
  )
}

function CardDialog({
  card,
  cfg,
  timezone,
  canDelete,
  onClose,
  onShare,
  onCopy,
}: {
  card: LoyaltyCardRow
  cfg: LoyaltyConfig
  timezone: string
  canDelete: boolean
  onClose: () => void
  onShare: () => void
  onCopy: () => void
}) {
  const router = useRouter()
  const [amount, setAmount] = React.useState(cfg.mode === "STAMPS" ? "1" : "")
  const [busy, setBusy] = React.useState<string | null>(null)
  const ready = card.balance >= cfg.goal
  const n = Number(amount) || 0
  const day = (iso: string) => new Intl.DateTimeFormat("es-CL", { timeZone: timezone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))

  async function run(key: string, action: () => Promise<{ ok: boolean; message?: string }>, after?: () => void) {
    setBusy(key)
    const r = await action()
    setBusy(null)
    if (!r.ok) return void toast.error(r.message)
    toast.success(r.message)
    after?.()
    router.refresh()
  }

  return (
    <AppModal open onOpenChange={(o) => !o && onClose()} title={`Tarjeta de ${card.customerName}`} noAutoFocus>
      <div className="grid gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-primary to-emerald-800 p-4 text-primary-foreground">
          <p className="text-3xl font-semibold tabular">
            {card.balance.toLocaleString("es-CL")}
            <span className="ml-2 text-sm font-normal text-white/80">de {units(cfg.mode, cfg.goal)}</span>
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/25">
            <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, (card.balance / cfg.goal) * 100)}%` }} />
          </div>
          <p className="mt-2 text-sm">{ready ? `🎁 Tiene ${rewardText(cfg)} para canjear` : `Le ${cfg.goal - card.balance === 1 ? "falta" : "faltan"} ${units(cfg.mode, cfg.goal - card.balance)}`}</p>
        </div>

        {ready ? (
          <Button size="lg" className="h-12" onClick={() => void run("canje", () => redeemLoyalty(card.id))} disabled={busy !== null}>
            {busy === "canje" ? <Loader2 className="animate-spin" /> : <Gift />}
            Canjear {rewardText(cfg)}
          </Button>
        ) : null}

        <div className="space-y-2 rounded-xl border p-3">
          <p className="text-sm font-medium">Sumar a mano</p>
          <p className="text-xs text-muted-foreground">Las ventas a este cliente ya suman solas. Usa esto para una compra que no anotaste o para corregir.</p>
          <div className="flex gap-2">
            <Input
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 7))}
              className="h-10 w-24"
              aria-label={cfg.mode === "STAMPS" ? "Sellos" : "Puntos"}
              placeholder={cfg.mode === "STAMPS" ? "Sellos" : "Puntos"}
            />
            <Button variant="outline" className="h-10" onClick={() => void run("sumar", () => adjustLoyalty(card.id, n))} disabled={!n || busy !== null}>
              {busy === "sumar" ? <Loader2 className="animate-spin" /> : <Plus />}
              Sumar
            </Button>
            <Button variant="ghost" className="h-10 text-muted-foreground" onClick={() => void run("restar", () => adjustLoyalty(card.id, -n))} disabled={!n || busy !== null}>
              <Minus />
              Restar
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {card.customerPhone ? (
            <Button variant="outline" className="flex-1" onClick={onShare}>
              <Send />
              Enviar por WhatsApp
            </Button>
          ) : null}
          <Button variant="outline" className="flex-1" onClick={onCopy}>
            <Copy />
            Copiar enlace
          </Button>
          <Button variant="outline" asChild>
            <a href={loyaltyPath(card.token)} target="_blank" rel="noopener noreferrer">
              <ExternalLink />
              Ver tarjeta
            </a>
          </Button>
        </div>

        {card.movements.length ? (
          <div className="space-y-1 text-sm">
            <p className="font-medium">Últimos movimientos</p>
            <ul className="divide-y rounded-xl border">
              {card.movements.map((m) => (
                <li key={m.id} className="flex justify-between gap-3 px-3 py-2">
                  <span>
                    {m.kind === "EARN" ? "Venta" : m.kind === "REDEEM" ? "🎁 Canje" : m.amount > 0 ? "Sumado a mano" : "Corrección"}
                    <span className="ml-2 text-xs text-muted-foreground">{day(m.createdAt)}</span>
                  </span>
                  <span className={cn("tabular", m.amount > 0 ? "text-primary" : "text-muted-foreground")}>
                    {m.amount > 0 ? "+" : "−"}
                    {Math.abs(m.amount).toLocaleString("es-CL")}
                  </span>
                </li>
              ))}
            </ul>
            {card.rewards ? <p className="text-xs text-muted-foreground">Premios canjeados: {card.rewards}</p> : null}
          </div>
        ) : null}

        {canDelete ? (
          <Button
            variant="ghost"
            className="justify-self-start text-muted-foreground"
            onClick={() => {
              if (window.confirm(`¿Eliminar la tarjeta de ${card.customerName}? Pierde sus ${cfg.mode === "STAMPS" ? "sellos" : "puntos"} y el enlace deja de funcionar.`))
                void run("eliminar", () => deleteLoyaltyCard(card.id), onClose)
            }}
            disabled={busy !== null}
          >
            <Trash2 />
            Eliminar tarjeta
          </Button>
        ) : null}
      </div>
    </AppModal>
  )
}
