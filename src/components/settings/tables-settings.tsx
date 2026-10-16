"use client"

import * as React from "react"
import { Minus, Plus, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { updatePreferences } from "@/server/actions/settings"

const MAX = 200

/** Mesas del restaurante: cuántas hay y lugares con nombre propio. Se usan al abrir comandas. */
export function TablesSettings({ count: initialCount, extras: initialExtras, disabled }: { count: number; extras: string[]; disabled?: boolean }) {
  const [count, setCount] = React.useState(initialCount)
  const [extras, setExtras] = React.useState(initialExtras)
  const [draft, setDraft] = React.useState("")
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined)

  function save(data: { tableCount?: number; tableExtras?: string[] }, message: string) {
    clearTimeout(timer.current)
    // La cantidad se guarda al dejar de tocar los botones, no en cada toque.
    timer.current = setTimeout(async () => {
      const r = await updatePreferences(data)
      if (r.ok) toast.success(message)
      else toast.error(r.message)
    }, 600)
  }

  function changeCount(next: number) {
    const value = Math.max(0, Math.min(MAX, Math.round(next) || 0))
    setCount(value)
    save({ tableCount: value }, value ? `Guardado: ${value} mesa${value === 1 ? "" : "s"}` : "Guardado: sin mesas numeradas")
  }

  function addExtra() {
    const name = draft.trim().slice(0, 30)
    if (!name) return
    if (extras.some((e) => e.toLowerCase() === name.toLowerCase())) return toast.info(`«${name}» ya está en la lista.`)
    if (extras.length >= 30) return toast.error("Máximo 30 lugares con nombre.")
    const next = [...extras, name]
    setExtras(next)
    setDraft("")
    save({ tableExtras: next }, `Agregado: ${name}`)
  }

  function removeExtra(name: string) {
    const next = extras.filter((e) => e !== name)
    setExtras(next)
    save({ tableExtras: next }, `Quitado: ${name}`)
  }

  const preview = [count ? (count === 1 ? "Mesa 1" : `Mesa 1 a Mesa ${count}`) : null, ...extras].filter(Boolean).join(", ")

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">¿Cuántas mesas tienes?</p>
          <p className="text-xs text-muted-foreground">Se numeran solas: Mesa 1, Mesa 2…</p>
        </div>
        <div className="flex items-center rounded-xl border">
          <Button type="button" variant="ghost" size="icon" aria-label="Una mesa menos" disabled={disabled || count <= 0} onClick={() => changeCount(count - 1)}>
            <Minus />
          </Button>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX}
            value={count}
            disabled={disabled}
            onChange={(e) => changeCount(Number(e.target.value))}
            aria-label="Cantidad de mesas"
            className="tabular h-10 w-16 border-0 text-center text-base font-semibold shadow-none focus-visible:ring-0 [&::-webkit-inner-spin-button]:appearance-none"
          />
          <Button type="button" variant="ghost" size="icon" aria-label="Una mesa más" disabled={disabled || count >= MAX} onClick={() => changeCount(count + 1)}>
            <Plus />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Otros lugares</p>
          <p className="text-xs text-muted-foreground">Barra, terraza, salón VIP, para llevar, delivery… lo que uses para separar los pedidos.</p>
        </div>
        {extras.length ? (
          <div className="flex flex-wrap gap-2">
            {extras.map((e) => (
              <span key={e} className="inline-flex items-center gap-1 rounded-full border bg-card py-1 pr-1 pl-3 text-sm">
                {e}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => removeExtra(e)}
                  aria-label={`Quitar ${e}`}
                  className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            addExtra()
          }}
        >
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ej.: Barra, Terraza 1" maxLength={30} disabled={disabled} aria-label="Nuevo lugar" />
          <Button type="submit" variant="outline" disabled={disabled || !draft.trim()}>
            <Plus />
            Agregar
          </Button>
        </form>
      </div>

      <p className="rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        {preview ? (
          <>
            Al abrir una comanda verás: <span className="font-medium text-foreground">{preview}</span>.
          </>
        ) : (
          "No tienes mesas ni lugares: al abrir una comanda escribirás el nombre."
        )}
      </p>
    </div>
  )
}
