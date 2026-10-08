/** "hace 5 min", "hace 3 h", "ayer", "hace 12 días". */
export function ago(d: Date, now = new Date()) {
  const min = Math.floor((now.getTime() - d.getTime()) / 60_000)
  if (min < 2) return "ahora"
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const days = Math.floor(h / 24)
  if (days === 1) return "ayer"
  if (days < 60) return `hace ${days} días`
  return `hace ${Math.floor(days / 30)} meses`
}

/** Desde qué equipo entró la última vez (según el navegador). */
export function device(userAgent: string | null | undefined) {
  if (!userAgent) return null
  const os = /iPhone|iPad/i.test(userAgent) ? "iPhone" : /Android/i.test(userAgent) ? "Android" : /Windows/i.test(userAgent) ? "Windows" : /Mac OS/i.test(userAgent) ? "Mac" : null
  const mobile = /Mobile|Android|iPhone|iPad/i.test(userAgent)
  return `${mobile ? "Celular" : "Computador"}${os ? ` (${os})` : ""}`
}
