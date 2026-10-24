// Una boleta armada una sola vez, que se puede enviar a una impresora Bluetooth (ESC/POS) o guardar como PDF
// del tamaño del rollo. Así las dos salidas tienen siempre el mismo contenido.

import { EscPos } from "@/lib/escpos"

type Op =
  | { t: "line"; text: string; bold?: boolean; center?: boolean }
  | { t: "row"; left: string; right: string; bold?: boolean }
  | { t: "rule"; char: string }
  | { t: "feed"; lines: number }
  | { t: "cut" }

export class Ticket {
  readonly ops: Op[] = []
  line(text = "", o: { bold?: boolean; center?: boolean } = {}) {
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
      p.line(op.text)
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

/**
 * PDF del tamaño de la boleta: el ancho del rollo y el largo justo de lo impreso. Cada ticket (separado por un corte)
 * va en su propia página. La letra se ajusta para que entren `chars` caracteres por línea.
 */
export async function ticketToPdf(ticket: Ticket, widthMm: number, chars: number) {
  const { PDFDocument, StandardFonts } = await import("pdf-lib")
  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.Courier)
  const bold = await pdf.embedFont(StandardFonts.CourierBold)
  const mm = 72 / 25.4
  const margin = 3 * mm
  const width = widthMm * mm
  // Courier: cada letra mide 0,6 del tamaño de la letra.
  const size = (width - margin * 2) / (chars * 0.6)
  const lineHeight = size * 1.3

  // Cada ticket es una lista de líneas ya armadas (texto exacto, negrita y si va centrada).
  type Out = { text: string; bold: boolean; center: boolean }
  const tickets: Out[][] = [[]]
  const add = (o: Out) => tickets[tickets.length - 1].push(o)
  for (const op of ticket.ops) {
    if (op.t === "line") for (const l of wrap(pdfText(op.text), chars)) add({ text: l, bold: Boolean(op.bold), center: Boolean(op.center) })
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

  for (const lines of tickets.filter((t) => t.some((l) => l.text.trim()))) {
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
