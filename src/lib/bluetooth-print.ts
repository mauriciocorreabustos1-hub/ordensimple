// Impresión por Bluetooth desde el navegador: directo (Web Bluetooth, en Chrome o Edge de Android y computador)
// o con la app RawBT en Android, para impresoras que el navegador no ve. En iPhone el navegador no tiene Bluetooth,
// pero la app de OrdenSimple sí (plugin nativo BluetoothLe).
import { nativePlugin } from "@/lib/native-app"

/* Lo mínimo de Web Bluetooth que se usa (no viene en los tipos de TypeScript). */
type Characteristic = {
  properties: { write: boolean; writeWithoutResponse: boolean }
  writeValueWithoutResponse?: (data: BufferSource) => Promise<void>
  writeValue: (data: BufferSource) => Promise<void>
}
type Service = { getCharacteristics: () => Promise<Characteristic[]> }
type Device = {
  name?: string
  gatt?: { connected: boolean; connect: () => Promise<{ getPrimaryServices: () => Promise<Service[]> }> }
}
type BluetoothApi = { requestDevice: (o: { acceptAllDevices: boolean; optionalServices: string[] }) => Promise<Device> }

/** Servicios que usan las impresoras térmicas Bluetooth más comunes (sin ellos el navegador no deja escribirles). */
const PRINTER_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "0000ae30-0000-1000-8000-00805f9b34fb",
  "0000fee7-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
]

/* Lo que se usa del plugin nativo de la app (los datos van como texto hexadecimal). */
type NativeBle = {
  initialize: () => Promise<void>
  requestDevice: (o: { optionalServices: string[] }) => Promise<{ deviceId: string; name?: string }>
  connect: (o: { deviceId: string }) => Promise<void>
  getServices: (o: { deviceId: string }) => Promise<{
    services: { uuid: string; characteristics: { uuid: string; properties: { write?: boolean; writeWithoutResponse?: boolean } }[] }[]
  }>
  write: (o: { deviceId: string; service: string; characteristic: string; value: string }) => Promise<void>
  writeWithoutResponse: (o: { deviceId: string; service: string; characteristic: string; value: string }) => Promise<void>
}
const nativeBle = () => nativePlugin<NativeBle>("BluetoothLe")

const bluetooth = () => (typeof navigator === "undefined" ? undefined : (navigator as Navigator & { bluetooth?: BluetoothApi }).bluetooth)

export function isIos() {
  return typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent)
}
export function isAndroid() {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent)
}
/** Se puede imprimir directo por Bluetooth: Chrome o Edge, o la app de OrdenSimple (también en iPhone). */
export function canUseWebBluetooth() {
  return Boolean(bluetooth() || nativeBle())
}
/** Dentro de la app, con Bluetooth nativo. */
export function canUseNativeBluetooth() {
  return Boolean(nativeBle())
}

// La impresora elegida se recuerda mientras la página esté abierta, para no elegirla en cada boleta.
let saved: { device: Device; characteristic: Characteristic } | null = null
let savedNative: { deviceId: string; name: string; service: string; characteristic: string; noResponse: boolean } | null = null

export function connectedPrinterName() {
  return savedNative?.name ?? saved?.device.name ?? null
}

async function printNative(ble: NativeBle, data: Uint8Array) {
  if (!savedNative) {
    await ble.initialize()
    const device = await ble.requestDevice({ optionalServices: PRINTER_SERVICES })
    await ble.connect({ deviceId: device.deviceId })
    const { services } = await ble.getServices({ deviceId: device.deviceId })
    for (const s of services) {
      const c = s.characteristics.find((x) => x.properties.writeWithoutResponse || x.properties.write)
      if (c) {
        savedNative = { deviceId: device.deviceId, name: device.name || "la impresora", service: s.uuid, characteristic: c.uuid, noResponse: Boolean(c.properties.writeWithoutResponse) }
        break
      }
    }
    if (!savedNative) throw new Error("NO_WRITE")
  } else {
    // Si la impresora se apagó o se alejó, se vuelve a conectar (si ya está conectada, no hace nada).
    try {
      await ble.connect({ deviceId: savedNative.deviceId })
    } catch (error) {
      savedNative = null
      throw error
    }
  }
  const target = savedNative
  for (let i = 0; i < data.length; i += 100) {
    let value = ""
    for (const b of data.slice(i, i + 100)) value += b.toString(16).padStart(2, "0")
    const o = { deviceId: target.deviceId, service: target.service, characteristic: target.characteristic, value }
    if (target.noResponse) await ble.writeWithoutResponse(o)
    else await ble.write(o)
    await new Promise((r) => setTimeout(r, 20))
  }
  return target.name
}

async function findCharacteristic(device: Device) {
  const server = await device.gatt!.connect()
  for (const service of await server.getPrimaryServices()) {
    for (const c of await service.getCharacteristics()) {
      if (c.properties.writeWithoutResponse || c.properties.write) return c
    }
  }
  throw new Error("NO_WRITE")
}

/** Envía los bytes a la impresora (la elige la persona la primera vez). Devuelve el nombre de la impresora. */
export async function printViaBluetooth(data: Uint8Array) {
  const ble = nativeBle()
  if (ble) return printNative(ble, data)
  const api = bluetooth()
  if (!api) throw new Error("NO_BLUETOOTH")
  if (!saved || !saved.device.gatt?.connected) {
    const device = saved?.device ?? (await api.requestDevice({ acceptAllDevices: true, optionalServices: PRINTER_SERVICES }))
    saved = { device, characteristic: await findCharacteristic(device) }
  }
  const { characteristic } = saved
  // De a pedazos chicos: muchas impresoras no reciben más de unos 100 bytes por envío.
  for (let i = 0; i < data.length; i += 100) {
    const chunk = data.slice(i, i + 100)
    if (characteristic.properties.writeWithoutResponse && characteristic.writeValueWithoutResponse) await characteristic.writeValueWithoutResponse(chunk)
    else await characteristic.writeValue(chunk)
    await new Promise((r) => setTimeout(r, 20))
  }
  return saved.device.name ?? "la impresora"
}

/** Enlace que abre la app RawBT (Android) con lo que hay que imprimir. */
export function rawbtLink(data: Uint8Array) {
  let binary = ""
  for (const b of data) binary += String.fromCharCode(b)
  return `intent:base64,${btoa(binary)}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`
}

/** Mensaje claro para cada problema al imprimir por Bluetooth. */
export function bluetoothError(error: unknown) {
  const name = error instanceof Error ? error.name : ""
  const msg = error instanceof Error ? error.message : ""
  if (name === "NotFoundError" || /cancel/i.test(msg)) return "No elegiste ninguna impresora."
  if (/not enabled|disabled|powered off|unauthorized|permission/i.test(msg)) return "La app no tiene acceso a Bluetooth. Revisa que esté encendido y que OrdenSimple tenga permiso en Ajustes, y vuelve a intentar."
  if (msg === "NO_BLUETOOTH") return "Este navegador no puede usar Bluetooth. Usa Chrome en Android o en el computador."
  if (msg === "NO_WRITE") return "Esa impresora no aceptó la conexión. Si usas Android, prueba con la app RawBT."
  if (name === "SecurityError" || name === "NotAllowedError") return "El navegador no dio permiso para usar Bluetooth. Revisa que esté encendido y vuelve a intentar."
  return "No se pudo imprimir. Revisa que la impresora esté encendida y cerca, y vuelve a intentar."
}
