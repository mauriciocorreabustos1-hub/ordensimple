"use client"

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts"

type Point = { day: string; views: number; clicks: number }

const label = (day: string, long = false) =>
  new Date(`${day}T12:00:00`).toLocaleDateString("es-CL", long ? { weekday: "long", day: "numeric", month: "long" } : { day: "numeric", month: "short" })

function Tip({ active, payload }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload as Point
  return (
    <div className="min-w-40 rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium first-letter:uppercase">{label(p.day, true)}</p>
      <p className="flex justify-between gap-4">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2 rounded-sm bg-primary" /> Visitas
        </span>
        <span className="font-semibold tabular-nums">{p.views}</span>
      </p>
      <p className="flex justify-between gap-4">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2 rounded-sm bg-[color-mix(in_oklch,var(--primary)_40%,var(--foreground))]" /> Clics
        </span>
        <span className="font-semibold tabular-nums">{p.clicks}</span>
      </p>
    </div>
  )
}

/** Visitas y clics por día. */
export function VisitsChart({ data }: { data: Point[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="lk-views" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="day" tickFormatter={(d: string) => label(d)} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} minTickGap={18} tickMargin={8} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={34} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
        <Tooltip content={(props) => <Tip {...(props as TooltipContentProps<number, string>)} />} cursor={{ stroke: "var(--border)" }} />
        <Area type="monotone" dataKey="views" name="Visitas" stroke="var(--primary)" strokeWidth={2} fill="url(#lk-views)" />
        <Area type="monotone" dataKey="clicks" name="Clics" stroke="color-mix(in oklch, var(--primary) 40%, var(--foreground))" strokeWidth={2} strokeDasharray="4 3" fill="transparent" />
      </AreaChart>
    </ResponsiveContainer>
  )
}
