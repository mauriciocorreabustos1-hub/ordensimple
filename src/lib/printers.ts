"use client"

// Impresoras de boletas y comandas de este aparato: cómo está conectada cada una y cómo se le manda el ticket.
// Cubre las térmicas comunes (ESC/POS):
// - Diálogo de impresión: cualquier impresora instalada en el computador (USB, red o AirPrint), con su driver.
// - Bluetooth BLE: Chrome o Edge (Android y computador) y la app de OrdenSimple (también iPhone).
// - Bluetooth clásico: las portátiles baratas; solo en la app de Android (el iPhone no lo permite a ninguna app).
// - Red (Wi-Fi o cable) por IP, puerto 9100: la típica de cocina; en la app (los navegadores no pueden).
// - USB directo (WebUSB) y puerto serie (Web Serial): Chrome o Edge, sin driver ni diálogo.
// - RawBT: la app de Android que imprime lo que le mande el navegador.
// Se guarda en este aparato (cada caja, celular o tablet tiene su impresora).

import * as React from "react"
import { ROLL_CHARS } from "@/lib/escpos"
import { canUseWebBluetooth, isAndroid, nativePrinterId, printViaBluetooth, rawbtLink } from "@/lib/bluetooth-print"
import { desktopBridge, isNativeApp, nativePlugin } from "@/lib/native-app"
import { ticketToEscPos, ticketToHtml, type Ticket } from "@/lib/ticket"

export type PrinterKind = "desktop" | "dialog" | "bluetooth" | "bt-classic" | "network" | "usb" | "serial" | "rawbt"
export type PrinterRole = "cuenta" | "cocina"

export type PrinterSetup = {
  kind: PrinterKind
  width: 58 | 80
  /** Red: dirección IP y puerto (casi siempre 9100). */
  host?: string
  port?: number
  /** Bluetooth: la impresora elegida (dirección en el clásico, id en BLE de la app). */
  address?: string
  /** Nombre para mostrar (en "desktop", el nombre de la impresora en Windows). */
  name?: string
  /** App de PC: imprimir como página (impresoras que no son térmicas) en vez de comandos ESC/POS. */
  page?: boolean
}

export type PrinterPrefs = {
  cuenta?: PrinterSetup
  cocina?: PrinterSetup
  /** Imprimir la comanda en este aparato al tocar "Enviar a cocina". */
  kitchenOnSend?: boolean
  /** En la pantalla de Cocina de este aparato, imprimir solo lo que llega. */
  kitchenAuto?: boolean
}

export const PRINTER_KINDS: Record<PrinterKind, { label: string; hint: string }> = {
  desktop: { label: "Impresora de este PC", hint: "Cualquier impresora instalada en Windows (USB o de red). Sale directo, sin ventana de impresión." },
  dialog: { label: "Impresora instalada en el computador", hint: "Cualquier impresora instalada en este computador (USB, red o AirPrint). Se abre la ventana de impresión, salvo que uses el acceso directo de abajo." },
  bluetooth: { label: "Bluetooth (BLE)", hint: "La primera vez eliges la impresora en la lista." },
  "bt-classic": { label: "Bluetooth clásico", hint: "Para impresoras portátiles. Primero emparéjala en los ajustes de Bluetooth del celular." },
  network: { label: "Red: Wi-Fi o cable (IP)", hint: "Escribe la dirección IP de la impresora. Sale en la hoja de prueba que imprime al mantener apretado el botón de avance al encenderla." },
  usb: { label: "USB directo", hint: "Conectada por cable a esta tablet o computador (Android, Mac o Linux), sin driver ni ventana de impresión." },
  serial: { label: "Puerto serie (COM)", hint: "Impresoras USB que se instalan como puerto COM, o con cable serie." },
  rawbt: { label: "App RawBT (Android)", hint: "Instala la app gratuita RawBT desde Google Play y conecta ahí tu impresora una vez." },
}

const KEY = "ordensimple-impresoras"
const listeners = new Set<() => void>()
let cache: { raw: string | null; value: PrinterPrefs } = { raw: null, value: {} }

function readRaw() {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

/** Las preferencias de este aparato. */
export function getPrinterPrefs(): PrinterPrefs {
  const raw = readRaw()
  if (raw !== cache.raw) {
    let value: PrinterPrefs = {}
    try {
      value = raw ? (JSON.parse(raw) as PrinterPrefs) : {}
    } catch {}
    cache = { raw, value }
  }
  return cache.value
}

export function setPrinterPrefs(update: (p: PrinterPrefs) => PrinterPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(update(getPrinterPrefs())))
  } catch {}
  listeners.forEach((l) => l())
}

const EMPTY: PrinterPrefs = {}
export function usePrinterPrefs() {
  return React.useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    getPrinterPrefs,
    () => EMPTY,
  )
}

/* ---------- Qué se puede usar en este aparato ---------- */

type TcpSocket = {
  connect: (o: { ipAddress: string; port?: number }) => Promise<{ client: number }>
  send: (o: { client: number; data: string; encoding?: "base64" }) => Promise<void>
  disconnect: (o: { client: number }) => Promise<unknown>
}
type BluetoothSerial = {
  isEnabled: () => Promise<{ enabled: boolean }>
  enable: () => Promise<{ enabled: boolean }>
  scan: () => Promise<{ devices: { name: string; address: string }[] }>
  connect: (o: { address: string }) => Promise<void>
  isConnected: (o: { address: string }) => Promise<{ connected: boolean }>
  write: (o: { address: string; value: string }) => Promise<void>
}
const tcp = () => nativePlugin<TcpSocket>("TcpSocket")
const classic = () => nativePlugin<BluetoothSerial>("BluetoothSerial")

type UsbEndpoint = { direction: "in" | "out"; type: string; endpointNumber: number }
type UsbInterface = { interfaceNumber: number; alternate: { interfaceClass: number; endpoints: UsbEndpoint[] } }
type UsbDevice = {
  productName?: string
  manufacturerName?: string
  opened: boolean
  configuration: { interfaces: UsbInterface[] } | null
  open: () => Promise<void>
  selectConfiguration: (n: number) => Promise<void>
  claimInterface: (n: number) => Promise<void>
  transferOut: (endpoint: number, data: BufferSource) => Promise<unknown>
}
type UsbApi = { requestDevice: (o: { filters: object[] }) => Promise<UsbDevice>; getDevices: () => Promise<UsbDevice[]> }
type SerialPort = {
  getInfo?: () => { usbProductId?: number }
  open: (o: { baudRate: number }) => Promise<void>
  close: () => Promise<void>
  writable: WritableStream<Uint8Array> | null
}
type SerialApi = { requestPort: () => Promise<SerialPort>; getPorts: () => Promise<SerialPort[]> }
const usb = () => (typeof navigator === "undefined" ? undefined : (navigator as Navigator & { usb?: UsbApi }).usb)
const serial = () => (typeof navigator === "undefined" ? undefined : (navigator as Navigator & { serial?: SerialApi }).serial)

export function isWindows() {
  return typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent)
}

/**
 * Acceso directo para Windows que abre OrdenSimple en Chrome (o Edge) imprimiendo sin la ventana de impresión: todo sale
 * en la impresora predeterminada de Windows. Usa un perfil propio para que funcione aunque el navegador ya esté abierto.
 */
export function kioskShortcut(origin: string) {
  const url = `${origin}/dashboard`
  const flags = `--kiosk-printing --user-data-dir="%LOCALAPPDATA%\\OrdenSimpleCaja" --app=${url}`
  const chromeKey = (root: string) => `${root}\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe`
  return [
    "@echo off",
    "rem OrdenSimple: imprime directo en la impresora predeterminada de Windows, sin la ventana de impresion.",
    `reg query "${chromeKey("HKLM")}" >nul 2>&1 && (start "" chrome ${flags} & exit /b)`,
    `reg query "${chromeKey("HKCU")}" >nul 2>&1 && (start "" chrome ${flags} & exit /b)`,
    `start "" msedge ${flags}`,
    "",
  ].join("\r\n")
}

/** Las formas de conectar que funcionan en este aparato (las otras se explican en la pantalla). */
export function availableKinds(): PrinterKind[] {
  // App de PC: las impresoras de Windows y las de red, todo directo.
  if (desktopBridge()) return ["desktop", "network"]
  const out: PrinterKind[] = []
  // Dentro de la app no hay ventana de impresión.
  if (!isNativeApp()) out.push("dialog")
  if (tcp()) out.push("network")
  if (canUseWebBluetooth()) out.push("bluetooth")
  if (classic()) out.push("bt-classic")
  // En Windows la impresora USB la toma su driver y el navegador no puede usarla: ahí se imprime como impresora instalada.
  if (usb() && !isWindows()) out.push("usb")
  if (serial()) out.push("serial")
  if (isAndroid() && !isNativeApp()) out.push("rawbt")
  return out
}

/* ---------- Mandar los bytes ---------- */

class PrintError extends Error {}

function withTimeout<T>(p: Promise<T>, ms: number, message: string) {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new PrintError(message)), ms))])
}

function toBase64(data: Uint8Array) {
  let binary = ""
  for (const b of data) binary += String.fromCharCode(b)
  return btoa(binary)
}

async function sendNetwork(setup: PrinterSetup, data: Uint8Array) {
  if (!setup.host) throw new PrintError("Falta la dirección IP de la impresora.")
  const desktop = desktopBridge()
  if (desktop) {
    await desktop.sendTcp(setup.host, setup.port || 9100, toBase64(data)).catch(() => {
      throw new PrintError(`No se pudo conectar con la impresora en ${setup.host}. Revisa que esté encendida y en la misma red.`)
    })
    return
  }
  const api = tcp()
  if (!api) throw new PrintError("La impresora de red se usa desde la app de OrdenSimple.")
  const { client } = await withTimeout(
    api.connect({ ipAddress: setup.host, port: setup.port || 9100 }),
    8000,
    `No se pudo conectar con la impresora en ${setup.host}. Revisa que esté encendida y en la misma red Wi-Fi.`,
  )
  try {
    await api.send({ client, data: toBase64(data), encoding: "base64" })
  } finally {
    await api.disconnect({ client }).catch(() => {})
  }
}

async function sendClassic(setup: PrinterSetup, data: Uint8Array) {
  const api = classic()
  if (!api) throw new PrintError("El Bluetooth clásico se usa desde la app de OrdenSimple para Android.")
  if (!setup.address) throw new PrintError("Elige tu impresora en Configuración, sección Impresoras.")
  const { enabled } = await api.isEnabled()
  if (!enabled) await api.enable()
  const { connected } = await api.isConnected({ address: setup.address }).catch(() => ({ connected: false }))
  if (!connected) await withTimeout(api.connect({ address: setup.address }), 10000, "No se pudo conectar con la impresora. Revisa que esté encendida y cerca.")
  // Los comandos y el texto (sin acentos) son todos menores que 128: el plugin los manda tal cual.
  let value = ""
  for (const b of data) value += String.fromCharCode(b)
  await api.write({ address: setup.address, value })
}

async function usbDevice(choose: boolean) {
  const api = usb()
  if (!api) throw new PrintError("Este navegador no puede usar USB. Usa Chrome o Edge.")
  if (choose) return api.requestDevice({ filters: [] })
  const [device] = await api.getDevices()
  if (!device) throw new PrintError("Elige tu impresora USB en Configuración, sección Impresoras.")
  return device
}

async function sendUsb(data: Uint8Array) {
  const device = await usbDevice(false)
  if (!device.opened) await device.open()
  if (!device.configuration) await device.selectConfiguration(1)
  const ifaces = device.configuration?.interfaces ?? []
  // La interfaz de impresora (clase 7) o, si no, la primera con salida de datos.
  const iface =
    ifaces.find((i) => i.alternate.interfaceClass === 7 && i.alternate.endpoints.some((e) => e.direction === "out")) ??
    ifaces.find((i) => i.alternate.endpoints.some((e) => e.direction === "out" && e.type === "bulk"))
  const endpoint = iface?.alternate.endpoints.find((e) => e.direction === "out")
  if (!iface || !endpoint) throw new PrintError("Ese aparato USB no es una impresora.")
  try {
    await device.claimInterface(iface.interfaceNumber)
  } catch {
    throw new PrintError("Windows ya usa esta impresora con su driver. Elige “Diálogo de impresión” o “Puerto serie (COM)”.")
  }
  for (let i = 0; i < data.length; i += 4096) await device.transferOut(endpoint.endpointNumber, data.slice(i, i + 4096))
}

async function sendSerial(data: Uint8Array) {
  const api = serial()
  if (!api) throw new PrintError("Este navegador no puede usar puertos serie. Usa Chrome o Edge en el computador.")
  const [port] = await api.getPorts()
  if (!port) throw new PrintError("Elige el puerto de tu impresora en Configuración, sección Impresoras.")
  await port.open({ baudRate: 9600 }).catch((e: unknown) => {
    // Si ya estaba abierto (otra impresión), se sigue.
    if (!(e instanceof Error && e.name === "InvalidStateError")) throw e
  })
  const writer = port.writable!.getWriter()
  try {
    await writer.write(data)
  } finally {
    writer.releaseLock()
    await port.close().catch(() => {})
  }
}

async function sendBluetooth(setup: PrinterSetup, data: Uint8Array) {
  const remembered = setup.address ? { deviceId: setup.address, name: setup.name } : undefined
  try {
    return await printViaBluetooth(data, remembered)
  } catch (error) {
    // La impresora recordada ya no responde: se vuelve a elegir.
    if (!remembered) throw error
    return printViaBluetooth(data)
  }
}

/** Abre la ventana de impresión con el ticket (sin tamaño de hoja: la impresora usa su rollo). */
function printDialog(ticket: Ticket, width: 58 | 80) {
  const frame = document.createElement("iframe")
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0"
  document.body.appendChild(frame)
  const doc = frame.contentDocument!
  doc.open()
  doc.write(ticketToHtml(ticket, width, ROLL_CHARS[width]))
  doc.close()
  frame.contentWindow!.focus()
  frame.contentWindow!.print()
  setTimeout(() => frame.remove(), 60_000)
}

/** Imprime el ticket en la impresora configurada. Devuelve el nombre para el aviso. */
export async function printTicket(setup: PrinterSetup, ticket: Ticket): Promise<string> {
  if (setup.kind === "dialog") {
    printDialog(ticket, setup.width)
    return "la impresora"
  }
  if (setup.kind === "desktop") {
    const desktop = desktopBridge()
    if (!desktop) throw new PrintError("“Impresora de este PC” se usa desde OrdenSimple para PC.")
    if (!setup.name) throw new PrintError("Elige tu impresora en Configuración, sección Impresoras.")
    const name = setup.name
    try {
      if (setup.page) await desktop.printHtml(ticketToHtml(ticket, setup.width, ROLL_CHARS[setup.width]), name)
      else await desktop.printRaw(name, toBase64(ticketToEscPos(ticket, ROLL_CHARS[setup.width])))
    } catch {
      throw new PrintError(`No se pudo imprimir en ${name}. Revisa que esté encendida y conectada.`)
    }
    return name
  }
  const data = ticketToEscPos(ticket, ROLL_CHARS[setup.width])
  switch (setup.kind) {
    case "network":
      await sendNetwork(setup, data)
      return setup.name || setup.host || "la impresora"
    case "bt-classic":
      await sendClassic(setup, data)
      return setup.name || "la impresora"
    case "usb":
      await sendUsb(data)
      return setup.name || "la impresora USB"
    case "serial":
      await sendSerial(data)
      return setup.name || "la impresora"
    case "rawbt":
      window.location.href = rawbtLink(data)
      return "RawBT"
    case "bluetooth": {
      const name = await sendBluetooth(setup, data)
      // En la app se recuerda la impresora elegida para no volver a elegirla.
      const id = nativePrinterId()
      if (id && id.deviceId !== setup.address) rememberBluetooth(setup, id)
      return name
    }
  }
}

function rememberBluetooth(setup: PrinterSetup, id: { deviceId: string; name: string }) {
  setPrinterPrefs((p) => {
    const next = { ...p }
    for (const role of ["cuenta", "cocina"] as const) {
      const s = next[role]
      if (s && s.kind === "bluetooth" && s.address === setup.address) next[role] = { ...s, address: id.deviceId, name: id.name }
    }
    return next
  })
}

/* ---------- Para elegir la impresora en Configuración ---------- */

/** Impresoras instaladas en Windows (app de PC). */
export async function listDesktopPrinters() {
  return (await desktopBridge()?.listPrinters()) ?? []
}

/** Busca impresoras Bluetooth clásicas cercanas (app de Android). Demora unos 12 segundos. */
export async function scanClassicPrinters() {
  const api = classic()
  if (!api) throw new PrintError("El Bluetooth clásico se usa desde la app de OrdenSimple para Android.")
  const { enabled } = await api.isEnabled()
  if (!enabled) await api.enable()
  const { devices } = await api.scan()
  // Primero las que tienen nombre (las impresoras se anuncian con su modelo).
  return devices.filter((d) => d.address).sort((a, b) => Number(!a.name) - Number(!b.name))
}

/** Pide permiso para una impresora USB. Devuelve su nombre. */
export async function chooseUsbPrinter() {
  const device = await usbDevice(true)
  return [device.manufacturerName, device.productName].filter(Boolean).join(" ") || "Impresora USB"
}

/** Pide permiso para un puerto serie. */
export async function chooseSerialPort() {
  const api = serial()
  if (!api) throw new PrintError("Este navegador no puede usar puertos serie. Usa Chrome o Edge en el computador.")
  await api.requestPort()
  return "Puerto serie"
}

/** Mensaje claro para cada problema al imprimir. */
export function printerError(error: unknown) {
  if (error instanceof PrintError) return error.message
  const name = error instanceof Error ? error.name : ""
  const msg = error instanceof Error ? error.message : ""
  if (name === "NotFoundError" || /cancel/i.test(msg)) return "No elegiste ninguna impresora."
  if (name === "SecurityError" || name === "NotAllowedError" || /permission/i.test(msg)) return "No se dio permiso para usar la impresora. Vuelve a intentar y acepta el permiso."
  if (name === "NetworkError") return "Se perdió la conexión con la impresora. Revisa que esté encendida y conectada."
  return "No se pudo imprimir. Revisa que la impresora esté encendida y conectada, y vuelve a intentar."
}
