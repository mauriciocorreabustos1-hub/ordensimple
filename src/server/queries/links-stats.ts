import "server-only"
import { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { zonedTimeToUtc } from "@/lib/dates"
import { BLOCK_INFO, type LinkContent } from "@/lib/links"

export type LinkStats = Awaited<ReturnType<typeof linkStats>>

const key = (d: Date) => d.toISOString().slice(0, 10)

/** Días entre dos fechas AAAA-MM-DD, ambos incluidos. */
export function dayKeys(from: string, to: string) {
  const out: string[] = []
  const end = new Date(`${to}T00:00:00Z`)
  for (let d = new Date(`${from}T00:00:00Z`); d <= end && out.length < 400; d.setUTCDate(d.getUTCDate() + 1)) out.push(key(d))
  return out
}

/**
 * Estadísticas reales de la página en un rango de días (en la zona del negocio). Visitantes únicos: personas
 * distintas por día, sumadas (la huella anónima cambia cada día, así que es una estimación). Tasa de clics:
 * clics divididos por visitas.
 */
export async function linkStats(pageId: string, content: LinkContent | null, range: { from: string; to: string }, timezone: string, detailed: boolean) {
  const [fy, fm, fd] = range.from.split("-").map(Number)
  const [ty, tm, td] = range.to.split("-").map(Number)
  const start = zonedTimeToUtc(fy, fm, fd, timezone)
  const end = zonedTimeToUtc(ty, tm, td + 1, timezone)
  const where = { pageId, createdAt: { gte: start, lt: end } }

  const [daily, uniques, clicksByBlock, sources, devices, countries] = await Promise.all([
    db.$queryRaw<{ day: string; kind: "VIEW" | "CLICK"; n: bigint }[]>(Prisma.sql`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}, 'YYYY-MM-DD') AS day, kind, count(*) AS n
      FROM "link_event"
      WHERE "pageId" = ${pageId} AND "createdAt" >= ${start} AND "createdAt" < ${end}
      GROUP BY 1, 2`),
    db.$queryRaw<{ n: bigint }[]>(Prisma.sql`
      SELECT count(DISTINCT (visitor, to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}, 'YYYY-MM-DD'))) AS n
      FROM "link_event"
      WHERE "pageId" = ${pageId} AND kind = 'VIEW' AND "createdAt" >= ${start} AND "createdAt" < ${end}`),
    db.linkEvent.groupBy({ by: ["blockId"], where: { ...where, kind: "CLICK" }, _count: { _all: true } }),
    detailed ? db.linkEvent.groupBy({ by: ["source"], where: { ...where, kind: "VIEW" }, _count: { _all: true } }) : [],
    detailed ? db.linkEvent.groupBy({ by: ["device"], where: { ...where, kind: "VIEW" }, _count: { _all: true } }) : [],
    detailed ? db.linkEvent.groupBy({ by: ["country"], where: { ...where, kind: "VIEW" }, _count: { _all: true } }) : [],
  ])

  const series = dayKeys(range.from, range.to).map((day) => ({
    day,
    views: Number(daily.find((r) => r.day === day && r.kind === "VIEW")?.n ?? 0),
    clicks: Number(daily.find((r) => r.day === day && r.kind === "CLICK")?.n ?? 0),
  }))
  const views = series.reduce((s, r) => s + r.views, 0)
  const clicks = series.reduce((s, r) => s + r.clicks, 0)

  const blockName = (id: string | null) => {
    const b = content?.blocks.find((x) => x.id === id)
    if (!b) return { label: "Bloque que ya borraste", type: null }
    const title = "title" in b && b.title ? b.title : BLOCK_INFO[b.type].label
    return { label: title, type: BLOCK_INFO[b.type].label }
  }
  const sorted = <T extends { _count: { _all: number } }>(rows: T[]) => [...rows].sort((a, b) => b._count._all - a._count._all)

  return {
    views,
    uniques: Number(uniques[0]?.n ?? 0),
    clicks,
    ctr: views ? clicks / views : null,
    series,
    links: sorted(clicksByBlock).map((r) => ({ id: r.blockId ?? "?", ...blockName(r.blockId), clicks: r._count._all })),
    sources: sorted(sources).map((r) => ({ key: r.source ?? "directo", n: r._count._all })),
    devices: sorted(devices).map((r) => ({ key: r.device ?? "desktop", n: r._count._all })),
    countries: sorted(countries).map((r) => ({ key: r.country, n: r._count._all })),
  }
}
