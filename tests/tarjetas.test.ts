// Pruebas de las tarjetas de presentación: enlaces, limpieza de datos, privacidad y archivo de contacto.
// Correr con:  npm run test:tarjetas

import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { buildVCard, contactCardSchema, isValidSlug, normalizePhone, normalizeSocial, normalizeWebsite, slugify, toPublicCard, type ContactCardRow } from "@/lib/contact-card"

const row = (over: Partial<ContactCardRow> = {}): ContactCardRow => ({
  slug: "mauro",
  fullName: "Mauro Díaz Soto",
  jobTitle: "Gerente, ventas; zona sur",
  company: "Almacén Don Pedro",
  phone: "+56912345678",
  whatsapp: "+56987654321",
  email: "mauro@correo.cl",
  website: "https://miempresa.cl",
  instagram: "mauro",
  facebook: null,
  linkedin: "in/mauro",
  tiktok: null,
  x: null,
  published: ["jobTitle", "company", "phone", "whatsapp", "email", "website", "instagram", "linkedin"],
  photoUpdatedAt: null,
  updatedAt: new Date(0),
  ...over,
})

describe("enlaces", () => {
  test("slugify quita tildes y espacios", () => assert.equal(slugify("José Núñez  Peña"), "jose-nunez-pena"))
  test("valida el formato y las palabras reservadas", () => {
    assert.ok(isValidSlug("mauro"))
    assert.ok(isValidSlug("mauro-2"))
    for (const bad of ["ab", "Mauro", "-mauro", "mauro-", "a--b", "admin", "x".repeat(31), "ma uro"]) assert.ok(!isValidSlug(bad), bad)
  })
})

describe("limpieza de datos", () => {
  test("teléfonos", () => {
    assert.equal(normalizePhone("9 1234 5678"), "+56912345678")
    assert.equal(normalizePhone("+56 9 1234 5678"), "+56912345678")
    assert.equal(normalizePhone("123"), null)
  })
  test("el sitio web solo acepta http y https", () => {
    assert.equal(normalizeWebsite("miempresa.cl"), "https://miempresa.cl")
    assert.equal(normalizeWebsite("javascript:alert(1)"), null)
    assert.equal(normalizeWebsite("data:text/html,x"), null)
    assert.equal(normalizeWebsite("https://user:clave@miempresa.cl"), null)
  })
  test("redes: usuario, @usuario o enlace, y nunca otro sitio", () => {
    assert.equal(normalizeSocial("instagram", "@mauro.cl"), "mauro.cl")
    assert.equal(normalizeSocial("instagram", "https://www.instagram.com/mauro/"), "mauro")
    assert.equal(normalizeSocial("tiktok", "https://www.tiktok.com/@mauro"), "mauro")
    assert.equal(normalizeSocial("linkedin", "linkedin.com/company/orden"), "company/orden")
    assert.equal(normalizeSocial("linkedin", "mauro"), "in/mauro")
    assert.equal(normalizeSocial("x", "https://twitter.com/mauro"), "mauro")
    assert.equal(normalizeSocial("instagram", "https://sitio-falso.com/mauro"), null)
    assert.equal(normalizeSocial("instagram", "<script>"), null)
  })
  test("lo ya guardado se puede volver a guardar igual (al editar la tarjeta)", () => {
    for (const [kind, raw] of [["linkedin", "https://www.linkedin.com/in/mauro/"], ["linkedin", "company/orden"], ["instagram", "@mauro.cl"], ["tiktok", "@mauro"], ["x", "twitter.com/mauro"], ["facebook", "facebook.com/orden.simple"]] as const) {
      const saved = normalizeSocial(kind, raw)
      assert.ok(saved, raw)
      assert.equal(normalizeSocial(kind, saved), saved, raw)
    }
    assert.equal(normalizePhone(normalizePhone("9 1234 5678")!), "+56912345678")
    assert.equal(normalizeWebsite(normalizeWebsite("miempresa.cl/tienda")!), "https://miempresa.cl/tienda")
  })

  test("el formulario rechaza datos inválidos", () => {
    const base = { active: true, fullName: "Mauro", jobTitle: "", company: "", phone: "", whatsapp: "", email: "", website: "", instagram: "", facebook: "", linkedin: "", tiktok: "", x: "", published: [] }
    assert.ok(contactCardSchema.safeParse(base).success)
    assert.ok(!contactCardSchema.safeParse({ ...base, website: "javascript:alert(1)" }).success)
    assert.ok(!contactCardSchema.safeParse({ ...base, email: "no-es-correo" }).success)
    assert.ok(!contactCardSchema.safeParse({ ...base, published: ["clave"] }).success)
  })
})

describe("privacidad", () => {
  test("sin autorización, solo se publica el nombre", () => {
    const card = toPublicCard(row({ published: [], photoUpdatedAt: new Date(1) }), "/logo/x")
    assert.equal(card.fullName, "Mauro Díaz Soto")
    for (const key of ["jobTitle", "company", "phone", "whatsapp", "whatsappUrl", "email", "website", "photoUrl", "logoUrl"] as const) assert.equal(card[key], null, key)
    assert.deepEqual(card.socials, [])
    assert.ok(!JSON.stringify(card).includes("mauro@correo.cl"))
    assert.ok(!JSON.stringify(card).includes("912345678"))
  })
  test("publica solo los campos autorizados", () => {
    const card = toPublicCard(row({ published: ["email"] }), null)
    assert.equal(card.email, "mauro@correo.cl")
    assert.equal(card.phone, null)
  })
  test("el archivo de contacto tampoco incluye lo no autorizado", () => {
    const vcf = buildVCard(toPublicCard(row({ published: ["email"] }), null), { url: "https://ordensimple.cl/perfil/mauro" })
    assert.match(vcf, /EMAIL;TYPE=INTERNET:mauro@correo.cl/)
    assert.doesNotMatch(vcf, /TEL/)
    assert.doesNotMatch(vcf, /Gerente/)
  })
})

describe("archivo de contacto", () => {
  const vcf = buildVCard(toPublicCard(row(), null), { url: "https://ordensimple.cl/perfil/mauro", photo: { type: "image/jpeg", base64: "A".repeat(500) } })
  const unfolded = vcf.replace(/\r\n /g, "")

  test("estructura válida con saltos CRLF", () => {
    assert.ok(vcf.startsWith("BEGIN:VCARD\r\nVERSION:3.0\r\n"))
    assert.ok(vcf.endsWith("END:VCARD\r\n"))
    assert.doesNotMatch(vcf.replace(/\r\n/g, ""), /[\r\n]/)
  })
  test("separa nombre y apellidos y escapa comas y punto y coma", () => {
    assert.match(unfolded, /N:Díaz Soto;Mauro;;;/)
    assert.match(unfolded, /TITLE:Gerente\\, ventas\\; zona sur/)
  })
  test("ninguna línea pasa de 75 bytes", () => {
    for (const line of vcf.split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75, line)
  })
  test("no parte letras con tilde al cortar líneas largas", () => {
    const long = buildVCard(toPublicCard(row({ fullName: "ñ".repeat(120), published: [] }), null), { url: "https://x.cl/perfil/a" })
    assert.ok(!long.includes("�"))
    assert.ok(long.replace(/\r\n /g, "").includes("ñ".repeat(120)))
  })
  test("incluye teléfono, WhatsApp, redes y foto JPEG", () => {
    assert.match(unfolded, /TEL;TYPE=CELL:\+56912345678/)
    assert.match(unfolded, /item1\.TEL;TYPE=CELL:\+56987654321/)
    assert.match(unfolded, /X-SOCIALPROFILE;TYPE=instagram:https:\/\/www\.instagram\.com\/mauro/)
    assert.match(unfolded, /PHOTO;ENCODING=b;TYPE=JPEG:A{500}/)
  })
  test("no incrusta WebP, que los contactos no leen", () => {
    const webp = buildVCard(toPublicCard(row(), null), { url: "https://x.cl", photo: { type: "image/webp", base64: "AAAA" } })
    assert.doesNotMatch(webp, /PHOTO/)
  })
})
