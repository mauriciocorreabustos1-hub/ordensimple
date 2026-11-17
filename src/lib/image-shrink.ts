/** Lo que aceptan los botones para elegir imagen: fotos comunes y las HEIC de Mac y iPhone. */
export const IMAGE_ACCEPT = "image/*,.heic,.heif"

/** Fotos HEIC/HEIF (Mac y iPhone). En Windows a veces llegan sin tipo, por eso también se mira la extensión. */
export function isHeicFile(file: File) {
  return /^image\/hei[cf]/.test(file.type) || /\.hei[cf]$/i.test(file.name)
}

/** ¿Es una imagen que podemos usar? */
export function isImageFile(file: File) {
  return file.type.startsWith("image/") || isHeicFile(file)
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error("imagen"))
    i.src = url
  })
}

/**
 * Achica una imagen en el navegador (por defecto a 256 px como máximo, sin perder la transparencia) y la entrega
 * como "data:image/webp;base64,…" lista para guardar. Así se suben archivos de pocos KB.
 */
export async function shrinkImage(
  file: File,
  max = 256,
  square = false,
  format: "webp" | "jpeg" = "webp",
  /** Lo más que acepta el servidor para esa imagen (los envíos tienen un tope de 1 MB). */
  maxBytes = 280 * 1024,
): Promise<string> {
  let url = URL.createObjectURL(file)
  try {
    let img: HTMLImageElement
    try {
      img = await loadImage(url)
    } catch (error) {
      // Fotos de Mac y iPhone (HEIC): Safari las lee, pero Chrome y Edge no. Se pasan a JPG aquí mismo, en el equipo.
      if (!isHeicFile(file)) throw error
      const { heicTo } = await import("heic-to/csp")
      const jpeg = await heicTo({ blob: file, type: "image/jpeg", quality: 0.92 })
      URL.revokeObjectURL(url)
      url = URL.createObjectURL(jpeg)
      img = await loadImage(url)
    }
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")!
    const draw = (limit: number) => {
      if (square) {
        // Recorte cuadrado al centro (fotos de perfil).
        const side = Math.min(img.naturalWidth, img.naturalHeight)
        const size = Math.min(limit, side)
        canvas.width = size
        canvas.height = size
        ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size)
      } else {
        const scale = Math.min(1, limit / Math.max(img.naturalWidth, img.naturalHeight))
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      }
    }
    // JPEG no tiene transparencia: lo transparente queda blanco en vez de negro.
    const toJpeg = (quality: number) => {
      ctx.globalCompositeOperation = "destination-over"
      ctx.fillStyle = "#fff"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.globalCompositeOperation = "source-over"
      return canvas.toDataURL("image/jpeg", quality)
    }
    // Lo que pesa la imagen ya decodificada (el texto base64 ocupa 4/3).
    const fits = (dataUrl: string) => ((dataUrl.length - dataUrl.indexOf(",") - 1) * 3) / 4 <= maxBytes

    draw(max)
    let out: string
    if (format === "jpeg") out = toJpeg(0.86)
    else {
      const webp = canvas.toDataURL("image/webp", 0.9)
      // Safari (iPhone y Mac) no genera WebP: entrega PNG, que en una foto puede pasar de 1 MB.
      out = webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png")
    }
    // Si pesa más de lo que acepta el servidor: JPEG con menos calidad y, si no alcanza, más chica.
    let limit = max
    for (let i = 0; !fits(out) && i < 6; i++) {
      if (i > 0 && i % 2 === 0) {
        limit = Math.max(64, Math.round(limit * 0.75))
        draw(limit)
      }
      out = toJpeg(i % 2 === 0 ? 0.82 : 0.68)
    }
    return out
  } finally {
    URL.revokeObjectURL(url)
  }
}
