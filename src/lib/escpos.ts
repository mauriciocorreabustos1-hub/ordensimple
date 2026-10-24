// Texto para impresoras térmicas de boletas (comandos ESC/POS), para imprimir por Bluetooth.
// Las impresoras baratas no siempre traen los acentos: se pasan a letras simples (á a a, ñ a n) para que siempre salga bien.

/** Caracteres por línea con la letra normal: rollo de 58 mm, 32; de 80 mm, 48. */
export const ROLL_CHARS = { 58: 32, 80: 48 } as const

const ESC = 0x1b
const GS = 0x1d

/** "Almacén Ñuñoa ¡Gracias!" a "Almacen Nunoa Gracias!": solo lo que cualquier impresora imprime. */
export function plainText(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[×]/g, "x")
    .replace(/·/g, "-")
    .replace(/[−–—]/g, "-")
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[¡¿]/g, "")
    .replace(/[^\x20-\x7e\n]/g, "")
}

export class EscPos {
  private bytes: number[] = [ESC, 0x40] // inicia la impresora
  constructor(private readonly width: number) {}

  private push(...b: number[]) {
    this.bytes.push(...b)
    return this
  }
  center(on = true) {
    return this.push(ESC, 0x61, on ? 1 : 0)
  }
  bold(on = true) {
    return this.push(ESC, 0x45, on ? 1 : 0)
  }
  /** Letra al doble de alto y ancho (títulos). */
  big(on = true) {
    return this.push(GS, 0x21, on ? 0x11 : 0)
  }
  /** Una línea de texto; si es más larga que el papel, la impresora la corta en la línea siguiente. */
  line(text = "") {
    for (const ch of plainText(text)) this.bytes.push(ch.charCodeAt(0))
    return this.push(0x0a)
  }
  /** Texto a la izquierda y monto a la derecha: "2 x Lomo .... $5.980". Si no cabe, el texto pasa a su propia línea. */
  row(left: string, right: string) {
    const l = plainText(left)
    const r = plainText(right)
    if (l.length + r.length + 1 > this.width) return this.line(l).line(r.padStart(this.width))
    return this.line(l + " ".repeat(this.width - l.length - r.length) + r)
  }
  rule(char = "-") {
    return this.line(char.repeat(this.width))
  }
  feed(lines = 1) {
    return this.push(ESC, 0x64, lines)
  }
  /** Avanza el papel y lo corta (las impresoras sin cortador solo avanzan). */
  cut() {
    return this.feed(4).push(GS, 0x56, 0x42, 0x00)
  }
  build() {
    return new Uint8Array(this.bytes)
  }
}
