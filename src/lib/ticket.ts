// Una boleta armada una sola vez, que se puede enviar a una impresora Bluetooth (ESC/POS) o guardar como PDF
// del tamaño del rollo. Así las dos salidas tienen siempre el mismo contenido.

import { EscPos } from "@/lib/escpos"

type Op =
  | { t: "line"; text: string; bold?: boolean; center?: boolean; big?: boolean }
  | { t: "row"; left: string; right: string; bold?: boolean }
  | { t: "rule"; char: string }
  | { t: "feed"; lines: number }
  | { t: "cut" }

export class Ticket {
  readonly ops: Op[] = []
  /** big: letra al doble (en la comanda de cocina, para leerla de lejos). */
  line(text = "", o: { bold?: boolean; center?: boolean; big?: boolean } = {}) {
    this.ops.push({ t: "line", text, ...o })
    return this
  }
  row(left: string, right: string, o: { bold?: boolean } = {}) {
    this.ops.push({ t: "row", left, right, ...o })
    return this
  }
  rule(char = "-") {
    this.ops.push({ t: "rule", char })
    return this
  }
  feed(lines = 1) {
    this.ops.push({ t: "feed", lines })
    return this
  }
  /** Fin de un ticket: la impresora corta; en el PDF empieza otra página. */
  cut() {
    this.ops.push({ t: "cut" })
    return this
  }
}

/** Para impresoras Bluetooth (comandos ESC/POS), con `chars` caracteres por línea. */
export function ticketToEscPos(ticket: Ticket, chars: number) {
  const p = new EscPos(chars)
  let cut = false
  for (const op of ticket.ops) {
    cut = false
    if (op.t === "line") {
      if (op.center) p.center()
      if (op.bold) p.bold()
      if (op.big) p.big()
      p.line(op.text)
      if (op.big) p.big(false)
      if (op.bold) p.bold(false)
      if (op.center) p.center(false)
    } else if (op.t === "row") {
      if (op.bold) p.bold()
      p.row(op.left, op.right)
      if (op.bold) p.bold(false)
    } else if (op.t === "rule") p.rule(op.char)
    else if (op.t === "feed") p.feed(op.lines)
    else {
      p.cut()
      cut = true
    }
  }
  if (!cut) p.cut()
  return p.build()
}

/** Corta un texto largo en líneas de hasta `chars` caracteres, sin partir palabras si se puede. */
function wrap(text: string, chars: number) {
  const out: string[] = []
  // La sangría del comienzo ("  ($2.500 c/u)") se mantiene.
  const indent = text.match(/^ */)![0]
  let current = indent
  for (const word of text.slice(indent.length).split(" ")) {
    if (current === indent || !current) current += word
    else if (current.length + 1 + word.length <= chars) current += ` ${word}`
    else {
      out.push(current)
      current = word
    }
    while (current.length > chars) {
      out.push(current.slice(0, chars))
      current = current.slice(chars)
    }
  }
  out.push(current)
  return out
}

/** Caracteres que la letra del PDF (Courier) no tiene: se cambian por los más parecidos. */
const pdfText = (text: string) =>
  text
    .replace(/[−–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7e\xa0-\xff]/g, "")

type Out = { text: string; bold: boolean; center: boolean }

/** Las líneas exactas de cada ticket (separados por un corte), con `chars` caracteres por línea. */
function layout(ticket: Ticket, chars: number) {
  const tickets: Out[][] = [[]]
  const add = (o: Out) => tickets[tickets.length - 1].push(o)
  for (const op of ticket.ops) {
    if (op.t === "line") for (const l of wrap(pdfText(op.text), chars)) add({ text: l, bold: Boolean(op.bold || op.big), center: Boolean(op.center) })
    else if (op.t === "row") {
      const left = pdfText(op.left)
      const right = pdfText(op.right)
      if (left.length + right.length + 1 > chars) {
        for (const l of wrap(left, chars)) add({ text: l, bold: Boolean(op.bold), center: false })
        add({ text: right.padStart(chars), bold: Boolean(op.bold), center: false })
      } else add({ text: left + " ".repeat(chars - left.length - right.length) + right, bold: Boolean(op.bold), center: false })
    } else if (op.t === "rule") add({ text: op.char.repeat(chars), bold: false, center: false })
    else if (op.t === "feed") for (let i = 0; i < op.lines; i++) add({ text: "", bold: false, center: false })
    else tickets.push([])
  }
  return tickets.filter((t) => t.some((l) => l.text.trim()))
}

/**
 * PDF del tamaño de la boleta: el ancho del rollo y el largo justo de lo impreso. Cada ticket (separado por un corte)
 * va en su propia página. La letra se ajusta para que entren `chars` caracteres por línea.
 */
export async function ticketToPdf(ticket: Ticket, widthMm: number, chars: number) {
  const { PDFDocument, PrintScaling, StandardFonts } = await import("pdf-lib")
  const pdf = await PDFDocument.create()
  // Al imprimir: sin achicar ni agrandar, y en el papel del tamaño del PDF (los programas que lo respetan).
  const prefs = pdf.catalog.getOrCreateViewerPreferences()
  prefs.setPrintScaling(PrintScaling.None)
  prefs.setPickTrayByPDFSize(true)
  const regular = await pdf.embedFont(StandardFonts.Courier)
  const bold = await pdf.embedFont(StandardFonts.CourierBold)
  const mm = 72 / 25.4
  const margin = 3 * mm
  const width = widthMm * mm
  // Courier: cada letra mide 0,6 del tamaño de la letra.
  const size = (width - margin * 2) / (chars * 0.6)
  const lineHeight = size * 1.3

  for (const lines of layout(ticket, chars)) {
    const height = margin * 2 + lines.length * lineHeight
    const page = pdf.addPage([width, height])
    lines.forEach((l, i) => {
      const font = l.bold ? bold : regular
      const textWidth = font.widthOfTextAtSize(l.text, size)
      const x = l.center ? (width - textWidth) / 2 : margin
      page.drawText(l.text, { x, y: height - margin - (i + 1) * lineHeight + lineHeight * 0.25, size, font })
    })
  }
  return pdf.save()
}

/** Puntos que imprime una térmica (203 ppp): rollo de 58 mm, 384; de 80 mm, 576. */
export const ROLL_DOTS = { 58: 384, 80: 576 } as const

/**
 * La boleta como imagen PNG del ancho exacto que imprime la impresora térmica, una por ticket. Las apps de las
 * impresoras la imprimen tal cual, sin hoja carta ni A4 de por medio. Solo en el navegador (usa un canvas).
 */
export async function ticketToImages(ticket: Ticket, widthDots: number, chars: number) {
  const family = '"Courier New", Courier, monospace'
  const probe = document.createElement("canvas").getContext("2d")!
  probe.font = `bold 100px ${family}`
  // La letra justa para que entren `chars` letras en el ancho.
  const size = Math.floor((widthDots / probe.measureText("M".repeat(chars)).width) * 100)
  const lineHeight = Math.round(size * 1.3)
  const pad = Math.round(size * 0.8)

  const images: Blob[] = []
  for (const lines of layout(ticket, chars)) {
    const canvas = document.createElement("canvas")
    canvas.width = widthDots
    canvas.height = pad * 2 + lines.length * lineHeight
    const ctx = canvas.getContext("2d")!
    ctx.fillStyle = "#fff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = "#000"
    ctx.textBaseline = "middle"
    lines.forEach((l, i) => {
      // En papel térmico la letra fina sale débil: todo un poco grueso y lo destacado, en negrita.
      ctx.font = `${l.bold ? "bold" : "600"} ${size}px ${family}`
      const x = l.center ? (widthDots - ctx.measureText(l.text).width) / 2 : 0
      ctx.fillText(l.text, x, pad + i * lineHeight + lineHeight / 2)
    })
    images.push(await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas"))), "image/png")))
  }
  return images
}

/**
 * Página HTML con el ticket para el diálogo de impresión del navegador: el ancho del rollo como máximo, pegada arriba,
 * y cada ticket (separado por un corte) en su propia hoja. Sin tamaño de hoja (ver RollPaper).
 */
export function ticketToHtml(ticket: Ticket, widthMm: number, chars: number) {
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  const pages = layout(ticket, chars)
    .map((lines) => `<div class="t">${lines.map((l) => `<div class="${l.bold ? "b " : ""}${l.center ? "c" : ""}">${esc(l.text) || "&nbsp;"}</div>`).join("")}</div>`)
    .join("")
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@page { margin: 0 }
html, body { margin: 0; padding: 0; background: #fff }
body { box-sizing: border-box; max-width: ${widthMm}mm; padding: 1mm 3mm 0; font: ${widthMm === 58 ? "9pt" : "10.5pt"}/1.35 ui-monospace, "Courier New", monospace; color: #000 }
div div { white-space: pre }
.b { font-weight: 700 } .c { text-align: center }
.t { break-after: page; page-break-after: always } .t:last-child { break-after: auto; page-break-after: auto }
</style></head><body>${pages}</body></html>`
}
