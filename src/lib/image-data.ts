import "server-only"

/** Valida y separa un "data:image/…;base64,…" (en el servidor). */
export function parseImageDataUrl(dataUrl: string, maxBytes = 300 * 1024) {
  const match = /^data:(image\/(?:webp|png|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl ?? "")
  if (!match) return { error: "Usa una imagen PNG, JPG o WebP." } as const
  const data = Buffer.from(match[2], "base64")
  if (data.length > maxBytes) return { error: "La imagen es muy pesada. Prueba con otra más chica." } as const
  if (!looksLike(match[1], data)) return { error: "Usa una imagen PNG, JPG o WebP." } as const
  return { type: match[1], data } as const
}

/** Primeros bytes de cada formato: así nadie guarda otra cosa (por ejemplo una página) disfrazada de imagen. */
function looksLike(type: string, data: Buffer) {
  if (type === "image/png") return data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  if (type === "image/jpeg") return data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff
  return data.subarray(0, 4).toString("latin1") === "RIFF" && data.subarray(8, 12).toString("latin1") === "WEBP"
}
