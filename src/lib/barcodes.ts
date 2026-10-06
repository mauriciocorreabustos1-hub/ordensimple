/** Todos los códigos de barras de un producto: el principal (sku) y los adicionales. */
export function productCodes(p: { sku?: string | null; barcodes?: { code: string }[] }) {
  return [p.sku, ...(p.barcodes ?? []).map((b) => b.code)].filter((c): c is string => Boolean(c && c.trim()))
}

/** Quita espacios y repetidos, conservando el orden. */
export function cleanCodes(codes: (string | null | undefined)[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of codes) {
    const code = raw?.trim()
    if (!code || seen.has(code.toLowerCase())) continue
    seen.add(code.toLowerCase())
    out.push(code)
  }
  return out
}

/** Busca el producto que tenga ese código entre todos sus códigos. */
export function findByCode<T extends { codes?: string[] }>(products: T[], code: string) {
  const wanted = code.trim().toLowerCase()
  return products.find((p) => p.codes?.some((c) => c.trim().toLowerCase() === wanted))
}
