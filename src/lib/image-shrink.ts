/**
 * Achica una imagen en el navegador (por defecto a 256 px como máximo, sin perder la transparencia) y la entrega
 * como "data:image/webp;base64,…" lista para guardar. Así se suben archivos de pocos KB.
 */
export async function shrinkImage(file: File, max = 256, square = false, format: "webp" | "jpeg" = "webp"): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error("imagen"))
      i.src = url
    })
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")!
    const paint = () => {
      // JPEG no tiene transparencia: lo transparente queda blanco en vez de negro.
      if (format !== "jpeg") return
      ctx.globalCompositeOperation = "destination-over"
      ctx.fillStyle = "#fff"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.globalCompositeOperation = "source-over"
    }
    if (square) {
      // Recorte cuadrado al centro (fotos de perfil).
      const side = Math.min(img.naturalWidth, img.naturalHeight)
      const size = Math.min(max, side)
      canvas.width = size
      canvas.height = size
      ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size)
    } else {
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    }
    paint()
    if (format === "jpeg") return canvas.toDataURL("image/jpeg", 0.86)
    const webp = canvas.toDataURL("image/webp", 0.9)
    // Navegadores que no generan WebP devuelven PNG.
    return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png")
  } finally {
    URL.revokeObjectURL(url)
  }
}
