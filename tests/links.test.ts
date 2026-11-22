// Pruebas de OrdenSimple Links: nombres de usuario, enlaces seguros, bloques, plan Gratis/Pro, contraste y estadísticas.
// Correr con:  npm run test:links

import assert from "node:assert/strict"
import { describe, test } from "node:test"
import {
  blockSchema,
  contentSchema,
  contrast,
  contrastIssues,
  detectDevice,
  detectSource,
  fixContrast,
  initialContent,
  isBlockLive,
  isBot,
  newBlockId,
  normalizeLinkSocial,
  parseVideo,
  proFeaturesUsed,
  publishProblems,
  readContent,
  safeUrl,
  slugProblem,
  suggestSlug,
  suggestedBlocks,
  templateTheme,
  TEMPLATES,
  toFreeContent,
  type LinkBlock,
  type LinkContent,
} from "@/lib/links"

const base = () => initialContent({ name: "Café Central", whatsapp: "+56912345678", storeUrl: null, canBook: false })
const link = (over: Partial<Extract<LinkBlock, { type: "link" }>> = {}): LinkBlock => ({
  id: newBlockId(),
  type: "link",
  hidden: false,
  startsAt: null,
  endsAt: null,
  title: "Mi tienda",
  url: "https://cafecentral.cl",
  icon: null,
  thumb: null,
  ...over,
})

describe("nombre de usuario", () => {
  test("acepta nombres simples", () => {
    for (const s of ["cafecentral", "tienda-bella", "abc", "consultora2026"]) assert.equal(slugProblem(s), null, s)
  })
  test("rechaza caracteres inválidos, largo y guiones mal puestos", () => {
    for (const s of ["ab", "Cafe", "café", "con espacio", "-inicio", "fin-", "doble--guion", "a".repeat(31), "hola!", "<script>"]) assert.notEqual(slugProblem(s), null, s)
  })
  test("rechaza palabras reservadas y suplantación", () => {
    for (const s of ["admin", "api", "soporte", "ordensimple", "ordensimple-oficial", "orden-simple", "bancoestado", "mercadopago", "instagram", "sii"]) {
      assert.notEqual(slugProblem(s), null, s)
    }
  })
  test("propone un nombre a partir del negocio", () => {
    assert.equal(suggestSlug("Café Central"), "cafecentral")
    assert.equal(suggestSlug("Ñandú & Co."), "nanduco")
    assert.equal(slugProblem(suggestSlug("Peluquería Lucía")), null)
  })
})

describe("enlaces seguros", () => {
  test("completa https y acepta direcciones normales", () => {
    assert.equal(safeUrl("cafecentral.cl"), "https://cafecentral.cl")
    assert.equal(safeUrl("https://www.instagram.com/cafe"), "https://www.instagram.com/cafe")
  })
  test("rechaza esquemas peligrosos, credenciales escondidas, IP y red local", () => {
    const bad = ["javascript:alert(1)", "data:text/html,hola", "file:///etc/passwd", "https://banco.cl@malo.com", "http://192.168.1.1", "http://localhost:3000", "https://servidor.local", "https://[::1]/", "noesunaurl", ""]
    for (const u of bad) assert.equal(safeUrl(u), null, u)
  })
  test("solo incrusta videos de YouTube y Vimeo", () => {
    assert.deepEqual(parseVideo("https://youtu.be/dQw4w9WgXcQ"), { provider: "youtube", id: "dQw4w9WgXcQ" })
    assert.deepEqual(parseVideo("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10"), { provider: "youtube", id: "dQw4w9WgXcQ" })
    assert.deepEqual(parseVideo("youtube.com/shorts/dQw4w9WgXcQ"), { provider: "youtube", id: "dQw4w9WgXcQ" })
    assert.deepEqual(parseVideo("https://vimeo.com/76979871"), { provider: "vimeo", id: "76979871" })
    for (const u of ["https://evil.com/watch?v=dQw4w9WgXcQ", "https://youtube.com/watch?v=<script>", "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ"]) assert.equal(parseVideo(u), null, u)
  })
  test("redes: guarda solo el usuario y no acepta otros sitios", () => {
    assert.equal(normalizeLinkSocial("instagram", "@cafe.central"), "cafe.central")
    assert.equal(normalizeLinkSocial("instagram", "https://www.instagram.com/cafe.central/"), "cafe.central")
    assert.equal(normalizeLinkSocial("youtube", "https://www.youtube.com/@cafecentral"), "cafecentral")
    assert.equal(normalizeLinkSocial("instagram", "https://malo.com/cafe"), null)
  })
})

describe("contenido y bloques", () => {
  test("la página inicial usa los datos reales y es válida", () => {
    const c = base()
    assert.equal(c.profile.name, "Café Central")
    assert.ok(c.blocks.some((b) => b.type === "whatsapp"))
    assert.ok(contentSchema.safeParse(c).success)
    assert.deepEqual(readContent(JSON.parse(JSON.stringify(c))), c)
  })
  test("rechaza tipos de bloque desconocidos y colores o letras inválidos", () => {
    assert.equal(blockSchema.safeParse({ id: "abcdefgh", type: "musica", url: "x" }).success, false)
    const c = base()
    assert.equal(contentSchema.safeParse({ ...c, theme: { ...c.theme, text: "red;background:url(x)" } }).success, false)
    assert.equal(contentSchema.safeParse({ ...c, theme: { ...c.theme, font: "Comic Sans" } }).success, false)
  })
  test("no deja publicar sin nombre, con enlaces malos o con bloques de ejemplo", () => {
    const c: LinkContent = { ...base(), profile: { ...base().profile, name: "" }, blocks: [link({ url: "javascript:alert(1)" }), ...suggestedBlocks("restaurante")] }
    const p = publishProblems(c)
    assert.ok(p.some((x) => x.includes("nombre")))
    assert.ok(p.some((x) => x.includes("enlace no es válido")))
    assert.ok(p.some((x) => x.includes("de ejemplo")))
    assert.deepEqual(publishProblems({ ...base(), blocks: [link()] }), [])
  })
  test("un bloque oculto, de ejemplo o fuera de fecha no se muestra", () => {
    assert.equal(isBlockLive(link(), "2026-11-22"), true)
    assert.equal(isBlockLive(link({ hidden: true }), "2026-11-22"), false)
    assert.equal(isBlockLive(link({ demo: true }), "2026-11-22"), false)
    assert.equal(isBlockLive(link({ startsAt: "2026-12-01" }), "2026-11-22"), false)
    assert.equal(isBlockLive(link({ endsAt: "2026-11-21" }), "2026-11-22"), false)
    assert.equal(isBlockLive(link({ startsAt: "2026-11-01", endsAt: "2026-11-30" }), "2026-11-22"), true)
    const promo: LinkBlock = { id: newBlockId(), type: "promo", hidden: false, startsAt: null, endsAt: null, title: "2x1", body: "", code: "", url: "", until: "2026-11-20" }
    assert.equal(isBlockLive(promo, "2026-11-22"), false)
  })
})

describe("plan Gratis y Pro", () => {
  test("lo básico se puede publicar en Gratis", () => {
    assert.deepEqual(proFeaturesUsed({ ...base(), blocks: [link()] }), [])
  })
  test("detecta plantillas, bloques y diseño Pro", () => {
    const theme = templateTheme("restaurante")
    const c: LinkContent = {
      ...base(),
      theme: { ...theme, bg: { ...theme.bg, kind: "gradient" } },
      branding: false,
      blocks: [{ id: newBlockId(), type: "video", hidden: false, startsAt: null, endsAt: null, url: "https://youtu.be/dQw4w9WgXcQ", title: "" }],
    }
    const used = proFeaturesUsed(c).join(" | ")
    for (const word of ["Restaurante", "degradado", "Clásica", "OrdenSimple", "Video"]) assert.ok(used.includes(word), word)
  })
  test("al mostrar sin Pro, lo Pro se apaga (aunque se haya publicado antes)", () => {
    const booking: LinkBlock = { id: newBlockId(), type: "booking", hidden: false, startsAt: null, endsAt: null, title: "Reserva" }
    const blocks = [...Array.from({ length: 15 }, () => link()), booking]
    const free = toFreeContent({ ...base(), theme: templateTheme("ropa"), branding: false, blocks })
    assert.equal(free.branding, true)
    assert.equal(free.theme.bg.kind, "solid")
    assert.equal(free.theme.shadow, false)
    assert.ok(free.blocks.length <= 12)
    assert.ok(free.blocks.every((b) => b.type !== "booking"))
    assert.deepEqual(proFeaturesUsed(free), [])
  })
  test("hay plantillas gratis y Pro, y todas son distintas entre sí", () => {
    assert.ok(TEMPLATES.filter((t) => !t.pro).length >= 4)
    assert.equal(TEMPLATES.length, 10)
    const looks = new Set(TEMPLATES.map((t) => [t.theme.bg.color, t.theme.button, t.theme.radius, t.theme.font, t.theme.header].join()))
    assert.equal(looks.size, TEMPLATES.length)
  })
})

describe("contraste", () => {
  test("calcula como WCAG", () => {
    assert.equal(Math.round(contrast("#000000", "#ffffff")), 21)
    assert.equal(contrast("#777777", "#777777"), 1)
  })
  test("todas las plantillas se leen bien", () => {
    for (const t of TEMPLATES) assert.deepEqual(contrastIssues(templateTheme(t.id)), [], t.id)
  })
  test("avisa y arregla un diseño que no se lee", () => {
    const bad = { ...templateTheme("emprendedor"), text: "#f0f0f0", accent: "#ffff00", accentText: "#ffffff" }
    assert.equal(contrastIssues(bad).length, 2)
    assert.deepEqual(contrastIssues(fixContrast(bad)), [])
  })
})

describe("estadísticas", () => {
  test("reconoce de dónde llega la visita", () => {
    assert.equal(detectSource("https://l.instagram.com/?u=x", ""), "instagram")
    assert.equal(detectSource("https://www.google.cl/", ""), "google")
    assert.equal(detectSource(null, "?src=qr"), "qr")
    assert.equal(detectSource("https://algo.cl", "?utm_source=TikTok"), "tiktok")
    assert.equal(detectSource(null, null), "directo")
    assert.equal(detectSource("https://otrositio.cl/", ""), "otro")
  })
  test("equipo y robots", () => {
    assert.equal(detectDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148"), "mobile")
    assert.equal(detectDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130"), "desktop")
    assert.equal(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)"), true)
    assert.equal(isBot("WhatsApp/2.23"), true)
    assert.equal(isBot("facebookexternalhit/1.1"), true)
    assert.equal(isBot(""), true)
    assert.equal(isBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1"), false)
  })
})
