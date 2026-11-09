"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle, Ban, Check, Copy, Loader2, PlugZap, RefreshCw, Search, Send, Unplug } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AppModal } from "@/components/app/app-modal"
import { Field } from "@/components/app/field"
import {
  checkMlSalesNow,
  disconnectMercadoLibre,
  dismissMlOrderReview,
  generateActivationCodes,
  markActivationCodeSent,
  recheckMlOrder,
  retryActivationCodeMessage,
  voidActivationCode,
} from "@/server/actions/licenses"
import { cn } from "@/lib/utils"

export type LicenseStatus = "AVAILABLE" | "RESERVED" | "USED" | "VOID"

export type LicenseCodeRow = {
  id: string
  code: string
  status: LicenseStatus
  note: string | null
  createdLabel: string
  sentLabel: string | null
  redeemedLabel: string | null
  voidedLabel: string | null
  redeemedByEmail: string | null
  mlOrderId: string | null
  mlUnit: number | null
  lastError: string | null
  sendAttempts: number
}

export type LicenseAdminData = {
  counts: { available: number; reserved: number; used: number; void: number }
  filter: string
  q: string
  matching: number
  codes: LicenseCodeRow[]
  review: { id: string; reason: string; buyerNick: string | null; updatedLabel: string; codes: { id: string; code: string; status: LicenseStatus }[] }[]
  waiting: { id: string; pendingUnits: number; buyerNick: string | null }[]
  unsent: LicenseCodeRow[]
  logs: { id: string; kind: string; detail: string; at: string }[]
  ml: { configured: boolean; items: string[]; account: { name: string; connectedBy: string | null; updatedLabel: string } | null; notifyUrl: string; failure: string | null }
  flash: string | null
}

const STATUS: Record<LicenseStatus, { label: string; tone: string }> = {
  AVAILABLE: { label: "Disponible", tone: "border-emerald-600/30 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" },
  RESERVED: { label: "Reservado", tone: "border-amber-600/30 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" },
  USED: { label: "Usado", tone: "border-sky-600/30 bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300" },
  VOID: { label: "Anulado", tone: "border-border bg-muted text-muted-foreground line-through" },
}

const LOG_LABEL: Record<string, string> = {
  notificacion: "Aviso",
  asignado: "Asignado",
  enviado: "Enviado",
  envio_fallido: "Envío fallido",
  canje: "Canje",
  anulado: "Anulado",
  generados: "Generados",
  revisar: "Revisar",
  sin_codigos: "Sin códigos",
  conexion: "Conexión",
  conexion_error: "Conexión fallida",
  error: "Error",
}

const FLASH: Record<string, { ok: boolean; text: string }> = {
  conectado: { ok: true, text: "Cuenta de Mercado Libre conectada." },
  error: { ok: false, text: "No se pudo conectar Mercado Libre. Intenta de nuevo." },
  "sin-claves": { ok: false, text: "Faltan MERCADOLIBRE_CLIENT_ID y MERCADOLIBRE_CLIENT_SECRET en Vercel." },
}

async function copy(text: string, label = "Código copiado") {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(label)
  } catch {
    toast.error("No se pudo copiar. Selecciónalo y cópialo a mano.")
  }
}

function useAction() {
  const [pending, start] = React.useTransition()
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn()
      if (r.ok) {
        toast.success(r.message ?? "Listo")
        after?.()
      } else toast.error(r.message ?? "No se pudo")
    })
  return { pending, run }
}

function StatusTag({ status }: { status: LicenseStatus }) {
  return <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase", STATUS[status].tone)}>{STATUS[status].label}</span>
}

/** El código como una etiqueta: letra de máquina y botón para copiarlo. */
function CodeTag({ code, muted }: { code: string; muted?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => copy(code)}
      title="Copiar código"
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-md border border-dashed bg-background px-2 py-1 font-mono text-sm tracking-wider transition-colors hover:border-primary hover:text-primary",
        muted && "text-muted-foreground",
      )}
    >
      {code}
      <Copy className="size-3.5 opacity-50 group-hover:opacity-100" />
      <span className="sr-only">Copiar</span>
    </button>
  )
}

function Stat({ label, value, href, active, warn }: { label: string; value: number; href: string; active: boolean; warn?: boolean }) {
  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        "flex flex-col gap-1 rounded-xl border bg-card px-4 py-3 transition-colors hover:border-primary/50",
        active && "border-primary ring-1 ring-primary",
        warn && "border-warning/60 bg-warning/5",
      )}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="tabular font-display text-2xl font-semibold">{value.toLocaleString("es-CL")}</span>
    </Link>
  )
}

function GenerateCodes() {
  const [count, setCount] = React.useState("10")
  const [note, setNote] = React.useState("")
  const [made, setMade] = React.useState<string[]>([])
  const [pending, start] = React.useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const n = Number.parseInt(count, 10)
    if (!Number.isFinite(n) || n < 1 || n > 100) {
      toast.error("Elige entre 1 y 100 códigos.")
      return
    }
    start(async () => {
      const r = await generateActivationCodes({ count: n, note: note || undefined })
      if (!r.ok) {
        toast.error(r.message)
        return
      }
      toast.success(r.message)
      setMade(r.data?.codes ?? [])
      setNote("")
    })
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <Field label="Cantidad" htmlFor="lic-count">
          <Input id="lic-count" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, "").slice(0, 3))} className="h-10 w-24" />
        </Field>
        <Field label="Nota" htmlFor="lic-note" optional>
          <Input id="lic-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Ej: tanda de noviembre" className="h-10 w-64 max-w-full" />
        </Field>
        <Button type="submit" size="lg" className="h-10" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Generar códigos
        </Button>
      </form>
      {made.length ? (
        <div className="space-y-2 rounded-lg bg-muted/50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Recién creados</p>
            <Button type="button" variant="outline" size="sm" onClick={() => copy(made.join("\n"), "Códigos copiados")}>
              <Copy />
              Copiar todos
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {made.map((c) => (
              <CodeTag key={c} code={c} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function VoidDialog({ row, onClose }: { row: LicenseCodeRow | null; onClose: () => void }) {
  const [reason, setReason] = React.useState("")
  const { pending, run } = useAction()
  return (
    <AppModal open={Boolean(row)} onOpenChange={(o) => !o && onClose()} title="Anular código" description={row ? row.code : undefined}>
      {row ? (
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            run(() => voidActivationCode(row.id, reason || undefined), () => {
              setReason("")
              onClose()
            })
          }}
        >
          <p className="text-sm text-muted-foreground">
            {row.status === "USED"
              ? `Este código ya fue canjeado${row.redeemedByEmail ? ` por ${row.redeemedByEmail}` : ""}. Al anularlo, su cuenta y sus sucursales vuelven al plan Gratis. Sus datos no se borran.`
              : "El código deja de servir. Si alguien intenta canjearlo, verá que fue anulado."}
          </p>
          <Field label="Motivo" htmlFor="void-reason" optional>
            <Input id="void-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Ej: devolución de la venta" className="h-10" />
          </Field>
          <Button type="submit" variant="destructive" size="lg" className="h-11" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Ban />}
            Anular código
          </Button>
        </form>
      ) : null}
    </AppModal>
  )
}

function DeliverDialog({ row, onClose }: { row: LicenseCodeRow | null; onClose: () => void }) {
  const [order, setOrder] = React.useState("")
  const { pending, run } = useAction()
  return (
    <AppModal open={Boolean(row)} onOpenChange={(o) => !o && onClose()} title="Marcar como entregado" description={row ? row.code : undefined}>
      {row ? (
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            run(() => markActivationCodeSent(row.id, order || undefined), () => {
              setOrder("")
              onClose()
            })
          }}
        >
          <p className="text-sm text-muted-foreground">Úsalo cuando lo envíes tú, por ejemplo copiándolo en el chat de la venta. Queda reservado hasta que lo canjeen.</p>
          {row.mlOrderId ? null : (
            <Field label="Número de venta de Mercado Libre" htmlFor="deliver-order" optional>
              <Input id="deliver-order" inputMode="numeric" value={order} onChange={(e) => setOrder(e.target.value.replace(/\D/g, "").slice(0, 20))} className="h-10" />
            </Field>
          )}
          <Button type="submit" size="lg" className="h-11" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Check />}
            Marcar como entregado
          </Button>
        </form>
      ) : null}
    </AppModal>
  )
}

function CodeLine({ row, onVoid, onDeliver }: { row: LicenseCodeRow; onVoid: (r: LicenseCodeRow) => void; onDeliver: (r: LicenseCodeRow) => void }) {
  const { pending, run } = useAction()
  const unsent = row.status === "RESERVED" && !row.sentLabel
  return (
    <li className="grid gap-2 border-b px-3 py-3 last:border-b-0 @3xl:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_auto] @3xl:items-center">
      <div className="flex flex-wrap items-center gap-2">
        <CodeTag code={row.code} muted={row.status === "VOID"} />
        <StatusTag status={row.status} />
      </div>
      <div className="min-w-0 space-y-0.5 text-xs text-muted-foreground">
        <p>
          Creado {row.createdLabel}
          {row.mlOrderId ? (
            <>
              {" · "}Venta <span className="font-mono text-foreground">{row.mlOrderId}</span>
              {row.mlUnit ? ` (unidad ${row.mlUnit})` : ""}
            </>
          ) : null}
          {row.sentLabel ? ` · enviado ${row.sentLabel}` : ""}
        </p>
        {row.redeemedLabel ? (
          <p className="text-foreground">
            Canjeado {row.redeemedLabel}
            {row.redeemedByEmail ? ` por ${row.redeemedByEmail}` : ""}
          </p>
        ) : null}
        {row.voidedLabel ? <p>Anulado {row.voidedLabel}</p> : null}
        {row.note ? <p className="truncate">Nota: {row.note}</p> : null}
        {unsent && row.lastError ? (
          <p className="text-destructive">
            Sin enviar ({row.sendAttempts} {row.sendAttempts === 1 ? "intento" : "intentos"}): {row.lastError}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5 @3xl:justify-end">
        {unsent && row.mlOrderId ? (
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => run(() => retryActivationCodeMessage(row.id))}>
            {pending ? <Loader2 className="animate-spin" /> : <Send />}
            Reintentar envío
          </Button>
        ) : null}
        {row.status === "AVAILABLE" || unsent ? (
          <Button type="button" variant="outline" size="sm" onClick={() => onDeliver(row)}>
            <Check />
            {row.status === "AVAILABLE" ? "Entregado a mano" : "Marcar como enviado"}
          </Button>
        ) : null}
        {row.status !== "VOID" ? (
          <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onVoid(row)}>
            <Ban />
            Anular
          </Button>
        ) : null}
      </div>
    </li>
  )
}

function RecheckOrder() {
  const [order, setOrder] = React.useState("")
  const { pending, run } = useAction()
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (order) run(() => recheckMlOrder(order))
      }}
    >
      <Field label="Revisar una venta" htmlFor="ml-recheck" hint="Si un aviso no llegó: consulta la venta y entrega sus códigos.">
        <Input id="ml-recheck" inputMode="numeric" value={order} onChange={(e) => setOrder(e.target.value.replace(/\D/g, "").slice(0, 20))} placeholder="Número de venta" className="h-9 w-48" />
      </Field>
      <Button type="submit" variant="outline" size="sm" className="h-9" disabled={pending || !order}>
        {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        Revisar
      </Button>
    </form>
  )
}

export function LicenseManager({ data }: { data: LicenseAdminData }) {
  const [voiding, setVoiding] = React.useState<LicenseCodeRow | null>(null)
  const [delivering, setDelivering] = React.useState<LicenseCodeRow | null>(null)
  const { pending, run } = useAction()
  const { counts, ml } = data
  const href = (filter: string) => `/admin?${new URLSearchParams({ ...(filter !== "todos" ? { codigos: filter } : {}), ...(data.q ? { codigo: data.q } : {}) })}#licencias`
  const flash = data.flash ? FLASH[data.flash] : null
  const attention = data.review.length + data.waiting.length + data.unsent.length

  return (
    <div className="space-y-8">
      {flash ? <p className={cn("rounded-lg p-3 text-sm", flash.ok ? "bg-success/10" : "bg-destructive/10 text-destructive")}>{flash.text}</p> : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Disponibles" value={counts.available} href={href("disponible")} active={data.filter === "disponible"} warn={counts.available < 5} />
        <Stat label="Reservados" value={counts.reserved} href={href("reservado")} active={data.filter === "reservado"} />
        <Stat label="Usados" value={counts.used} href={href("usado")} active={data.filter === "usado"} />
        <Stat label="Anulados" value={counts.void} href={href("anulado")} active={data.filter === "anulado"} />
      </div>
      {counts.available < 5 ? (
        <p className="flex items-center gap-2 text-sm text-warning">
          <AlertTriangle className="size-4 shrink-0" />
          {counts.available === 0 ? "No quedan códigos disponibles: las ventas nuevas quedarán esperando." : `Quedan solo ${counts.available} códigos disponibles.`}
        </p>
      ) : null}

      {attention ? (
        <section className="space-y-3">
          <h4 className="text-sm font-semibold">Para revisar</h4>
          <ul className="divide-y rounded-xl border border-warning/50 bg-warning/5">
            {data.review.map((o) => (
              <li key={o.id} className="flex flex-wrap items-start justify-between gap-3 p-3 text-sm">
                <div className="space-y-1">
                  <p className="font-medium">
                    Venta <span className="font-mono">{o.id}</span>: {o.reason.toLowerCase()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {o.buyerNick ? `Comprador ${o.buyerNick} · ` : ""}
                    {o.updatedLabel}
                    {o.codes.length ? "" : " · no tenía códigos asignados"}
                  </p>
                  {o.codes.length ? (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {o.codes.map((c) => (
                        <span key={c.id} className="inline-flex items-center gap-1.5">
                          <CodeTag code={c.code} />
                          <StatusTag status={c.status} />
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {o.codes.map((c) => {
                    const row = data.codes.find((r) => r.id === c.id)
                    return (
                      <Button
                        key={c.id}
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() =>
                          setVoiding(
                            row ?? { id: c.id, code: c.code, status: c.status, note: null, createdLabel: "", sentLabel: null, redeemedLabel: null, voidedLabel: null, redeemedByEmail: null, mlOrderId: o.id, mlUnit: null, lastError: null, sendAttempts: 0 },
                          )
                        }
                      >
                        <Ban />
                        Anular {o.codes.length > 1 ? c.code.slice(-4) : "código"}
                      </Button>
                    )
                  })}
                  <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => run(() => dismissMlOrderReview(o.id))}>
                    Revisado
                  </Button>
                </div>
              </li>
            ))}
            {data.waiting.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                <p>
                  Venta <span className="font-mono">{o.id}</span> espera {o.pendingUnits} {o.pendingUnits === 1 ? "código" : "códigos"}
                  {o.buyerNick ? ` (${o.buyerNick})` : ""}. Genera más y se entregan solos.
                </p>
              </li>
            ))}
            {data.unsent.map((row) => (
              <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 p-3 text-sm">
                <div className="space-y-1">
                  <p className="font-medium">
                    Código sin enviar de la venta <span className="font-mono">{row.mlOrderId}</span>
                  </p>
                  <CodeTag code={row.code} />
                  {row.lastError ? <p className="text-xs text-destructive">{row.lastError}</p> : <p className="text-xs text-muted-foreground">Enviándose…</p>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => run(() => retryActivationCodeMessage(row.id))}>
                    <Send />
                    Reintentar envío
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setDelivering(row)}>
                    <Check />
                    Ya lo envié a mano
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <h4 className="text-sm font-semibold">Mercado Libre</h4>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 rounded-xl border bg-card p-4 text-sm break-words lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            {!ml.configured ? (
              <p className="text-destructive">Faltan las variables MERCADOLIBRE_CLIENT_ID y MERCADOLIBRE_CLIENT_SECRET en Vercel.</p>
            ) : ml.account ? (
              <p>
                <span className="font-medium text-success">✓ Conectada: {ml.account.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {ml.account.connectedBy ? `Por ${ml.account.connectedBy} · ` : ""}sesión renovada {ml.account.updatedLabel}
                </span>
              </p>
            ) : (
              <p className="font-medium text-destructive">✗ Sin conectar: las ventas no se entregan solas.</p>
            )}
            {ml.failure ? <p className="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">La última consulta falló: {ml.failure}</p> : null}
            <p className="text-xs text-muted-foreground">
              Publicaciones del Pro permanente:{" "}
              {ml.items.length ? <span className="font-mono text-foreground">{ml.items.join(", ")}</span> : <span className="text-destructive">falta MERCADOLIBRE_ITEM_IDS</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              {ml.configured ? (
                <Button asChild variant={ml.account ? "outline" : "default"} size="sm">
                  <a href="/api/mercadolibre/conectar">
                    <PlugZap />
                    {ml.account ? "Volver a conectar" : "Conectar Mercado Libre"}
                  </a>
                </Button>
              ) : null}
              {ml.account ? (
                <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => run(() => checkMlSalesNow())}>
                  {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                  Buscar ventas pendientes
                </Button>
              ) : null}
              {ml.account ? (
                <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => confirm("¿Desconectar Mercado Libre? Las ventas dejarán de entregarse solas.") && run(() => disconnectMercadoLibre())}>
                  <Unplug />
                  Desconectar
                </Button>
              ) : null}
            </div>
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">URL de notificaciones (tema orders_v2)</p>
              <button type="button" onClick={() => copy(ml.notifyUrl, "URL copiada")} className="inline-flex max-w-full items-center gap-1.5 truncate font-mono text-xs hover:text-primary">
                <span className="truncate">{ml.notifyUrl}</span>
                <Copy className="size-3.5 shrink-0" />
              </button>
            </div>
            {ml.account ? <RecheckOrder /> : null}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h4 className="text-sm font-semibold">Generar códigos</h4>
        <GenerateCodes />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h4 className="text-sm font-semibold">
            Códigos <span className="font-normal text-muted-foreground">({data.matching.toLocaleString("es-CL")})</span>
          </h4>
          <form action="/admin#licencias" className="flex gap-2">
            {data.filter !== "todos" ? <input type="hidden" name="codigos" value={data.filter} /> : null}
            <Input name="codigo" defaultValue={data.q} placeholder="Código, venta o correo" aria-label="Buscar código" className="h-9 w-56 max-w-full" />
            <Button type="submit" variant="outline" size="sm" className="h-9">
              <Search />
              <span className="sr-only">Buscar</span>
            </Button>
          </form>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            ["todos", "Todos"],
            ["disponible", "Disponibles"],
            ["reservado", "Reservados"],
            ["usado", "Usados"],
            ["anulado", "Anulados"],
          ].map(([value, label]) => (
            <Link
              key={value}
              href={href(value)}
              scroll={false}
              className={cn("rounded-full border px-3 py-1 text-sm transition-colors", data.filter === value ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-muted")}
            >
              {label}
            </Link>
          ))}
        </div>
        {data.codes.length ? (
          <div className="@container overflow-hidden rounded-xl border bg-card">
            <ul>
              {data.codes.map((row) => (
                <CodeLine key={row.id} row={row} onVoid={setVoiding} onDeliver={setDelivering} />
              ))}
            </ul>
            {data.matching > data.codes.length ? <p className="border-t px-3 py-2 text-xs text-muted-foreground">Se muestran los 100 más recientes. Busca para encontrar otros.</p> : null}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{data.q || data.filter !== "todos" ? "No hay códigos con ese filtro." : "Todavía no hay códigos. Genera los primeros arriba."}</p>
        )}
      </section>

      <section className="space-y-3">
        <h4 className="text-sm font-semibold">Registro</h4>
        {data.logs.length ? (
          <ol className="max-h-96 divide-y overflow-y-auto rounded-xl border bg-card text-sm">
            {data.logs.map((l) => (
              <li key={l.id} className="grid gap-1 px-3 py-2 sm:grid-cols-[9rem_7rem_minmax(0,1fr)] sm:gap-3">
                <span className="tabular text-xs text-muted-foreground">{l.at}</span>
                <span className={cn("text-xs font-semibold", l.kind === "envio_fallido" || l.kind === "error" || l.kind === "conexion_error" || l.kind === "revisar" || l.kind === "sin_codigos" ? "text-destructive" : "text-muted-foreground")}>
                  {LOG_LABEL[l.kind] ?? l.kind}
                </span>
                <span className="min-w-0 break-words">{l.detail}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">Aún no hay movimientos.</p>
        )}
      </section>

      <VoidDialog row={voiding} onClose={() => setVoiding(null)} />
      <DeliverDialog row={delivering} onClose={() => setDelivering(null)} />
    </div>
  )
}
