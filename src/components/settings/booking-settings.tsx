"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { ChoiceChips } from "@/components/admin/choice-chips"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { WEEKDAYS, type BookingHours } from "@/lib/booking"
import { updatePreferences } from "@/server/actions/settings"

/** Reserva tu hora: horario de atención por día y reglas para que los clientes reserven solos. */
export function BookingSettings({
  enabled: initialEnabled,
  hours: initialHours,
  slotMin: initialSlot,
  noticeMin: initialNotice,
  maxDays: initialMax,
  storeReady,
  servicesWithDuration,
  disabled,
}: {
  enabled: boolean
  hours: BookingHours
  slotMin: number
  noticeMin: number
  maxDays: number
  /** La página pública está publicada (las reservas se hacen ahí). */
  storeReady: boolean
  /** Cuántos servicios tienen duración (solo esos se pueden reservar). */
  servicesWithDuration: number
  disabled?: boolean
}) {
  const [enabled, setEnabled] = React.useState(initialEnabled)
  const [hours, setHours] = React.useState(initialHours)
  const [slotMin, setSlotMin] = React.useState(initialSlot)
  const [noticeMin, setNoticeMin] = React.useState(initialNotice)
  const [maxDays, setMaxDays] = React.useState(initialMax)
  const [pending, startTransition] = React.useTransition()

  const setDay = (i: number, value: BookingHours[number]) => setHours((h) => h.map((d, k) => (k === i ? value : d)))
  const invalid = hours.some((h) => h && h.open >= h.close)

  function save(nextEnabled = enabled) {
    if (invalid) return void toast.error("Revisa los horarios: la hora de cierre debe ser después de la de apertura.")
    startTransition(async () => {
      const r = await updatePreferences({
        bookingEnabled: nextEnabled,
        bookingHours: hours,
        bookingSlotMin: slotMin as 10 | 15 | 20 | 30 | 45 | 60,
        bookingMinNoticeMin: noticeMin,
        bookingMaxDays: maxDays,
      })
      if (!r.ok) return void toast.error(r.message)
      setEnabled(nextEnabled)
      toast.success(nextEnabled ? "Reservas guardadas" : "Reservas desactivadas")
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
        <label htmlFor="booking-enabled" className="space-y-0.5">
          <span className="block text-sm font-medium">Tus clientes reservan hora en tu página</span>
          <span className="block text-xs text-muted-foreground">
            {!storeReady
              ? "Primero publica tu página arriba (dirección y WhatsApp): ahí aparece «Reserva tu hora»."
              : servicesWithDuration === 0
                ? "Agrega la duración a tus servicios (en Servicios) para que se puedan reservar."
                : `Se pueden reservar ${servicesWithDuration} servicio${servicesWithDuration === 1 ? "" : "s"}. Te llega un aviso al celular con cada reserva.`}
          </span>
        </label>
        <Switch id="booking-enabled" checked={enabled} disabled={disabled || pending} onCheckedChange={(v) => save(v)} />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Horario de atención</p>
        <ul className="divide-y rounded-xl border">
          {WEEKDAYS.map((name, i) => {
            const h = hours[i]
            return (
              <li key={name} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
                <label className="flex w-32 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(h)}
                    disabled={disabled}
                    onChange={(e) => setDay(i, e.target.checked ? { open: "09:00", close: "19:00" } : null)}
                    className="size-4 accent-[var(--primary)]"
                  />
                  {name}
                </label>
                {h ? (
                  <span className="flex items-center gap-2 text-sm">
                    <Input type="time" step={900} value={h.open} disabled={disabled} onChange={(e) => setDay(i, { ...h, open: e.target.value })} className="h-9 w-28" aria-label={`${name}: abre`} />
                    a
                    <Input type="time" step={900} value={h.close} disabled={disabled} onChange={(e) => setDay(i, { ...h, close: e.target.value })} className="h-9 w-28" aria-label={`${name}: cierra`} aria-invalid={h.open >= h.close} />
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">Cerrado</span>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <p className="text-sm font-medium">Horas cada</p>
          <ChoiceChips options={[15, 30, 60].map((m) => ({ value: m, label: m === 60 ? "1 hora" : `${m} min` }))} value={slotMin} onChange={setSlotMin} />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Reservar con al menos</p>
          <ChoiceChips
            options={[
              { value: 0, label: "Al tiro" },
              { value: 60, label: "1 hora" },
              { value: 180, label: "3 horas" },
              { value: 1440, label: "1 día" },
            ]}
            value={noticeMin}
            onChange={setNoticeMin}
          />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Hasta</p>
          <ChoiceChips options={[7, 14, 30, 60].map((d) => ({ value: d, label: `${d} días` }))} value={maxDays} onChange={setMaxDays} />
        </div>
      </div>

      <Button onClick={() => save()} disabled={disabled || pending || invalid}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        Guardar horario
      </Button>
    </div>
  )
}
