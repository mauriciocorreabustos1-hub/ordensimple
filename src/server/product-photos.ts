import "server-only"
import { del } from "@vercel/blob"

/** Las fotos de productos van en Vercel Blob: solo funciona si el almacenamiento está conectado al proyecto. */
export function photosConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

/** Solo se aceptan (y se borran) fotos guardadas en nuestro Vercel Blob, nunca direcciones de otros sitios. */
export function isOurPhoto(url: string | null | undefined): url is string {
  if (!url) return false
  try {
    const u = new URL(url)
    return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com")
  } catch {
    return false
  }
}

/** Borra una foto que ya no se usa (si falla, no pasa nada: queda huérfana pero la app sigue). */
export async function deletePhoto(url: string | null | undefined) {
  if (!isOurPhoto(url) || !photosConfigured()) return
  try {
    await del(url)
  } catch (error) {
    console.error("[fotos] no se pudo borrar", error)
  }
}
