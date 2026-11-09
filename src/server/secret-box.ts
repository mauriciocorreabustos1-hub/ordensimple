import "server-only"
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto"

// Cifrado de lo que se guarda en la base (sesiones de Mercado Pago y Mercado Libre). La clave sale de BETTER_AUTH_SECRET
// y cambia según el uso: lo cifrado para una cosa no se puede abrir para otra.

export function deriveKey(purpose: string) {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) throw new Error("Falta BETTER_AUTH_SECRET")
  return Buffer.from(hkdfSync("sha256", secret, "ordensimple", purpose, 32))
}

export function sealSecret(plain: string, purpose: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", deriveKey(purpose), iv)
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${data.toString("base64url")}`
}

export function openSecret(stored: string, purpose: string) {
  const [v, iv, tag, data] = stored.split(".")
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Dato cifrado inválido")
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(purpose), Buffer.from(iv, "base64url"))
  decipher.setAuthTag(Buffer.from(tag, "base64url"))
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8")
}
