import "server-only"

/** Valida y separa un "data:image/…;base64,…" (en el servidor). */
export function parseImageDataUrl(dataUrl: string, maxBytes = 300 * 1024) {
  const match = /^data:(image\/(?:webp|png|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl ?? "")
  if (!match) return { error: "Usa una imagen PNG, JPG o WebP." } as const
  const data = Buffer.from(match[2], "base64")
  if (data.length > maxBytes) return { error: "La imagen es muy pesada. Prueba con otra más chica." } as const
  return { type: match[1], data } as const
}
