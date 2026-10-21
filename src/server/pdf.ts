import "server-only"
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib"

// Reportes en PDF con el mismo diseño: encabezado con el negocio y el período, cifras destacadas,
// tablas que siguen en la página siguiente (repitiendo los títulos) y pie con la fecha y el número de página.

const BRAND = rgb(0, 0.463, 0.325)
const INK = rgb(0.09, 0.11, 0.1)
const MUTED = rgb(0.42, 0.45, 0.44)
const LINE = rgb(0.88, 0.9, 0.89)
const ZEBRA = rgb(0.965, 0.975, 0.97)
const SOFT = rgb(0.93, 0.965, 0.95)
const BAD = rgb(0.72, 0.18, 0.12)

// Las letras estándar del PDF (Helvetica) solo traen el alfabeto latino: tildes, ñ, ¿, ¡, €, — y similares.
// Lo que no está (emojis, el signo menos largo…) se cambia o se quita para que el PDF no falle.
const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ")
export function pdfText(value: string) {
  return value
    .replace(/[−‒]/g, "-")
    .replace(/[  ]/g, " ")
    .replace(/[^\x20-\x7e¡-ÿ\n]/g, (c) => (WIN_ANSI_EXTRA.has(c) ? c : ""))
    .replace(/[ \t]+/g, " ")
}

export type PdfColumn = { label: string; width: number; align?: "left" | "right" }
export type PdfKpi = { label: string; value: string; sub?: string; tone?: "good" | "bad" }

export class PdfReport {
  private doc!: PDFDocument
  private font!: PDFFont
  private bold!: PDFFont
  private page!: PDFPage
  private y = 0
  private readonly margin = 40
  private constructor(
    private readonly opts: { businessName: string; title: string; subtitle: string; generated: string; landscape?: boolean },
  ) {}

  static async create(opts: { businessName: string; title: string; subtitle: string; generated: string; landscape?: boolean }) {
    const r = new PdfReport(opts)
    r.doc = await PDFDocument.create()
    r.doc.setTitle(pdfText(`${opts.title} · ${opts.businessName}`))
    r.doc.setAuthor("OrdenSimple")
    r.doc.setCreator("OrdenSimple (ordensimple.cl)")
    r.font = await r.doc.embedFont(StandardFonts.Helvetica)
    r.bold = await r.doc.embedFont(StandardFonts.HelveticaBold)
    r.newPage(true)
    return r
  }

  private get width() {
    return this.page.getWidth() - this.margin * 2
  }

  private newPage(first = false) {
    this.page = this.doc.addPage(this.opts.landscape ? [842, 595] : [595, 842])
    const top = this.page.getHeight()
    // Franja de marca arriba.
    this.page.drawRectangle({ x: 0, y: top - 6, width: this.page.getWidth(), height: 6, color: BRAND })
    this.text("OrdenSimple", this.page.getWidth() - this.margin - this.bold.widthOfTextAtSize("OrdenSimple", 9), top - 28, { size: 9, font: this.bold, color: BRAND })
    if (first) {
      this.text(this.opts.businessName, this.margin, top - 46, { size: 18, font: this.bold })
      this.text(this.opts.title, this.margin, top - 66, { size: 12, font: this.bold, color: BRAND })
      this.text(this.opts.subtitle, this.margin, top - 82, { size: 9.5, color: MUTED })
      this.y = top - 104
    } else {
      this.text(`${this.opts.businessName} · ${this.opts.title}`, this.margin, top - 28, { size: 9, color: MUTED })
      this.y = top - 50
    }
  }

  /** Si no cabe lo que viene, pasa a la página siguiente. */
  private ensure(height: number) {
    if (this.y - height < this.margin + 24) {
      this.newPage()
      return true
    }
    return false
  }

  private text(value: string, x: number, y: number, o: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb> } = {}) {
    this.page.drawText(pdfText(value), { x, y, size: o.size ?? 10, font: o.font ?? this.font, color: o.color ?? INK })
  }

  /** Recorta con "…" lo que no cabe en el ancho. */
  private fit(value: string, width: number, size: number, font: PDFFont) {
    let s = pdfText(value)
    if (font.widthOfTextAtSize(s, size) <= width) return s
    while (s.length > 1 && font.widthOfTextAtSize(s + "…", size) > width) s = s.slice(0, -1)
    return s.trimEnd() + "…"
  }

  /** Título de una sección. */
  heading(value: string, note?: string) {
    // El título no queda solo al final de la página: tiene que caber con los títulos de la tabla y un par de filas.
    this.ensure(note ? 110 : 96)
    this.y -= 18
    this.text(value, this.margin, this.y, { size: 12, font: this.bold })
    if (note) {
      this.y -= 14
      this.text(this.fit(note, this.width, 9, this.font), this.margin, this.y, { size: 9, color: MUTED })
    }
    this.y -= 10
  }

  /** Párrafo con salto de línea automático. */
  paragraph(value: string, o: { size?: number; color?: "muted" | "ink" } = {}) {
    const size = o.size ?? 9.5
    const words = pdfText(value).split(" ")
    const lines: string[] = []
    let line = ""
    for (const w of words) {
      const next = line ? `${line} ${w}` : w
      if (this.font.widthOfTextAtSize(next, size) > this.width && line) {
        lines.push(line)
        line = w
      } else line = next
    }
    if (line) lines.push(line)
    for (const l of lines) {
      this.ensure(size + 6)
      this.y -= size + 4
      this.text(l, this.margin, this.y, { size, color: o.color === "ink" ? INK : MUTED })
    }
    this.y -= 6
  }

  /** Cifras destacadas en recuadros (hasta 4 por fila). */
  kpis(items: PdfKpi[]) {
    const perRow = Math.min(4, items.length)
    const gap = 10
    const w = (this.width - gap * (perRow - 1)) / perRow
    const h = 58
    for (let i = 0; i < items.length; i += perRow) {
      this.ensure(h + 10)
      const top = this.y
      items.slice(i, i + perRow).forEach((k, j) => {
        const x = this.margin + j * (w + gap)
        this.page.drawRectangle({ x, y: top - h, width: w, height: h, color: SOFT, borderColor: LINE, borderWidth: 0.6 })
        this.text(this.fit(k.label, w - 20, 8.5, this.font), x + 10, top - 16, { size: 8.5, color: MUTED })
        this.text(this.fit(k.value, w - 20, 15, this.bold), x + 10, top - 36, { size: 15, font: this.bold, color: k.tone === "bad" ? BAD : INK })
        if (k.sub) this.text(this.fit(k.sub, w - 20, 8, this.font), x + 10, top - 50, { size: 8, color: MUTED })
      })
      this.y = top - h - gap
    }
    this.y -= 4
  }

  /** Tabla. `width` de cada columna es una proporción del ancho de la página. */
  table(columns: PdfColumn[], rows: string[][], o: { total?: string[]; empty?: string } = {}) {
    const total = columns.reduce((s, c) => s + c.width, 0)
    const widths = columns.map((c) => (c.width / total) * this.width)
    const rowH = 17
    const size = 8.8
    const header = () => {
      this.ensure(rowH * 2)
      this.page.drawRectangle({ x: this.margin, y: this.y - rowH, width: this.width, height: rowH, color: BRAND })
      let x = this.margin
      columns.forEach((c, i) => {
        const label = this.fit(c.label, widths[i] - 10, size, this.bold)
        const tx = c.align === "right" ? x + widths[i] - 5 - this.bold.widthOfTextAtSize(label, size) : x + 5
        this.text(label, tx, this.y - 12, { size, font: this.bold, color: rgb(1, 1, 1) })
        x += widths[i]
      })
      this.y -= rowH
    }
    const draw = (cells: string[], index: number, strong = false) => {
      if (this.ensure(rowH)) header()
      if (strong) this.page.drawRectangle({ x: this.margin, y: this.y - rowH, width: this.width, height: rowH, color: SOFT })
      else if (index % 2) this.page.drawRectangle({ x: this.margin, y: this.y - rowH, width: this.width, height: rowH, color: ZEBRA })
      let x = this.margin
      const f = strong ? this.bold : this.font
      columns.forEach((c, i) => {
        const v = this.fit(cells[i] ?? "", widths[i] - 10, size, f)
        const tx = c.align === "right" ? x + widths[i] - 5 - f.widthOfTextAtSize(v, size) : x + 5
        this.text(v, tx, this.y - 12, { size, font: f, color: v.startsWith("-") && c.align === "right" ? BAD : INK })
        x += widths[i]
      })
      this.y -= rowH
    }
    header()
    if (!rows.length) {
      this.ensure(rowH)
      this.text(o.empty ?? "Sin datos en este período.", this.margin + 5, this.y - 12, { size, color: MUTED })
      this.y -= rowH
    }
    rows.forEach((r, i) => draw(r, i))
    if (o.total) draw(o.total, 0, true)
    this.page.drawLine({ start: { x: this.margin, y: this.y }, end: { x: this.margin + this.width, y: this.y }, thickness: 0.6, color: LINE })
    this.y -= 14
  }

  async save() {
    const pages = this.doc.getPages()
    pages.forEach((p, i) => {
      const footer = `Generado el ${this.opts.generated} con OrdenSimple · ordensimple.cl`
      p.drawText(pdfText(footer), { x: this.margin, y: 22, size: 8, font: this.font, color: MUTED })
      const n = `Página ${i + 1} de ${pages.length}`
      p.drawText(pdfText(n), { x: p.getWidth() - this.margin - this.font.widthOfTextAtSize(pdfText(n), 8), y: 22, size: 8, font: this.font, color: MUTED })
    })
    return this.doc.save()
  }
}

/** Respuesta de descarga del PDF. */
export function pdfResponse(bytes: Uint8Array, filename: string) {
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
