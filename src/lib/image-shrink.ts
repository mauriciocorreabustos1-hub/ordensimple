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
export async function shrinkImage(file: File, max = 256, square = false, format: "webp" | "jpeg" = "webp"): Promise<string> {
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
