import "server-only"
import { inflateRawSync } from "node:zlib"

/**
 * Planillas sin librerías: lee archivos .xlsx (un .zip con XML adentro) y .csv, y arma un .xlsx simple para descargar.
 * Solo se leen los valores guardados en las celdas: nunca se ejecutan macros ni fórmulas (de una fórmula se toma el
 * último resultado que guardó Excel).
 */

export type Sheet = string[][]

export class SpreadsheetError extends Error {}

/** Límites para que un archivo malicioso (o enorme) no consuma la memoria del servidor. */
const MAX_UNZIPPED = 20 * 1024 * 1024
const MAX_ROWS = 5001
const MAX_COLS = 40
const MAX_ENTRIES = 500

// ─── Lectura de .zip ─────────────────────────────────────────────────────────

type ZipEntry = { flags: number; method: number; compressed: number; local: number }

/**
 * Índice del .zip (sin descomprimir nada todavía) y una función para abrir solo los archivos que hacen falta.
 * Contra los "zip bomb": se cuenta lo que de verdad sale al descomprimir (no lo que el archivo dice que mide), con un
 * tope total, y hay un máximo de archivos adentro.
 */
function unzip(buf: Buffer) {
  // Fin del directorio central: firma 0x06054b50, buscada desde el final.
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new SpreadsheetError("El archivo no es un Excel válido (.xlsx).")
  const count = buf.readUInt16LE(eocd + 10)
  if (count > MAX_ENTRIES) throw new SpreadsheetError("El archivo Excel tiene demasiadas partes. Guárdalo de nuevo como .xlsx.")
  let p = buf.readUInt32LE(eocd + 16)
  const entries = new Map<string, ZipEntry>()
  const offsets = new Set<number>()
  for (let n = 0; n < count; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw new SpreadsheetError("El archivo Excel está dañado.")
    const nameLen = buf.readUInt16LE(p + 28)
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8")
    const local = buf.readUInt32LE(p + 42)
    if (entries.has(name) || offsets.has(local)) throw new SpreadsheetError("El archivo Excel está dañado.")
    offsets.add(local)
    entries.set(name, { flags: buf.readUInt16LE(p + 8), method: buf.readUInt16LE(p + 10), compressed: buf.readUInt32LE(p + 20), local })
    p += 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32)
  }
  let total = 0
  const read = (name: string): Buffer | undefined => {
    const e = entries.get(name)
    if (!e) return undefined
    if (e.flags & 1) throw new SpreadsheetError("El archivo tiene contraseña. Guárdalo sin contraseña y vuelve a subirlo.")
    if (e.local + 30 > buf.length || buf.readUInt32LE(e.local) !== 0x04034b50) throw new SpreadsheetError("El archivo Excel está dañado.")
    const start = e.local + 30 + buf.readUInt16LE(e.local + 26) + buf.readUInt16LE(e.local + 28)
    const data = buf.subarray(start, start + e.compressed)
    let out: Buffer
    if (e.method === 0) out = data
    else if (e.method === 8) {
      try {
        out = inflateRawSync(data, { maxOutputLength: Math.max(1, MAX_UNZIPPED - total) })
      } catch {
        throw new SpreadsheetError("El archivo es demasiado grande o está dañado.")
      }
    } else throw new SpreadsheetError("El archivo Excel usa un formato que no reconocemos.")
    total += out.length
    if (total > MAX_UNZIPPED) throw new SpreadsheetError("El archivo es demasiado grande.")
    return out
  }
  return { names: [...entries.keys()], read }
}

/** Atributo de una etiqueta XML ya recortada (por ejemplo, Target de un <Relationship>). */
function attr(tag: string, name: string) {
  const i = tag.indexOf(` ${name}="`)
  if (i < 0) return undefined
  const from = i + name.length + 3
  const to = tag.indexOf(`"`, from)
  return to < 0 ? undefined : tag.slice(from, to)
}

// ─── Lectura de .xlsx ────────────────────────────────────────────────────────

function xmlText(s: string) {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
}

/** Texto de un <si> o <is>: puede venir en varios trozos con formato (<r><t>…</t></r>). Se ignoran las guías fonéticas. */
function runText(xml: string) {
  const clean = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "")
  let text = ""
  for (const m of clean.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) text += xmlText(m[1])
  return text
}

function colIndex(ref: string) {
  let n = 0
  for (const ch of ref.replace(/\d+/g, "")) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

export function readXlsx(buf: Buffer): Sheet {
  const zip = unzip(buf)
  const workbook = zip.read("xl/workbook.xml")?.toString("utf8")
  if (!workbook) throw new SpreadsheetError("El archivo no es un Excel válido (.xlsx).")
  // Primera hoja del libro: su r:id y, en las relaciones del libro, el archivo que le corresponde.
  const sheetTag = workbook.match(/<sheet\s[^>]*>/)?.[0] ?? ""
  const rid = attr(sheetTag, "r:id")
  const rels = zip.read("xl/_rels/workbook.xml.rels")?.toString("utf8") ?? ""
  const rel = rid ? [...rels.matchAll(/<Relationship\s[^>]*>/g)].map((m) => m[0]).find((t) => attr(t, "Id") === rid) : undefined
  const target = rel ? attr(rel, "Target") : undefined
  const wanted = target ? (target.startsWith("/") ? target.slice(1) : `xl/${target}`) : "xl/worksheets/sheet1.xml"
  const path = zip.names.includes(wanted) ? wanted : zip.names.find((n) => /^xl\/worksheets\/[^/]+\.xml$/.test(n))
  const sheet = path ? zip.read(path)?.toString("utf8") : undefined
  if (!sheet) throw new SpreadsheetError("El Excel no tiene hojas con datos.")

  const shared: string[] = []
  const sst = zip.read("xl/sharedStrings.xml")?.toString("utf8")
  if (sst) for (const m of sst.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) shared.push(runText(m[1]))

  const rows: Sheet = []
  for (const rm of sheet.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const r = Number(rm[1].match(/\br="(\d+)"/)?.[1] ?? rows.length + 1) - 1
    if (r >= MAX_ROWS) throw new SpreadsheetError(`El archivo tiene más de ${MAX_ROWS - 1} filas. Divídelo en varios archivos.`)
    const row: string[] = []
    for (const cm of (rm[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1]
      const ref = attrs.match(/\br="([A-Z]+)\d*"/)?.[1]
      const c = ref ? colIndex(ref) : row.length
      if (c >= MAX_COLS) continue
      const type = attrs.match(/\bt="([^"]+)"/)?.[1] ?? "n"
      const body = cm[2] ?? ""
      const v = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1]
      let value = ""
      if (type === "s") value = shared[Number(v)] ?? ""
      else if (type === "inlineStr") value = runText(body.match(/<is\b[^>]*>([\s\S]*?)<\/is>/)?.[1] ?? "")
      else if (type === "b") value = v === "1" ? "Sí" : v === "0" ? "No" : ""
      else value = v !== undefined ? xmlText(v) : ""
      row[c] = value
    }
    rows[r] = Array.from(row, (x) => x ?? "")
  }
  return Array.from(rows, (x) => x ?? [])
}

// ─── Lectura de .csv ─────────────────────────────────────────────────────────

export function readCsv(buf: Buffer): Sheet {
  // UTF-8 (con o sin BOM); si no lo es, el "ANSI" de Excel en Windows.
  let text = new TextDecoder("utf-8").decode(buf)
  if (text.includes("�")) text = new TextDecoder("windows-1252").decode(buf)
  text = text.replace(/^﻿/, "")
  const first = text.slice(0, text.search(/\r?\n|$/))
  // Separador: el que más aparece en la primera línea (Excel en español usa ";").
  const sep = [";", ",", "\t"].map((s) => [s, first.split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0]
  const rows: Sheet = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += ch
    } else if (ch === '"' && cell === "") quoted = true
    else if (ch === sep) {
      row.push(cell)
      cell = ""
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++
      row.push(cell)
      rows.push(row.slice(0, MAX_COLS))
      row = []
      cell = ""
      if (rows.length > MAX_ROWS) throw new SpreadsheetError(`El archivo tiene más de ${MAX_ROWS - 1} filas. Divídelo en varios archivos.`)
    } else cell += ch
  }
  if (cell !== "" || row.length) {
    row.push(cell)
    rows.push(row.slice(0, MAX_COLS))
  }
  return rows
}

// ─── Escritura de .xlsx ──────────────────────────────────────────────────────

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf: Buffer) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** .zip sin comprimir (método "store"): suficiente para una plantilla de pocos KB. */
function zip(files: [string, string][]) {
  const parts: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  for (const [name, content] of files) {
    const data = Buffer.from(content, "utf8")
    const nameBuf = Buffer.from(name, "utf8")
    const crc = crc32(data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6) // nombres en UTF-8
    local.writeUInt16LE(0, 8)
    local.writeUInt32LE(0x00210000, 10) // 1 de enero de 1980
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    parts.push(local, nameBuf, data)
    const cd = Buffer.alloc(46)
    cd.writeUInt32LE(0x02014b50, 0)
    cd.writeUInt16LE(20, 4)
    cd.writeUInt16LE(20, 6)
    cd.writeUInt16LE(0x0800, 8)
    cd.writeUInt32LE(0x00210000, 12)
    cd.writeUInt32LE(crc, 16)
    cd.writeUInt32LE(data.length, 20)
    cd.writeUInt32LE(data.length, 24)
    cd.writeUInt16LE(nameBuf.length, 28)
    cd.writeUInt32LE(offset, 42)
    central.push(cd, nameBuf)
    offset += 30 + nameBuf.length + data.length
  }
  const cdBuf = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(cdBuf.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...parts, cdBuf, end])
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
const colName = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26)))

export type XlsxSheet = {
  name: string
  rows: (string | number | null)[][]
  widths?: number[]
  /** Columnas que se guardan como texto (códigos de barras: así no se pierden los ceros de adelante). */
  textColumns?: number[]
}

/** Arma un .xlsx con una o más hojas. La primera fila va en negrita. */
export function writeXlsx(sheets: XlsxSheet[]) {
  const sheetXml = (s: XlsxSheet) => {
    const text = new Set(s.textColumns ?? [])
    const cols = (s.widths ?? []).map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"${text.has(i) ? ' style="2"' : ""}/>`).join("")
    const rows = s.rows
      .map((row, r) => {
        const cells = row
          .map((v, c) => {
            if (v === null || v === "") return ""
            const ref = `${colName(c)}${r + 1}`
            const style = r === 0 ? ' s="1"' : text.has(c) ? ' s="2"' : ""
            return typeof v === "number" ? `<c r="${ref}"${style}><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${esc(v)}</t></is></c>`
          })
          .join("")
        return `<row r="${r + 1}">${cells}</row>`
      })
      .join("")
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols ? `<cols>${cols}</cols>` : ""}<sheetData>${rows}</sheetData></worksheet>`
  }
  const files: [string, string][] = [
    [
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`,
    ],
    [
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ],
    [
      "xl/workbook.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`,
    ],
    [
      "xl/_rels/workbook.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ],
    [
      "xl/styles.xml",
      // 0: normal · 1: negrita (encabezados) · 2: texto (formato "@", para códigos)
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    ],
    ...sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)] as [string, string]),
  ]
  return zip(files)
}
